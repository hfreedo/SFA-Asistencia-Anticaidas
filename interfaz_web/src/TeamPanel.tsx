import { Children, isValidElement, useEffect, useState, type FormEvent, type SelectHTMLAttributes } from "react";
import * as Select from "@radix-ui/react-select";
import type { Session } from "@supabase/supabase-js";
import { Building2, Check, ChevronDown, Mail, RefreshCw, Save, ShieldCheck, UserPlus, UserRoundX, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import { accessDataClient } from "./accessClient";
import { registerTeamDraft } from "./teamDraftGuard";
import "./peopleTeam.css";

type Space = { space_id: string; name: string; role: string };
type Access = { resident_id: string; can_configure: boolean; can_share_location: boolean };
type Member = { user_id: string; email: string; role: string; access: Access[] };
type Invitation = { id: string; email: string; role: string; expires_at: string };
type Resident = { id: string; full_name: string };
const roles: Record<string, string> = { admin: "Administrador", caregiver: "Cuidador", resident: "Persona cuidada" };

function TeamSelect({ icon: LeadingIcon, children, id, value, disabled, onChange }: SelectHTMLAttributes<HTMLSelectElement> & { icon: LucideIcon }) {
  const options = Children.toArray(children).filter(isValidElement<{ value: string; children: string } >).map(option => option.props);
  const placeholder = options.find(option => option.value === "")?.children;
  return <span className="team-select"><Select.Root value={String(value ?? "")} disabled={disabled} onValueChange={next => {
    // Keep the existing field handlers; they consume only the selected value.
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
  }}><Select.Trigger id={id} className="team-select-trigger"><LeadingIcon size={17} aria-hidden="true"/><Select.Value placeholder={placeholder}/><Select.Icon className="team-trigger-chevron"><ChevronDown size={16}/></Select.Icon></Select.Trigger><Select.Portal><Select.Content className="team-select-menu" position="popper" sideOffset={6} collisionPadding={12}><Select.Viewport>{options.filter(option => option.value !== "").map(option => <Select.Item key={option.value} value={String(option.value)} className="team-select-option"><Select.ItemText>{option.children}</Select.ItemText><Select.ItemIndicator><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root></span>;
}

export function TeamPanel({ session, spaces, onAccessChanged, initialResidentId, initialSpaceId, initialSection = "team" }: { session: Session; spaces: Space[]; onAccessChanged: () => void; initialResidentId?: string; initialSpaceId?: string; initialSection?: "people" | "team" }) {
  const allowed = spaces.filter(s => s.role === "admin");
  const [selected, setSelected] = useState(initialSpaceId ?? allowed[0]?.space_id ?? "");
  const space = allowed.find(s => s.space_id === selected) ?? allowed[0];
  if (!space) return <p role="alert">La administración de equipo requiere permiso de administrador.</p>;
  if (initialSpaceId && space.space_id !== initialSpaceId) return <p role="status">Tu cuenta no administra el espacio de esta ficha. No se mostrarán asignaciones de otro espacio.</p>;
  return <section aria-labelledby="team-title" className="team-workspace">
    {initialResidentId ? <h2 id="team-title" className="sr-only">Personas y equipo</h2> : <div className="cloud-section-title"><ShieldCheck size={21} /><h2 id="team-title">Personas y equipo</h2></div>}
    {allowed.length > 1 && !initialSpaceId && <label className="team-space" htmlFor="team-space">Espacio<TeamSelect id="team-space" icon={Building2} value={space.space_id} onChange={e => setSelected(e.target.value)}>{allowed.map(s => <option key={s.space_id} value={s.space_id}>{s.name}</option>)}</TeamSelect></label>}
    <TeamSpace key={space.space_id} space={space} session={session} onAccessChanged={onAccessChanged} initialResidentId={initialResidentId} initialSection={initialSection}/>
  </section>;
}

function TeamSpace({ space, session, onAccessChanged, initialResidentId, initialSection }: { space: Space; session: Session; onAccessChanged: () => void; initialResidentId?: string; initialSection: "people" | "team" }) {
  const [section, setSection] = useState<"people" | "team">(initialSection);
  const [personId, setPersonId] = useState(initialResidentId ?? "");
  const [formOpen, setFormOpen] = useState(initialSection === "team");
  const [addingCaregiver, setAddingCaregiver] = useState(false);
  const [uniformConsent, setUniformConsent] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("caregiver");
  const [chosen, setChosen] = useState<string[]>([]);
  const [configure, setConfigure] = useState(false);
  const [share, setShare] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmation, setConfirmation] = useState<{ text: string; action: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!formOpen) return;
    const unregister = registerTeamDraft();
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { unregister(); window.removeEventListener("beforeunload", warn); };
  }, [formOpen]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setLoadFailed(false); setMembers([]); setInvitations([]); setResidents([]);
    const api = accessDataClient(session.access_token);
    void (async () => {
      try {
        const team = await api.rpc("sfa_team", { p_space: space.space_id });
        if (team.error) throw team.error;
        const people = await api.from("sfa_residents").select("id,full_name").eq("space_id", space.space_id).is("archived_at", null).order("full_name");
        if (people.error) throw people.error;
        if (active) { setMembers(team.data.members); setInvitations(team.data.invitations); setResidents(people.data ?? []); }
      } catch { if (active) { setLoadFailed(true); setError("No se pudo consultar el equipo. Revisa la sesión y la conexión; no podemos confirmar las asignaciones."); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [space.space_id, session.access_token, revision]);

  async function work(action: () => Promise<string | void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await action(); setNotice(result ?? "Permisos actualizados."); setRevision(n => n + 1); }
    catch { setError("La operación no se completó. Comprueba permisos, conexión y si la cuenta ya pertenece al equipo. Actualiza antes de repetir."); }
    finally { setBusy(false); setConfirmation(null); }
  }
  async function command(name: string, body: object) {
    const { error: problem } = await accessDataClient(session.access_token).rpc(name, body);
    if (problem) throw problem;
  }
  function reset() { setEditing(null); setEmail(""); setRole("caregiver"); setChosen([]); setConfigure(false); setShare(false); setUniformConsent(false); setFormOpen(false); setAddingCaregiver(false); }
  function edit(member: Member) {
    if (formOpen && !window.confirm("Hay un formulario abierto. ¿Descartar los cambios sin guardar?")) return false;
    setFormOpen(true); setUniformConsent(false);
    setEditing(member); setEmail(member.email); setRole(member.role); setChosen(member.access.map(a => a.resident_id));
    setConfigure(member.access.some(a => a.can_configure)); setShare(member.access.some(a => a.can_share_location));
    return true;
  }
  async function save() {
    const selected = role === "admin" ? [] : chosen;
    if (editing) {
      await command("sfa_set_team_access", { p_space: space.space_id, p_user: editing.user_id, p_residents: selected,
        p_configure: role === "caregiver" && configure, p_share: role !== "admin" && share });
      reset(); return "Asignación de residentes guardada.";
    }
    const result = await accessDataClient(session.access_token).functions.invoke("sfa-team-invite", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { space_id: space.space_id, email: email.trim(), role, resident_ids: selected,
        can_configure: role === "caregiver" && configure, can_share_location: role !== "admin" && share },
    });
    if (result.error || !result.data?.invitation_id) throw new Error("invite_failed");
    reset();
    return result.data.mail_sent ? "Invitación guardada y correo enviado. El acceso se aplica al ingresar con el correo verificado."
      : "Invitación guardada, pero no se confirmó el envío del correo. Si la persona ya tiene cuenta, puede ingresar al portal. Si no, revisa el servicio de invitaciones antes de continuar.";
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (role !== "admin" && (!chosen.length || role === "resident" && chosen.length !== 1 || chosen.some(id => !residents.some(r => r.id === id)))) return;
    if (mixedPermissions && !uniformConsent) return;
    if (editing && role === "resident" && (editing.access.length !== 1 || editing.access[0].resident_id !== chosen[0])) setConfirmation({ text: `Cambiarás la ficha que representa ${email} a ${residents.find(r => r.id === chosen[0])?.full_name}. Comprueba que la cuenta corresponde a esa persona.`, action: async () => { await work(save); } });
    else if (!editing && role === "admin") setConfirmation({ text: `Darás acceso administrativo a todo este espacio a ${email}.`, action: async () => { await work(save); } });
    else void work(save);
  }
  const person = residents.find(r => r.id === personId);
  const mixedPermissions = !!editing && new Set(editing.access.map(a => `${a.can_configure}:${a.can_share_location}`)).size > 1;
  const related = person ? members.filter(m => m.role !== "admin" && m.access.some(a => a.resident_id === person.id)) : [];
  const availableCaregivers = person ? members.filter(m => m.role === "caregiver" && !m.access.some(a => a.resident_id === person.id)) : [];
  function inviteForPerson(nextRole: "caregiver" | "resident") {
    if (!person) return;
    if (formOpen && !window.confirm("Hay un formulario abierto. ¿Descartar los cambios sin guardar?")) return;
    reset(); setRole(nextRole); setChosen([person.id]); setShare(nextRole === "resident"); setFormOpen(true);
    window.setTimeout(() => document.getElementById("team-email")?.focus(), 0);
  }
  return <>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {loadFailed && <button className="access-secondary" disabled={busy} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/>Reintentar consulta</button>}
    {notice && <p role="status" className="team-notice"><Check size={18} />{notice}</p>}
    <nav className="people-team-tabs" aria-label="Personas y equipo"><button disabled={busy} aria-pressed={section === "people"} onClick={() => { if (section === "people") return; if (formOpen && !window.confirm("Hay un formulario abierto. ¿Descartar los cambios sin guardar?")) return; reset(); setSection("people"); }}><UserRound size={17}/>Fichas</button><button disabled={busy} aria-pressed={section === "team"} onClick={() => { if (section === "team") return; if (formOpen && !window.confirm("Hay un formulario abierto. ¿Descartar los cambios sin guardar?")) return; reset(); setSection("team"); }}><UsersRound size={17}/>Equipo y accesos</button></nav>
    {section === "people" && <section className="person-access-summary" aria-label="Cuidado y acceso de la persona">
      {!initialResidentId && <div className="team-field person-picker"><label htmlFor="team-person">Persona cuidada</label><TeamSelect icon={UserRound} id="team-person" value={personId} disabled={busy || loading} onChange={e => { if (formOpen && !window.confirm("Hay un formulario abierto. ¿Descartar los cambios sin guardar?")) return; setPersonId(e.target.value); reset(); }}><option value="">Seleccionar ficha</option>{residents.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}</TeamSelect></div>}
      {loading && <p role="status">Consultando cuidadores y acceso…</p>}
      {!loading && !loadFailed && initialResidentId && !person && <p role="alert" className="cloud-warning">La ficha vinculada no está disponible en este espacio. No se seleccionará otra persona automáticamente.</p>}
      {person && !loadFailed && <><h3>{person.full_name}</h3><div className="person-access-columns"><section><h4>Cuidadores asignados</h4>
        {related.some(m => m.role === "caregiver") ? <ul>{related.filter(m => m.role === "caregiver").map(m => <li key={m.user_id}><span>{m.email}</span><button className="access-secondary" disabled={busy || loading} onClick={() => edit(m)}>Permisos</button></li>)}</ul> : <p className="person-state">Sin cuentas de cuidador asignadas. Los administradores del espacio también tienen acceso.</p>}
        {!addingCaregiver && <button className="access-secondary" disabled={busy || loading} onClick={() => setAddingCaregiver(true)}><UserPlus size={16}/>Añadir cuidador</button>}
        {addingCaregiver && <div className="caregiver-choices">{availableCaregivers.length > 0 && <div className="team-field"><label htmlFor="team-caregiver">Elegir una cuenta existente</label><TeamSelect icon={UsersRound} id="team-caregiver" value="" disabled={busy || loading} onChange={e => { const member = availableCaregivers.find(m => m.user_id === e.target.value); if (member && edit(member)) setChosen([...new Set([...member.access.map(a => a.resident_id), person.id])]); }}><option value="">Seleccionar del equipo</option>{availableCaregivers.map(m => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}</TeamSelect></div>}
        <button className="access-secondary" disabled={busy || loading} onClick={() => inviteForPerson("caregiver")}><Mail size={16}/>Invitar una cuenta nueva</button><button className="team-text-action" disabled={busy} onClick={() => setAddingCaregiver(false)}>Cerrar opciones</button></div>}</section>
        <section><h4>Cuenta de la persona</h4>{related.some(m => m.role === "resident") ? <ul>{related.filter(m => m.role === "resident").map(m => <li key={m.user_id}><div><span>{m.email}</span><small>Esta cuenta corresponde a {person.full_name}</small></div><button className="access-secondary" disabled={busy || loading} onClick={() => edit(m)}>Permisos</button></li>)}</ul> : <p className="person-state">Sin cuenta personal vinculada.</p>}
        <button className="access-secondary" disabled={busy || loading} onClick={() => inviteForPerson("resident")}><Mail size={16}/>Dar acceso a esta persona</button></section></div>
        <details className="person-admins"><summary>Administradores con acceso ({members.filter(m => m.role === "admin").length})</summary><ul>{members.filter(m => m.role === "admin").map(m => <li key={m.user_id}>{m.email}</li>)}</ul></details>
        {invitations.length > 0 && <p className="team-pending">Hay {invitations.length} {invitations.length === 1 ? "invitación pendiente" : "invitaciones pendientes"} en el espacio. Esta vista no permite confirmar a qué ficha corresponden.</p>}</>}
    </section>}
    {section === "team" && !formOpen && <button className="access-primary team-new-account" disabled={busy || loading || loadFailed} onClick={() => { reset(); setFormOpen(true); }}><UserPlus size={17}/>Invitar una cuenta</button>}
    <div className={`team-layout${section === "people" ? " person-form-layout" : ""}`}>
      {section === "team" &&
      <div>
        <div className="team-list-heading"><h3>Miembros de {space.name}</h3><button className="access-secondary" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Actualizar</button></div>
        {loading ? <p role="status">Consultando equipo…</p> : <ul className="team-members">{members.map(member => <li key={member.user_id}>
          <div><strong>{member.email}</strong><span>{roles[member.role]}{member.user_id === session.user.id ? " · Tu cuenta" : ""}</span>
            <p>{member.role === "admin" ? "Administra todas las fichas del espacio" : `${member.role === "resident" ? "Esta cuenta corresponde a" : "Cuida a"}: ${member.access.map(a => residents.find(r => r.id === a.resident_id)?.full_name).filter(Boolean).join(", ") || "Sin ficha disponible"}`}</p></div>
          <div className="team-row-actions">{member.role !== "admin" && <button className="access-secondary" disabled={busy} onClick={() => edit(member)}><ShieldCheck size={16} />Permisos</button>}
            <button className="access-secondary team-danger" disabled={busy || member.user_id === session.user.id} onClick={() => setConfirmation({ text: `Revocarás el acceso de ${member.email} a este espacio. No se borran sus registros.`, action: async () => { await work(async () => {
              await command("sfa_revoke_team_member", { p_space: space.space_id, p_user: member.user_id });
              if (editing?.user_id === member.user_id) reset();
              return "Acceso revocado. Los registros se conservan.";
            }); } })}><UserRoundX size={16} />Revocar</button></div>
        </li>)}</ul>}
        <h3>Invitaciones pendientes</h3>
        {!loading && !loadFailed && !invitations.length && <p className="cloud-footnote">Sin invitaciones pendientes.</p>}
        <ul className="team-members">{invitations.map(invite => <li key={invite.id}><div><strong>{invite.email}</strong><span>{roles[invite.role]} · Vence {new Date(invite.expires_at).toLocaleDateString("es")}</span></div>
          <button className="access-secondary" disabled={busy} onClick={() => setConfirmation({ text: `Cancelarás la invitación de ${invite.email}.`, action: async () => { await work(async () => {
            await command("sfa_cancel_team_invite", { p_space: space.space_id, p_invitation: invite.id }); return "Invitación cancelada.";
          }); } })}><X size={16} />Cancelar</button></li>)}</ul>
      </div>}
      {formOpen && <form className="team-form" onSubmit={submit}>
        <div className="cloud-section-title"><UserPlus size={20} /><h3>{editing ? "Asignar permisos" : "Invitar al equipo"}</h3></div>
        {editing && person && section === "people" && <p className="team-draft" role="status">Cambios sin guardar para {editing.email}. Revisa las personas y permisos antes de guardar.</p>}
        <div className="team-fields"><div className="team-field"><label htmlFor="team-email">Correo electrónico</label><span className="team-email-field"><Mail size={17} aria-hidden="true"/><input id="team-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy || Boolean(editing)} autoComplete="off" /></span></div>
        <div className="team-field"><label htmlFor="team-role">Rol</label><TeamSelect id="team-role" icon={ShieldCheck} value={role} disabled={busy || Boolean(editing)} onChange={e => { setRole(e.target.value); setChosen([]); setConfigure(false); setShare(e.target.value === "resident"); }}>
          <option value="caregiver">Cuidador</option><option value="resident">Persona cuidada</option><option value="admin">Administrador</option>
        </TeamSelect></div></div>
        {role === "admin" ? <p className="cloud-warning">Este rol administra todos los residentes y permisos del espacio.</p> : <>
          <fieldset className="team-assignments" disabled={busy || loading}><legend>{role === "resident" ? "Ficha a la que corresponde esta cuenta" : "Personas que podrá cuidar"}</legend>{!residents.length && <p>No hay residentes disponibles.</p>}
            {residents.map(resident => <label className="team-check team-assignment" key={resident.id}><input type={role === "resident" ? "radio" : "checkbox"} name={role === "resident" ? "resident-identity" : undefined} checked={chosen.includes(resident.id)} onChange={e => setChosen(previous => e.target.checked ? role === "resident" ? [resident.id] : [...previous, resident.id] : previous.filter(id => id !== resident.id))} /><UserRound size={17} aria-hidden="true"/><span>{resident.full_name}</span></label>)}
          </fieldset>
          {role === "caregiver" && <label className="team-check team-permission"><input type="checkbox" checked={configure} disabled={busy} onChange={e => setConfigure(e.target.checked)} />Permitir configuración de los residentes asignados</label>}
          <label className="team-check team-permission"><input type="checkbox" checked={share} disabled={busy} onChange={e => setShare(e.target.checked)} />Permitir vincular un celular de esta cuenta como emisor GPS</label>
        </>}
        {mixedPermissions && <label className="team-check cloud-warning"><input type="checkbox" checked={uniformConsent} disabled={busy} onChange={e => setUniformConsent(e.target.checked)} />Aplicar los permisos de configuración y GPS de este formulario a todas las personas seleccionadas. Las asignaciones actuales tienen permisos distintos.</label>}
        <div className="cloud-actions"><button className="access-primary" disabled={busy || loading || (role !== "admin" && !chosen.length) || mixedPermissions && !uniformConsent}><Mail size={17} />{editing ? "Guardar permisos" : "Crear invitación"}</button>
          <button type="button" className="access-secondary" disabled={busy} onClick={() => { reset(); setFormOpen(false); }}><X size={16} />{editing ? "Cancelar edición" : "Cerrar formulario"}</button></div>
        <p className="cloud-footnote">La ficha de residente y la cuenta son distintas. Las invitaciones vencen a los siete días. Cambiar permisos no borra historiales.</p>
      </form>}
    </div>
    {confirmation && <div className="team-dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="team-confirm-title" aria-describedby="team-confirm-text" className="team-dialog" onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); setConfirmation(null); }
      if (event.key === "Tab") {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        if (!buttons.length) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    }}>
      <h3 id="team-confirm-title">Confirmar cambio de acceso</h3><p id="team-confirm-text">{confirmation.text}</p>
      <div className="cloud-actions"><button className="access-secondary" autoFocus disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button className="access-primary" disabled={busy} onClick={() => void confirmation.action()}><Save size={17} />Confirmar</button></div>
    </section></div>}
    <button className="access-secondary team-refresh-access" disabled={busy || formOpen} onClick={onAccessChanged}><RefreshCw size={16} />Revalidar mis permisos</button>
  </>;
}
