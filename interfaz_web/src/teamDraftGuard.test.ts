// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { withTeamDraftExit, hasTeamDraft, registerTeamDraft, confirmAction } from "./teamDraftGuard";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
it("keeps the draft unless discarding is explicitly accepted", () => {
  const action = vi.fn();
  const unregister = registerTeamDraft();
  expect(hasTeamDraft()).toBe(true);
  withTeamDraftExit(action);
  expect(action).not.toHaveBeenCalled();
  expect(document.activeElement?.textContent).toBe("Seguir editando");
  document.querySelector<HTMLButtonElement>(".draft-confirm-stay")!.click();
  expect(action).not.toHaveBeenCalled();
  withTeamDraftExit(action);
  document.querySelector<HTMLButtonElement>(".draft-confirm-actions button:last-child")!.click();
  expect(action).toHaveBeenCalledTimes(1);
  unregister();
  expect(document.querySelector("dialog")).toBeNull();
  withTeamDraftExit(action);
  expect(action).toHaveBeenCalledTimes(2);
});
it("escape cancels and duplicate requests cannot reuse consent", () => {
  const first = vi.fn(), second = vi.fn();
  const unregister = registerTeamDraft();
  withTeamDraftExit(first); withTeamDraftExit(second);
  expect(document.querySelectorAll("dialog")).toHaveLength(1);
  document.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true }));
  expect(first).not.toHaveBeenCalled(); expect(second).not.toHaveBeenCalled();
  unregister();
});
it("unmount dismisses pending consent without running a stale action", () => {
  const action = vi.fn();
  const unregister = registerTeamDraft();
  withTeamDraftExit(action); unregister();
  expect(document.querySelector("dialog")).toBeNull();
  expect(action).not.toHaveBeenCalled();
});
it("requires integrated confirmation even without an open draft",()=>{
  const importBackup=vi.fn();
  confirmAction(importBackup,{title:"Importar copia",description:"Reemplaza perfiles locales",confirmLabel:"Importar"});
  expect(importBackup).not.toHaveBeenCalled();
  expect(document.activeElement?.textContent).toBe("Cancelar");
  document.querySelector<HTMLButtonElement>(".draft-confirm-stay")!.click();
  expect(importBackup).not.toHaveBeenCalled();
});
it("discards once through nested navigation guards without disabling later protection",()=>{
  const navigate=vi.fn(), later=vi.fn();
  const unregister=registerTeamDraft();
  withTeamDraftExit(()=>withTeamDraftExit(navigate));
  document.querySelector<HTMLButtonElement>(".draft-confirm-actions button:last-child")!.click();
  expect(navigate).toHaveBeenCalledOnce();
  expect(document.querySelector("dialog")).toBeNull();
  expect(hasTeamDraft()).toBe(true);
  withTeamDraftExit(later);
  expect(later).not.toHaveBeenCalled();
  expect(document.querySelector("dialog")).not.toBeNull();
  unregister();
});
it("does not include a newly opened draft in earlier discard consent",()=>{
  const navigate=vi.fn();
  const unregister=registerTeamDraft();
  let unregisterNew=()=>{};
  withTeamDraftExit(()=>{unregisterNew=registerTeamDraft();withTeamDraftExit(navigate);});
  document.querySelector<HTMLButtonElement>(".draft-confirm-actions button:last-child")!.click();
  expect(navigate).not.toHaveBeenCalled();
  expect(document.querySelector("dialog")).not.toBeNull();
  unregister();unregisterNew();
});
it("does not bypass explicit action confirmation after accepting draft discard",()=>{
  const action=vi.fn();
  const unregister=registerTeamDraft();
  withTeamDraftExit(()=>confirmAction(action,{title:"Confirmar operación",description:"Otra acción",confirmLabel:"Confirmar"}));
  document.querySelector<HTMLButtonElement>(".draft-confirm-actions button:last-child")!.click();
  expect(action).not.toHaveBeenCalled();
  expect(document.querySelector("h2")?.textContent).toBe("Confirmar operación");
  unregister();
});
