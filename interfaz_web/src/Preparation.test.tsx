// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("./AccessApp",()=>({AccessApp:()=> <div>Acceso integrado</div>}));
import { Preparation } from "./Preparation";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("keeps consultation independent of the belt and FCM sender",()=>{
  vi.stubGlobal("Notification",{permission:"denied"});
  const onSettings=vi.fn();
  const {container}=render(<Preparation profile={{id:9,full_name:"Perfil local",room:"Sala"}} connected={false} onSettings={onSettings} onMap={vi.fn()} onMonitor={vi.fn()} check={{failed:false,status:{session_active:false,monitor_session_active:true,monitor_links:[{local_resident_id:9,resident_id:"remote"}],bindings:[],push:{configured:false,last_error:null}}}}/>);
  expect(screen.getByText("Activa")).toBeTruthy();
  expect(screen.getByText("Vinculado")).toBeTruthy();
  expect(screen.getByText("Bloqueados en el navegador")).toBeTruthy();
  const status=screen.getByLabelText("Estado de preparación");
  expect(status.textContent).not.toContain("FCM");
  expect(status.textContent).not.toContain("Cinturón");
  expect(container.querySelector("details")?.open).toBe(false);
  expect(onSettings).not.toHaveBeenCalled();
});
it("describes notification permission without claiming delivery",()=>{
  vi.stubGlobal("Notification",{permission:"granted"});
  render(<Preparation profile={null} connected={false} onSettings={vi.fn()} onMap={vi.fn()} onMonitor={vi.fn()} check={{failed:false,status:null}}/>);
  expect(screen.getByText("Permiso concedido")).toBeTruthy();
  expect(screen.queryByText("Notificación recibida")).toBeNull();
});
