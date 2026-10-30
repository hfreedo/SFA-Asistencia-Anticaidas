// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { confirmTeamDraftExit, hasTeamDraft, registerTeamDraft } from "./teamDraftGuard";

it("requires explicit consent while a form is open and clears the guard on unmount", () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const unregister = registerTeamDraft();
  expect(hasTeamDraft()).toBe(true);
  expect(confirmTeamDraftExit()).toBe(false);
  confirm.mockReturnValue(true);
  expect(confirmTeamDraftExit()).toBe(true);
  unregister();
  confirm.mockClear();
  expect(confirmTeamDraftExit()).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});
