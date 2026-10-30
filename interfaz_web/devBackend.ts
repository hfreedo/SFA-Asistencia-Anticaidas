import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { X509Certificate } from "node:crypto";

export async function devBackend() {
  let agent: https.Agent | undefined;
  try { agent=new https.Agent({ca:new X509Certificate(readFileSync(resolve(process.cwd(),"../certs/SFA_Asistencia_CA.cer"))).toString(),rejectUnauthorized:true}); } catch { /* No local CA: only HTTP can be selected. */ }
  const available=(secure:boolean)=>new Promise<boolean>(resolveResult=>{
    const request=(secure ? https : http).get(`${secure ? "https" : "http"}://127.0.0.1:8780/api/status`,{...(secure ? {agent} : {}),timeout:1500},response=>{
      response.resume(); resolveResult(response.statusCode===200);
    });
    request.on("error",()=>resolveResult(false));
    request.on("timeout",()=>{request.destroy();resolveResult(false);});
  });
  if(await available(false)) return {target:"http://127.0.0.1:8780",agent:undefined};
  if(agent && await available(true)) return {target:"https://127.0.0.1:8780",agent};
  return {target:"http://127.0.0.1:8780",agent:undefined};
}
