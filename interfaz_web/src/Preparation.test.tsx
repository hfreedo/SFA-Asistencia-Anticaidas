// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./AccessApp", () => ({ AccessApp: ({ activeResidentId }: { activeResidentId?: number }) => <div>Acceso para perfil {activeResidentId}</div> }));
import { Preparation, isLoopback } from "./Preparation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("integrated preparation", () => {
  it("recognizes only exact loopback hosts", () => {
    expect(isLoopback("localhost")).toBe(true);
    expect(isLoopback("127.0.0.1")).toBe(true);
    expect(isLoopback("[::1]")).toBe(true);
    expect(isLoopback("localhost.example.org")).toBe(false);
    expect(isLoopback("192.168.1.5")).toBe(false);
  });
  it("keeps configured FCM distinct from delivery and routes actions within the panel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session_active: false, bindings: [{ local_resident_id: 7, enabled: 1 }], push: { configured: true, last_error: null } }) }));
    const onSettings = vi.fn(), onMap = vi.fn(), onMonitor = vi.fn();
    const { rerender } = render(<Preparation profile={{ id: 7, full_name: "Perfil A", room: "Sala" }} connected={false} onSettings={onSettings} onMap={onMap} onMonitor={onMonitor} />);
    expect(await screen.findByText("Configurado · entrega sin verificar")).toBeTruthy();
    expect(screen.getByText("No conectado · opcional para GPS")).toBeTruthy();
    expect(screen.getByText("Vinculado")).toBeTruthy();
    expect(screen.getByText("Pausada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Avisos y pruebas/ }));
    expect(onSettings).toHaveBeenCalledWith("notifications");
    fireEvent.click(screen.getByRole("button", { name: /Celular y geocerca/ }));
    expect(onMap).toHaveBeenCalledOnce();
    rerender(<Preparation profile={{ id: 8, full_name: "Perfil B", room: "Otra sala" }} connected={false} onSettings={onSettings} onMap={onMap} onMonitor={onMonitor} />);
    expect(screen.getByText("Sin vínculo habilitado")).toBeTruthy();
    expect(screen.getByText("Acceso para perfil 8")).toBeTruthy();
  });
  it("does not present a failed status request as readiness", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<Preparation profile={null} connected={false} onSettings={vi.fn()} onMap={vi.fn()} onMonitor={vi.fn()} />);
    expect((await screen.findAllByText("No se pudo verificar")).length).toBe(3);
    expect(screen.queryByText("Activa")).toBeNull();
  });
});
