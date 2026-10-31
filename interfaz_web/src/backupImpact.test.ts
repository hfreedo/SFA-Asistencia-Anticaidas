import {expect,it} from "vitest";
import {backupImpact} from "./backupImpact";
it("previews people and photos without treating names as markup",()=>{
  expect(backupImpact({residents:[{full_name:"<b>Nombre</b>",photo_base64:"fixture"},{full_name:"Otra persona"}],geofence:{},notifications:{}})).toContain("2 perfil(es) y 1 foto(s)");
});
it("makes an empty replacement explicit and rejects unrelated JSON",()=>{
  expect(backupImpact({residents:[],geofence:{},notifications:{}})).toContain("No contiene perfiles");
  expect(()=>backupImpact({residents:"invalid"})).toThrow();
});
