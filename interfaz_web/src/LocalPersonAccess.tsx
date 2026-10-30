import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AccessApp } from "./AccessApp";
import { withTeamDraftExit } from "./teamDraftGuard";

type Link = { resident_id: string; space_id: string };
export function LocalPersonAccess({ localId, onPrepare }: { localId: number; onPrepare: () => void }) {
  const [result, setResult] = useState<{ id: number; link: Link | null; failed: boolean } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/cloud/status", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.bindings)) throw new Error();
        const link = data.bindings.find((b: { local_resident_id: number; enabled: boolean | number }) => b.local_resident_id === localId && (b.enabled === true || b.enabled === 1));
        if (link && (typeof link.resident_id !== "string" || !link.resident_id || typeof link.space_id !== "string" || !link.space_id)) throw new Error();
        if (active) setResult({ id: localId, link: link ?? null, failed: false });
      } catch { if (active) setResult({ id: localId, link: null, failed: true }); }
    })();
    return () => { active = false; };
  }, [localId, revision]);
  const current = result?.id === localId ? result : null;
  if (!current) return <p role="status">Comprobando el vínculo de esta ficha…</p>;
  if (!current.link) return <section className="person-link-empty"><h3>{current.failed ? "Vínculo sin verificar" : "Ficha guardada solo en esta PC"}</h3><p>{current.failed ? "No se pudo comprobar la referencia por internet." : "Todavía no tiene una referencia habilitada para asignar cuentas y cuidadores."}</p><div className="cloud-actions"><button className="resident-button" onClick={() => withTeamDraftExit(onPrepare)}>Revisar preparación</button><button className="resident-button" onClick={() => setRevision(n => n + 1)} title="Comprobar vínculo" aria-label="Comprobar vínculo"><RefreshCw size={17}/></button></div></section>;
  return <AccessApp key={`${current.link.space_id}:${current.link.resident_id}`} embedded activeResidentId={localId} initialView="people" personContext={current.link}/>;
}
