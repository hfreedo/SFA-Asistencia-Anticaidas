// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GeofenceRadius } from "./GeofenceRadius";
afterEach(cleanup);
describe("geofence radius", () => {
  it("offers demonstration radii and reports the required GPS accuracy", () => {
    const update = vi.fn();
    render(<GeofenceRadius value={5} onChange={update} />);
    expect(screen.getByText(/al menos 10 segundos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "10 m" }));
    expect(update).toHaveBeenCalledWith(10);
    expect(screen.getByRole("button", { name: "5 m" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("supports a custom radius without replacing an empty value with 200", () => {
    const update = vi.fn();
    render(<GeofenceRadius value={200} onChange={update} />);
    const input = screen.getByRole("spinbutton");
    expect(input.getAttribute("min")).toBe("5");
    fireEvent.change(input, { target: { value: "12" } });
    expect(update).toHaveBeenLastCalledWith(12);
    fireEvent.change(input, { target: { value: "" } });
    expect(Number.isNaN(update.mock.lastCall?.[0])).toBe(true);
  });
});
