const openDrafts = new Set<symbol>();

export function registerTeamDraft() {
  const draft = Symbol("team-draft");
  openDrafts.add(draft);
  return () => { openDrafts.delete(draft); };
}

export function confirmTeamDraftExit() {
  return openDrafts.size === 0 || window.confirm("Hay un formulario de equipo abierto. ¿Descartar los cambios sin guardar?");
}

export function hasTeamDraft() { return openDrafts.size > 0; }
