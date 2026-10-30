// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./AccessApp", () => ({ AccessApp: (props: { personContext: { resident_id: string; space_id: string } }) => <p data-testid="context">{props.personContext.space_id}:{props.personContext.resident_id}</p> }));
import { LocalPersonAccess } from "./LocalPersonAccess";
const response = (bindings: object[]) => ({ ok: true, json: async () => ({ bindings }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens only the enabled exact local-to-remote identifiers", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
    { local_resident_id: 3, resident_id: "other", space_id: "space", enabled: 1 },
    { local_resident_id: 7, resident_id: "person", space_id: "space", enabled: 1 },
  ])));
  render(<LocalPersonAccess localId={7} onPrepare={() => {}}/>);
  expect((await screen.findByTestId("context")).textContent).toBe("space:person");
});
it("does not infer a link from names, another profile or a disabled binding", async () => {
  const prepare = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
    { local_resident_id: 3, full_name: "Same name", resident_id: "other", space_id: "space", enabled: 1 },
    { local_resident_id: 7, resident_id: "disabled", space_id: "space", enabled: 0 },
  ])));
  render(<LocalPersonAccess localId={7} onPrepare={prepare}/>);
  await screen.findByText("Ficha guardada solo en esta PC");
  expect(screen.queryByTestId("context")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revisar preparación" }));
  expect(prepare).toHaveBeenCalledOnce();
});
it("failed status is unverified, not silently unlinked", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<LocalPersonAccess localId={7} onPrepare={() => {}}/>);
  await screen.findByText("Vínculo sin verificar");
  expect(screen.queryByText("Ficha guardada solo en esta PC")).toBeNull();
});
it("discards a late response when the selected local profile changes", async () => {
  let finish!: (value: object) => void;
  const first = new Promise(resolve => { finish = resolve; });
  vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(response([
    { local_resident_id: 8, resident_id: "new-person", space_id: "new-space", enabled: true },
  ])));
  const view = render(<LocalPersonAccess localId={7} onPrepare={() => {}}/>);
  view.rerender(<LocalPersonAccess localId={8} onPrepare={() => {}}/>);
  await screen.findByText("new-space:new-person");
  await act(async () => { finish(response([{ local_resident_id: 7, resident_id: "old-person", space_id: "old-space", enabled: 1 }])); });
  expect((await screen.findByTestId("context")).textContent).toBe("new-space:new-person");
});
