-- Stage 1: no client writes until authenticated backend commands are implemented.
begin;

create schema if not exists sfa_private;
revoke all on schema sfa_private from public, anon, authenticated;
grant usage on schema sfa_private to authenticated;

create table public.sfa_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.sfa_memberships (
  space_id uuid not null references public.sfa_spaces(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('admin', 'caregiver', 'resident')),
  revoked_at timestamptz,
  primary key (space_id, user_id)
);
create index on public.sfa_memberships(user_id);

create table public.sfa_residents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.sfa_spaces(id),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  room text not null default '',
  phone text not null default '',
  emergency_phone text not null default '',
  medical_notes text not null default '',
  photo_path text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, id)
);

create table public.sfa_resident_access (
  space_id uuid not null,
  resident_id uuid not null,
  user_id uuid not null,
  can_configure boolean not null default false,
  revoked_at timestamptz,
  primary key (resident_id, user_id),
  foreign key (space_id, resident_id) references public.sfa_residents(space_id, id),
  foreign key (space_id, user_id) references public.sfa_memberships(space_id, user_id)
);
create index on public.sfa_resident_access(user_id);

create table public.sfa_devices (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.sfa_residents(id),
  kind text not null check (kind in ('belt', 'phone', 'pc_bridge')),
  transport text check (transport in ('usb_pc', 'bluetooth_pc', 'bluetooth_android')),
  label text not null default '',
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (resident_id, id),
  check ((kind = 'belt' and transport is not null) or
         (kind <> 'belt' and transport is null))
);
create unique index sfa_one_active_belt on public.sfa_devices(resident_id)
  where kind = 'belt' and revoked_at is null;

create table public.sfa_geofences (
  resident_id uuid primary key references public.sfa_residents(id),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null check (radius_m between 5 and 100000),
  label text not null default '',
  simulation boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.sfa_events (
  id uuid primary key, -- Generated at source; reused on retries.
  resident_id uuid not null references public.sfa_residents(id),
  device_id uuid not null,
  event_type text not null,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  simulated boolean not null default false,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  foreign key (resident_id, device_id) references public.sfa_devices(resident_id, id)
);
create index on public.sfa_events(resident_id, observed_at desc);

create table public.sfa_event_attention (
  event_id uuid primary key references public.sfa_events(id),
  actor_id uuid not null references auth.users(id),
  outcome text not null check (outcome in ('attending', 'attended', 'false_alarm')),
  updated_at timestamptz not null default now()
);

create table public.sfa_positions (
  id uuid primary key, -- Stable sample ID for offline synchronization.
  resident_id uuid not null references public.sfa_residents(id),
  device_id uuid not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m > 0 and accuracy_m <= 10000),
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  simulated boolean not null default false,
  foreign key (resident_id, device_id) references public.sfa_devices(resident_id, id)
);
create index on public.sfa_positions(resident_id, observed_at desc);

create table public.sfa_audit (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.sfa_spaces(id),
  actor_id uuid references auth.users(id),
  action text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

-- Private idempotent mappings; a local numeric ID is not a global identity.
create table sfa_private.legacy_residents (
  installation_id uuid not null,
  local_id bigint not null,
  resident_id uuid not null unique references public.sfa_residents(id),
  primary key (installation_id, local_id)
);
alter table sfa_private.legacy_residents enable row level security;

create function sfa_private.is_admin(target_space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sfa_memberships m
    where m.space_id = target_space and m.user_id = (select auth.uid())
    and m.role = 'admin' and m.revoked_at is null);
$$;

create function sfa_private.can_read_resident(target_resident uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sfa_residents r
    where r.id = target_resident and (
      sfa_private.is_admin(r.space_id) or exists (
        select 1 from public.sfa_resident_access a
        join public.sfa_memberships m using (space_id, user_id)
        where a.resident_id = r.id and a.user_id = (select auth.uid())
        and a.revoked_at is null and m.revoked_at is null)));
$$;
revoke all on function sfa_private.is_admin(uuid) from public, anon, authenticated;
revoke all on function sfa_private.can_read_resident(uuid) from public, anon, authenticated;
grant execute on function sfa_private.is_admin(uuid) to authenticated;
grant execute on function sfa_private.can_read_resident(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['sfa_spaces','sfa_memberships','sfa_residents',
    'sfa_resident_access','sfa_devices','sfa_geofences','sfa_events',
    'sfa_event_attention','sfa_positions','sfa_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;
grant usage on schema sfa_private to service_role;
grant all on sfa_private.legacy_residents to service_role;

create policy space_read on public.sfa_spaces for select to authenticated
  using (exists (select 1 from public.sfa_memberships m where m.space_id = id
    and m.user_id = (select auth.uid()) and m.revoked_at is null));
create policy membership_read on public.sfa_memberships for select to authenticated
  using ((user_id = (select auth.uid()) and revoked_at is null)
    or sfa_private.is_admin(space_id));
create policy resident_read on public.sfa_residents for select to authenticated
  using (sfa_private.can_read_resident(id));
create policy access_read on public.sfa_resident_access for select to authenticated
  using ((user_id = (select auth.uid()) and revoked_at is null
    and sfa_private.can_read_resident(resident_id)) or sfa_private.is_admin(space_id));
create policy device_read on public.sfa_devices for select to authenticated
  using (sfa_private.can_read_resident(resident_id));
create policy fence_read on public.sfa_geofences for select to authenticated
  using (sfa_private.can_read_resident(resident_id));
create policy event_read on public.sfa_events for select to authenticated
  using (sfa_private.can_read_resident(resident_id));
create policy position_read on public.sfa_positions for select to authenticated
  using (sfa_private.can_read_resident(resident_id));
create policy attention_read on public.sfa_event_attention for select to authenticated
  using (exists (select 1 from public.sfa_events e where e.id = event_id
    and sfa_private.can_read_resident(e.resident_id)));
create policy audit_read on public.sfa_audit for select to authenticated
  using (sfa_private.is_admin(space_id));

commit;
