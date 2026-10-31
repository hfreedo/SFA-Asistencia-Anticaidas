export function backupImpact(value:unknown) {
  if(!value || typeof value !== "object") throw new Error("Invalid backup");
  const data=value as Record<string,unknown>;
  if(!Array.isArray(data.residents) || data.residents.length>1000 || !data.geofence || !data.notifications) throw new Error("Invalid backup");
  const names:string[]=[];let photos=0;
  for(const item of data.residents){
    if(!item || typeof item!=="object" || typeof item.full_name!=="string" || !item.full_name.trim()) throw new Error("Invalid profile");
    names.push(item.full_name.trim().slice(0,100));
    if(typeof item.photo_base64==="string" && item.photo_base64)photos++;
  }
  return `La copia contiene ${names.length} perfil(es) y ${photos} foto(s). ${names.length ? `Perfiles: ${names.slice(0,5).join(", ")}${names.length>5 ? ` y ${names.length-5} más` : ""}. ` : "No contiene perfiles. "}`;
}
