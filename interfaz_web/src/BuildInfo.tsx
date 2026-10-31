import {useEffect,useId,useRef,useState} from "react";
import {Info} from "lucide-react";
import "./buildInfo.css";
export const INTERFACE_VERSION="1.2.0-rc16";
export function BuildInfo(){
  const [server,setServer]=useState("por verificar");
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const panelId=useId();
  useEffect(()=>{let active=true;void fetch("/api/status",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(active)setServer(typeof data?.version==="string" && /^[0-9A-Za-z.-]{1,40}$/.test(data.version)?data.version:"sin identificación de versión");}).catch(()=>{if(active)setServer("sin conexión");});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:MouseEvent)=>{if(event.target instanceof Node && !root.current?.contains(event.target))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);trigger.current?.focus();}};
    document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  return <div className="build-system" ref={root}>
    <button type="button" ref={trigger} className="build-system-trigger" title="Información del sistema" aria-label="Información del sistema" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)}><Info size={18}/></button>
    {open && <section id={panelId} className="build-system-panel" aria-label="Información del sistema"><h2>Información del sistema</h2><dl>
      <div><dt>Interfaz</dt><dd>{INTERFACE_VERSION}</dd></div>
      <div><dt>Servidor</dt><dd>{server}</dd></div>
      <div className="build-system-origin"><dt>Dirección de esta PC</dt><dd>{window.location.origin}</dd></div>
    </dl><p>Los datos locales pertenecen a esta instalación.</p></section>}
  </div>;
}
