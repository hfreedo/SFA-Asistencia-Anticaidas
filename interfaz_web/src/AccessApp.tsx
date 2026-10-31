import { useEffect, useState, type FormEvent } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Eye, EyeOff, KeyRound, LayoutDashboard, LoaderCircle, LogOut, Mail, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import { accessClient as client, accessDataClient, configurationProblem } from "./accessClient";
import { accessFailure, accessUrl, callbackMode, passwordProblem, type AccessMode } from "./authPolicy";
import "./access.css";
import "./disclosure.css";
import projectLogo from "./assets/sfa-asistencia-logo.png";
import { LocalSync, RemoteMonitor } from "./RemoteMonitor";
import { isLocalPortal } from "./cloudPolicy";
import { TeamPanel } from "./TeamPanel";
import { withTeamDraftExit } from "./teamDraftGuard";
import { LocalCareLink } from "./LocalCareLink";

type Membership = { space_id: string; role: string; name: string };
const INITIAL_MODE = callbackMode(window.location.search, window.location.hash);
const LABELS: Record<string, string> = { admin: "Administrador", caregiver: "Cuidador", resident: "Persona cuidada" };

export function AccessApp({ embedded = false, activeResidentId, initialView = "monitor", personContext, suggestedPerson, onAccountChange, onManagePeople }: { embedded?: boolean; activeResidentId?: number; initialView?: "monitor" | "people"; personContext?: { resident_id: string; space_id: string }; suggestedPerson?: {resident_id:string;space_id:string}; onAccountChange?:(id:string|null)=>void; onManagePeople?:()=>void }) {
  const [mode, setMode] = useState<AccessMode>(INITIAL_MODE);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [initializing, setInitializing] = useState(Boolean(client));
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(configurationProblem ?? "");
  const [notice, setNotice] = useState("");
  const [errorReference, setErrorReference] = useState("");
  const [view, setView] = useState<"monitor" | "people">(initialView);
  const [permissionRevision, setPermissionRevision] = useState(0);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setUser(null);
      setMemberships([]);
      setChecking(Boolean(next));
      if (event === "PASSWORD_RECOVERY") setMode("password");
    });
    void client.auth.getSession().then(({ data, error: problem }) => {
      if (!active) return;
      if (problem || (INITIAL_MODE === "password" && !data.session)) {
        setError("El enlace no es válido o ha vencido. Solicita una nueva invitación.");
      }
      setSession(data.session);
      setInitializing(false);
    }).catch(() => {
      if (active) { setError("No se pudo conectar con el servicio de acceso."); setInitializing(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!client || !session) { setChecking(false); return; }
    let active = true;
    setChecking(true);
    void (async () => {
      try {
        const { data, error: identityError } = await client.auth.getUser(session.access_token);
        if (identityError || !data.user) throw accessFailure("IDENTITY", identityError);
        const dataClient = accessDataClient(session.access_token);
        const enrollment = await dataClient.rpc("sfa_accept_team_invites");
        // Existing deployments remain usable until the restricted team migration is applied.
        if (enrollment.error && enrollment.error.code !== "PGRST202") throw accessFailure("INVITATION", enrollment.error);
        const { data: links, error: linkError } = await dataClient.from("sfa_memberships")
          .select("space_id,role").eq("user_id", data.user.id).is("revoked_at", null);
        if (linkError) throw accessFailure("MEMBERSHIP", linkError);
        let names: { id: string; name: string }[] = [];
        if (links?.length) {
          const result = await dataClient.from("sfa_spaces").select("id,name").in("id", links.map(link => link.space_id));
          if (result.error) throw accessFailure("SPACE", result.error);
          names = result.data ?? [];
        }
        if (!active) return;
        setUser(data.user);
        setError(""); setErrorReference("");
        setMemberships((links ?? []).map(link => ({ ...link, name: names.find(space => space.id === link.space_id)?.name ?? "Espacio de cuidado" })));
      } catch (problem) {
        if (active) {
          setUser(null); setMemberships([]);
          const reference = problem instanceof Error && /^(IDENTITY|INVITATION|MEMBERSHIP|SPACE):[A-Za-z0-9_]+$/.test(problem.message)
            ? problem.message : "CONNECTION:REQUEST";
          setErrorReference(reference);
          setError("No pudimos verificar tu sesión y permisos. Comprueba la conexión e inicia sesión nuevamente.");
        }
      } finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [session, permissionRevision]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    setError(""); setNotice(""); setErrorReference("");
    if (mode === "password") {
      const problem = passwordProblem(password, confirmation);
      if (problem) { setError(problem); return; }
      if (!user) { setError("Abre un enlace de invitación o recuperación válido para continuar."); return; }
    }
    setBusy(true);
    try {
      if (mode === "recovery") {
        const { error: problem } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: accessUrl(embedded ? new URL("/acceso/acceso.html", window.location.origin).href : window.location.href, true),
        });
        if (problem) throw new Error("recovery");
        setNotice("Si la cuenta está habilitada, recibirás un correo para recuperar el acceso.");
      } else if (mode === "password") {
        const { error: problem } = await client.auth.updateUser({ password });
        if (problem) throw new Error("password");
        setMode("login");
        if (!embedded) window.history.replaceState({}, "", accessUrl(window.location.href));
        setNotice("Contraseña guardada. Tu sesión está activa.");
      } else {
        const { error: problem } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (problem) throw new Error("login");
      }
    } catch {
      setError(mode === "login" ? "No se pudo iniciar sesión. Revisa tus datos y la conexión." :
        mode === "password" ? "No se pudo guardar la contraseña. Comprueba el enlace y utiliza una contraseña nueva de al menos 12 caracteres." :
          "No se pudo solicitar el correo. Inténtalo más tarde.");
    } finally { setPassword(""); setConfirmation(""); setBusy(false); }
  }

  async function logout() {
    if (!client) return;
    setBusy(true); setError("");
    try {
      if (isLocalPortal(window.location) || (embedded && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname))) {
        const paused = await fetch(memberships.some(m => m.role === "admin") ? "/api/cloud/pause" : "/api/cloud/monitor/pause", { method: "POST" });
        if (!paused.ok) throw new Error("pause");
      }
      const { error: problem } = await client.auth.signOut({ scope: "local" });
      if (problem) throw problem;
      setSession(null); setUser(null); setMemberships([]); setMode("login"); setNotice("");
      if (!embedded) window.history.replaceState({}, "", accessUrl(window.location.href));
    } catch { setError("No se pudo cerrar la sesión. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  const pending = initializing || checking;
  const signedIn = Boolean(user && mode !== "password");
  const directoryView=embedded && initialView === "people";
  const managesContext=memberships.some(m=>m.role === "admin" && (!personContext || m.space_id === personContext.space_id));
  useEffect(()=>{onAccountChange?.(signedIn ? user!.id : null);},[signedIn,user?.id,onAccountChange]);
  const title = signedIn ? "Tu espacio de cuidado" : mode === "password" ? "Establece tu contraseña" :
    mode === "recovery" ? "Recupera tu acceso" : "Bienvenido a SFA";
  const subtitle = signedIn ? "Identidad y permisos verificados." : mode === "password" ?
    "Elige una contraseña personal para proteger tu cuenta." : mode === "recovery" ?
      "Te enviaremos un enlace al correo de tu cuenta." : "Ingresa con la cuenta que recibió la invitación.";

  const accountIdentity = <><p className="access-account-email"><Mail size={18} />{user?.email}</p>
    {memberships.length ? <ul>{memberships.map(link => <li key={link.space_id}><ShieldCheck size={20} /><div><strong>{link.name}</strong><span>{LABELS[link.role] ?? "Acceso autorizado"}</span></div></li>)}</ul> :
      <p className="access-no-membership">Tu cuenta está verificada, pero aún no tiene un espacio asignado. El administrador debe autorizar tu vínculo.</p>}{(personContext || directoryView) && <button type="button" className="access-secondary access-signout" disabled={busy} onClick={() => withTeamDraftExit(() => { void logout(); })}><LogOut size={17} />Cerrar sesión</button>}</>;
  return <div role={embedded ? undefined : "main"} className={`${embedded ? "sfa-access embedded-access" : "sfa-access"}${personContext ? " person-context" : ""}`}>
    {!embedded && <div className="access-topline"><a className="access-brand" href={accessUrl(window.location.href)} aria-label="SFA Asistencia, inicio">
      <img src={projectLogo} alt="" />
      <span><b>SFA</b><em>Asistencia</em></span>
    </a><span className="access-context"><ShieldCheck size={17} /> Acceso personal</span></div>}
    <section className={`access-workspace${signedIn ? " is-account" : ""}`} aria-labelledby="access-title">
      {!((personContext || directoryView) && signedIn) && <div className="access-heading"><span className="access-symbol"><ShieldCheck size={25} /></span>
        <p className="access-eyebrow">PLATAFORMA DE TELEASISTENCIA</p>
        {embedded ? <h2 id="access-title">Acceso por internet</h2> : <h1 id="access-title">{title}</h1>}<p>{subtitle}</p></div>}
      {(personContext || directoryView) && signedIn && <h2 id="access-title" className="sr-only">Cuidadores y acceso de esta ficha</h2>}
      <div className="access-form-area">
        {error && <div className="access-feedback is-error" role="alert"><WifiOff size={18} /><span>{error}{errorReference && <small>Referencia de soporte: {errorReference}</small>}</span></div>}
        {notice && <div className="access-feedback" role="status"><Check size={18} /><span>{notice}</span></div>}
        {pending ? <div className="access-progress" role="status"><LoaderCircle className="access-spin" size={24} /> Verificando acceso…</div> :
          signedIn ? <div className="access-account">{personContext || directoryView ? <details className="person-account-details sfa-disclosure"><summary><ShieldCheck size={16}/><span>Cuenta <span className="disclosure-meta">{user?.email}</span></span><ChevronRight className="disclosure-chevron" size={16}/></summary><div className="account-details-body">{accountIdentity}</div></details> : embedded ? <div className="access-identity-compact" aria-label="Cuenta conectada">{accountIdentity}</div> : accountIdentity}
            {memberships.length > 0 && session && <>
              {!personContext && !directoryView && <nav className="portal-navigation" aria-label="Vistas del espacio">
                <button aria-pressed={view === "monitor"} onClick={() => { if (view !== "monitor") withTeamDraftExit(() => setView("monitor")); }}><LayoutDashboard size={18} />{embedded ? "Monitoreo de esta PC" : memberships.some(m => m.role === "admin" || m.role === "caregiver") ? "Monitoreo" : "Mi estado"}</button>
                {memberships.some(m => m.role === "admin") && (!embedded ? <button aria-pressed={view === "people"} onClick={() => withTeamDraftExit(()=>setView("people"))}><UsersRound size={18} />Personas y accesos</button> : onManagePeople && <button onClick={() => withTeamDraftExit(onManagePeople)}><UsersRound size={18} />Gestionar personas y accesos<ArrowRight size={16}/></button>)}
              </nav>}
              {view === "people" && managesContext ? <TeamPanel session={session} spaces={memberships} initialResidentId={personContext?.resident_id} initialSpaceId={personContext?.space_id} suggestedPerson={suggestedPerson} initialSection="people" onAccessChanged={() => setPermissionRevision(n => n + 1)} /> : embedded
                ? managesContext
                  ? activeResidentId ? <><LocalCareLink session={session} localId={activeResidentId}/><details className="access-emitter sfa-disclosure"><summary><LayoutDashboard size={16}/><span>Emisor PC · crear y sincronizar una ficha nueva</span><ChevronRight className="disclosure-chevron" size={16}/></summary><LocalSync key={`${user?.id}:${activeResidentId}`} session={session} spaces={memberships.filter(m => m.role === "admin")} activeResidentId={activeResidentId} /></details></> : <p className="access-stage-note">Selecciona un perfil local antes de vincular esta PC.</p>
                  : memberships.some(m => m.role === "caregiver") && !personContext && !directoryView ? <LocalCareLink session={session} localId={activeResidentId}/> : <p className="access-stage-note">{memberships.some(m=>m.role === "resident") ? "Tu cuenta corresponde a una persona cuidada. " : "Tu cuenta puede consultar únicamente sus fichas autorizadas. "}Un administrador de este espacio gestiona las cuentas y asignaciones; consultar no comparte tu ubicación.</p>
                : <RemoteMonitor session={session} spaces={memberships} />}
            </>}
            {!personContext && !directoryView && <button type="button" className="access-secondary access-signout" disabled={busy} onClick={() => withTeamDraftExit(() => { void logout(); })}><LogOut size={17} />Cerrar sesión</button>}
          </div> : <form onSubmit={event => void submit(event)}>
            {mode !== "password" && <label htmlFor="access-email">Correo electrónico<div className="access-input"><Mail size={18} /><input id="access-email" name="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} disabled={busy || !client} /></div></label>}
            {mode !== "recovery" && <label htmlFor="access-password">{mode === "password" ? "Nueva contraseña" : "Contraseña"}<div className="access-input"><KeyRound size={18} /><input id="access-password" name="password" type={visible ? "text" : "password"} autoComplete={mode === "password" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "password" ? 12 : undefined} disabled={busy || !client || (mode === "password" && !user)} /><button type="button" title={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
            {mode === "password" && <label htmlFor="access-confirm">Repite la contraseña<div className="access-input"><KeyRound size={18} /><input id="access-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} minLength={12} required disabled={busy || !user} /></div><small>Al menos 12 caracteres. No compartas tu contraseña.</small></label>}
            <button className="access-primary" type="submit" disabled={busy || !client || (mode === "password" && !user)}>{busy ? <LoaderCircle className="access-spin" size={19} /> : <ArrowRight size={19} />}{mode === "password" ? "Guardar contraseña" : mode === "recovery" ? "Enviar enlace" : "Iniciar sesión"}</button>
            {mode === "login" ? <button className="access-text-button" type="button" onClick={() => { setMode("recovery"); setError(""); setNotice(""); }}>Olvidé mi contraseña</button> : <button className="access-text-button" type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }}><ArrowLeft size={16} />Volver al acceso</button>}
          </form>}
      </div>
      <div className="access-bottom"><ShieldCheck size={16} /><span>Solo personas autorizadas. Sin registro público.</span></div>
    </section>
    {!embedded && <footer className="access-footer">SFA Asistencia<span>Entorno de pruebas</span></footer>}
  </div>;
}
