import { AccessApp } from "./AccessApp";
import {useEffect,useState} from "react";
import type { GpsReading } from "./CareOverview";

export function CloudPeople({ reading, localId, onMap }: { reading: GpsReading|null; localId?:number; onMap:()=>void }) {
  const verified=!!reading?.remoteId && !!reading.remoteSpace && !reading.error;
  const [known,setKnown]=useState<{localId:number|undefined;identity:GpsReading}|null>(null);
  useEffect(()=>{if(verified && reading)setKnown({localId,identity:{id:reading.id,position:null,error:"",remoteId:reading.remoteId,remoteName:reading.remoteName,remoteRoom:reading.remoteRoom,remoteSpace:reading.remoteSpace}});},[localId,verified,reading?.remoteId,reading?.remoteName,reading?.remoteRoom,reading?.remoteSpace]);
  const identity=verified ? reading : known && known.localId === localId ? known.identity : null;
  return <section className="cloud-people" aria-label="Personas por internet">
    {identity && <div className="people-current-person"><div><span>{verified ? "Persona monitoreada en esta PC" : "Identidad previa · conexión por verificar"}</span><h2>{identity.remoteName || "Persona autorizada"}</h2>
      <p>{[identity.remoteRoom?.trim(),`Ref. ${identity.remoteId!.slice(0,8)}`].filter(Boolean).join(" · ")}</p></div>
      <button className="resident-button link-resident" onClick={onMap} disabled={!verified}>Ver su mapa y geocerca</button></div>}
    <AccessApp embedded activeResidentId={localId} initialView="people" suggestedPerson={identity ? {resident_id:identity.remoteId!,space_id:identity.remoteSpace!} : undefined}/>
  </section>;
}
