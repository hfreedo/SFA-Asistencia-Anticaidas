import "./draftConfirm.css";

const openDrafts = new Set<symbol>();
let dismissPending: (() => void) | undefined;
let acceptedDrafts: ReadonlySet<symbol> | undefined;

export function registerTeamDraft() {
  const draft = Symbol("team-draft");
  openDrafts.add(draft);
  return () => { openDrafts.delete(draft); if (!openDrafts.size) dismissPending?.(); };
}

type Confirmation = { title:string; description:string; confirmLabel:string };
export function confirmAction(action:()=>void, options:Confirmation) { withTeamDraftExit(action,options); }
export function withTeamDraftExit(action: () => void, confirmation?:Confirmation) {
  if (!confirmation && (!openDrafts.size || acceptedDrafts && [...openDrafts].every(draft=>acceptedDrafts!.has(draft)))) { action(); return; }
  // A second request must not queue another navigation behind the same consent.
  if (dismissPending) return;
  const draftsAtRequest = new Set(openDrafts);
  const previousFocus = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "draft-confirm";
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-labelledby", "draft-confirm-title");
  dialog.setAttribute("aria-describedby", "draft-confirm-description");
  dialog.setAttribute("aria-modal", "true");
  const title = document.createElement("h2");
  title.id = "draft-confirm-title";
  title.textContent = confirmation?.title ?? "¿Salir de la edición?";
  const description = document.createElement("p");
  description.id = "draft-confirm-description";
  description.textContent = confirmation?.description ?? "Hay un formulario abierto. Si sales, los cambios sin guardar se perderán.";
  const actions = document.createElement("div");
  actions.className = "draft-confirm-actions";
  const stay = document.createElement("button");
  stay.type = "button";
  stay.className = "draft-confirm-stay";
  stay.textContent = confirmation ? "Cancelar" : "Seguir editando";
  const discard = document.createElement("button");
  discard.type = "button";
  discard.textContent = confirmation?.confirmLabel ?? "Descartar cambios";
  const finish = (accepted: boolean) => {
    if (!dialog.isConnected) return;
    dismissPending = undefined;
    dialog.close(); dialog.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    if (accepted) {
      // Nested navigation guards share this consent only for the current call chain.
      const previousAccepted = acceptedDrafts;
      acceptedDrafts = draftsAtRequest;
      try { action(); } finally { acceptedDrafts = previousAccepted; }
    }
  };
  dismissPending = () => finish(false);
  stay.onclick = () => finish(false);
  discard.onclick = () => finish(true);
  dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
  actions.append(stay, discard);
  dialog.append(title, description, actions);
  document.body.append(dialog);
  dialog.showModal();
  stay.focus();
}

export function hasTeamDraft() { return openDrafts.size > 0; }
