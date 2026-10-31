// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
vi.mock("./CloudPeople",()=>({CloudPeople:()=> <p>Directorio remoto autorizado</p>}));
import {SettingsScreen} from "./SfaDashboard";
const config={sound_enabled:true,telegram_token:"",telegram_chat_id:"",notify_fall:true,notify_sos:true,notify_battery:true,notify_first_motion:true,notify_geofence:true};
function props():Parameters<typeof SettingsScreen>[0]{return {initialTab:"notifications",profile:{id:7,full_name:"Local",room:"Sala",phone:"",emergency_phone:"112",medical_notes:""},residents:[],geofence:{home_lat:0,home_lng:0,radius_m:100,address_name:"Zona local"},notificationConfig:config,networkInfo:null,connected:false,connectedPort:null,connectionError:null,onPrepare:vi.fn(),onTriggerFallSimulation:vi.fn(),onSelectResident:vi.fn(),onCreateResident:vi.fn(),onDeleteResident:vi.fn(),onUpdateProfile:vi.fn(),onPhotoChange:vi.fn(),onOpenMap:vi.fn(),onUpdateNotifications:vi.fn()};}
beforeEach(()=>vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>[]})));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("opens the local zone explicitly rather than the previously viewed internet map",()=>{
  const p=props();render(<SettingsScreen {...p} initialTab="geofence"/>);
  fireEvent.click(screen.getByRole("button",{name:"Editar zona local en el mapa"}));
  expect(p.onOpenMap).toHaveBeenCalledWith("local");
});
it("defaults Personas to remote identities instead of unrelated PC profiles",()=>{
  render(<SettingsScreen {...props()} peopleOnly initialTab="residents"/>);
  expect(screen.getByText("Directorio remoto autorizado")).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Guardar ficha"})).toBeNull();
});
it("does not mount token fields for browser password autofill until explicit editing",()=>{
  render(<SettingsScreen {...props()}/>);
  expect(screen.queryByLabelText("Bot Token (@BotFather)")).toBeNull();
  expect((screen.getByRole("button",{name:"Guardar preferencias"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Editar canal de Telegram"}));
  expect(screen.getByLabelText("Bot Token (@BotFather)").getAttribute("autocomplete")).toContain("new-password");
  expect(screen.getByLabelText("Chat ID (@userinfobot)").getAttribute("autocomplete")).toBe("off");
});
