import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Check, Mail, RefreshCw, Save, ShieldCheck, UserPlus, UserRoundX, X } from "lucide-react";
import { accessDataClient } from "./accessClient";

type Space = { space_id: string; name: string; role: string };
type Access = { resident_id: string; can_configure: boolean; can_share_location: boolean };
type Member = { user_id: string; email: string; role: string; access: Access[] };
type Invitation = { id: string; email: string; role: string; expires_at: string };
type Resident = { id: string; full_name: string };
const roles: Record<string, string> = { admin: "Administrador", caregiver: "Cuidador", resident: "Persona cuidada" };

export function TeamPanel({ session, spaces, onAccessChanged }: { session: Session; spaces: Space[]; onAccessChanged: () => void }) {
  const allowed = spaces.filter(s => s.role === "admin");
  const [selected, setSelected] = useState(allowed[0]?.space_id ?? "");
  const space = allowed.find(s => s.space_id === selected) ?? allowed[0];
  if (!space) return <p role="alert">La administración de equipo requiere permiso de administrador.</p>;
  return <section aria-labelledby="team-title" className="team-workspace">
    <div className="cloud-section-title"><ShieldCheck size={21} /><h2 id="team-title">Equipo y permisos</h2></div>
    {allowed.length > 1 && <label className="team-space">Espacio<select value={space.space_id} onChange={e => setSelected(e.target.value)}>{allowed.map(s => <option key={s.space_id} value={s.space_id}>{s.name}</option>)}</select></label>}
    <TeamSpace key={space.space_id} space={space} session={session} onAccessChanged={onAccessChanged} />
  </section>;
}

function TeamSpace({ space, session, onAccessChanged }: { space: Space; session: Session; onAccessChanged: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("caregiver");
  const [chosen, setChosen] = useState<string[]>([]);
  const [configure, setConfigure] = useState(false);
  const [share, setShare] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [confirmation, setConfirmation] = useState<{ text: string; action: () => Promise<void> } | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setMembers([]); setInvitations([]); setResidents([]);
    const api = accessDataClient(session.access_token);
    void (async () => {
      try {
        const team = await api.rpc("sfa_team", { p_space: space.space_id });
        if (team.error) throw team.error;
        const people = await api.from("sfa_residents").select("id,full_name").eq("space_id", space.space_id).is("archived_at", null).order("full_name");
        if (people.error) throw people.error;
        if (active) { setMembers(team.data.members); setInvitations(team.data.invitations); setResidents(people.data ?? []); }
      } catch { if (active) setError("No se pudo consultar el equipo. Revisa la sesión y que la etapa de permisos esté habilitada."); }
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
  function reset() { setEditing(null); setEmail(""); setRole("caregiver"); setChosen([]); setConfigure(false); setShare(false); }
  function edit(member: Member) {
    setEditing(member); setEmail(member.email); setRole(member.role); setChosen(member.access.map(a => a.resident_id));
    setConfigure(member.access.some(a => a.can_configure)); setShare(member.access.some(a => a.can_share_location));
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
    if (!editing && role === "admin") setConfirmation({ text: `Darás acceso administrativo a todo este espacio a ${email}.`, action: async () => { await work(save); } });
    else void work(save);
  }
  return <>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {notice && <p role="status" className="team-notice"><Check size={18} />{notice}</p>}
    <div className="team-layout">
      <div>
        <div className="team-list-heading"><h3>Miembros de {space.name}</h3><button className="access-secondary" disabled={busy || loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Actualizar</button></div>
        {loading ? <p role="status">Consultando equipo…</p> : <ul className="team-members">{members.map(member => <li key={member.user_id}>
          <div><strong>{member.email}</strong><span>{roles[member.role]}{member.user_id === session.user.id ? " · Tu cuenta" : ""}</span>
            <p>{member.role === "admin" ? "Todos los residentes del espacio" : member.access.map(a => residents.find(r => r.id === a.resident_id)?.full_name).filter(Boolean).join(", ") || "Sin residentes asignados"}</p></div>
          <div className="team-row-actions">{member.role !== "admin" && <button className="access-secondary" disabled={busy} onClick={() => edit(member)}><ShieldCheck size={16} />Permisos</button>}
            <button className="access-secondary team-danger" disabled={busy || member.user_id === session.user.id} onClick={() => setConfirmation({ text: `Revocarás el acceso de ${member.email} a este espacio. No se borran sus registros.`, action: async () => { await work(async () => {
              await command("sfa_revoke_team_member", { p_space: space.space_id, p_user: member.user_id });
              if (editing?.user_id === member.user_id) reset();
              return "Acceso revocado. Los registros se conservan.";
            }); } })}><UserRoundX size={16} />Revocar</button></div>
        </li>)}</ul>}
        <h3>Invitaciones pendientes</h3>
        {!loading && !invitations.length && <p className="cloud-footnote">Sin invitaciones pendientes.</p>}
        <ul className="team-members">{invitations.map(invite => <li key={invite.id}><div><strong>{invite.email}</strong><span>{roles[invite.role]} · Vence {new Date(invite.expires_at).toLocaleDateString("es")}</span></div>
          <button className="access-secondary" disabled={busy} onClick={() => setConfirmation({ text: `Cancelarás la invitación de ${invite.email}.`, action: async () => { await work(async () => {
            await command("sfa_cancel_team_invite", { p_space: space.space_id, p_invitation: invite.id }); return "Invitación cancelada.";
          }); } })}><X size={16} />Cancelar</button></li>)}</ul>
      </div>
      <form className="team-form" onSubmit={submit}>
        <div className="cloud-section-title"><UserPlus size={20} /><h3>{editing ? "Asignar permisos" : "Invitar al equipo"}</h3></div>
        <label>Correo electrónico<input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy || Boolean(editing)} autoComplete="off" /></label>
        <label>Rol<select value={role} disabled={busy || Boolean(editing)} onChange={e => { setRole(e.target.value); setChosen([]); setConfigure(false); setShare(e.target.value === "resident"); }}>
          <option value="caregiver">Cuidador</option><option value="resident">Persona cuidada</option><option value="admin">Administrador</option>
        </select></label>
        {role === "admin" ? <p className="cloud-warning">Este rol administra todos los residentes y permisos del espacio.</p> : <>
          <fieldset disabled={busy || loading}><legend>Residentes asignados</legend>{!residents.length && <p>No hay residentes disponibles.</p>}
            {residents.map(resident => <label className="team-check" key={resident.id}><input type="checkbox" checked={chosen.includes(resident.id)} onChange={e => setChosen(previous => e.target.checked ? role === "resident" ? [resident.id] : [...previous, resident.id] : previous.filter(id => id !== resident.id))} />{resident.full_name}</label>)}
          </fieldset>
          {role === "caregiver" && <label className="team-check"><input type="checkbox" checked={configure} disabled={busy} onChange={e => setConfigure(e.target.checked)} />Permitir configuración de los residentes asignados</label>}
          <label className="team-check"><input type="checkbox" checked={share} disabled={busy} onChange={e => setShare(e.target.checked)} />Permitir vincular este celular como emisor GPS</label>
        </>}
        <div className="cloud-actions"><button className="access-primary" disabled={busy || loading || (role !== "admin" && !chosen.length)}><Mail size={17} />{editing ? "Guardar permisos" : "Crear invitación"}</button>
          {editing && <button type="button" className="access-secondary" disabled={busy} onClick={reset}><X size={16} />Cancelar edición</button>}</div>
        <p className="cloud-footnote">La ficha de residente y la cuenta son distintas. Las invitaciones vencen a los siete días. Cambiar permisos no borra historiales.</p>
      </form>
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
    <button className="access-secondary team-refresh-access" disabled={busy} onClick={onAccessChanged}><RefreshCw size={16} />Revalidar mis permisos</button>
  </>;
}
