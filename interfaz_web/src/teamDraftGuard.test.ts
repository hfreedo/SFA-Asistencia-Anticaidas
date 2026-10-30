// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { withTeamDraftExit, hasTeamDraft, registerTeamDraft } from "./teamDraftGuard";

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
