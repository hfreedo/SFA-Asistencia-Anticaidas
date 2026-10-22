import {useEffect,useRef,useState} from 'react';
import {BellRing,RefreshCw,Send,Smartphone} from 'lucide-react';

type Device={installation_id:string;updated_at:string;last_test:{state:'pending'|'sent'|'expired'|'invalid';observed_at:string}|null};
type Snapshot={devices:Device[];emitter_configured:boolean;emitter_error:boolean};
const delivery={pending:'En cola o en reintento',sent:'Aceptada por FCM; recepción no confirmada',expired:'Prueba vencida',invalid:'Registro del celular no válido'};
function failureText(status:number,code:string) {
  if(status===401 || status===403) return 'Abre Acceso y sincronización de esta PC, inicia sesión y reanuda los envíos con la cuenta del celular.';
  if(code==='22023') return 'Espera al menos un minuto entre pruebas antes de volver a enviar.';
  if(code==='push_not_configured') return 'El emisor FCM de esta PC no está configurado.';
  if(status===404) return 'No está disponible el vínculo o el celular registrado. Actualiza y revisa el registro en Android.';
  return 'No se pudo confirmar la operación. Actualiza el estado antes de repetir la prueba.';
}
export function PushTestSettings({residentId}:{residentId?:number}) {
  if(!residentId) return <section className="notification-channel push-test-settings"><h3>Avisos al celular · Firebase</h3><p>Selecciona un residente para consultar los celulares de tu cuenta.</p></section>;
  return <PushTestPanel key={residentId} residentId={residentId}/>;
}
function PushTestPanel({residentId}:{residentId:number}) {
  const [data,setData]=useState<Snapshot|null>(null);
  const [selected,setSelected]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [revision,setRevision]=useState(0);
  const requesting=useRef(false);
  async function request(body?:object) {
    const response=await fetch(`/api/cloud/residents/${residentId}/push-test`,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
    const result=await response.json();
    if(!response.ok) throw new Error(failureText(response.status,result.detail?.code??''));
    return result;
  }
  useEffect(()=>{
    let active=true;
    const load=async()=>{
      if(requesting.current) return;
      requesting.current=true;
      try {
        const snapshot:Snapshot=await request();
        if(active){setData(snapshot);setError('');setSelected(previous=>snapshot.devices.some(d=>d.installation_id===previous)?previous:snapshot.devices[0]?.installation_id??'');}
      } catch(failure){if(active){setData(null);setError((failure as Error).message);}}
      finally{requesting.current=false;if(active)setLoading(false);}
    };
    void load(); const timer=window.setInterval(()=>void load(),8000);
    return()=>{active=false;window.clearInterval(timer);};
  },[residentId,revision]);
  async function send() {
    if(busy || !confirmed || !selected || !data?.emitter_configured) return;
    setBusy(true);setMessage('');setError('');
    try {
      const result=await request({installation_id:selected,confirmed:true});
      if(result.queued!==true) throw new Error('No se confirmó la puesta en cola. Actualiza antes de repetir.');
      setMessage('Prueba en cola para el celular seleccionado. Esto no confirma recepción; comprueba el aviso en Android.');
      setConfirmed(false);setRevision(n=>n+1);
    } catch(failure){setError((failure as Error).message);}
    finally{setBusy(false);}
  }
  const device=data?.devices.find(d=>d.installation_id===selected);
  return <section className="notification-channel push-test-settings" aria-labelledby="push-test-title">
    <div className="push-test-heading"><Smartphone size={22}/><h3 id="push-test-title">Avisos al celular · Firebase</h3><span className="push-channel-label">FCM</span></div>
    <p>Prueba dirigida únicamente a un celular registrado de la cuenta conectada en esta PC. No avisa a otros cuidadores.</p>
    <div className="push-test-status"><BellRing size={18}/><span>{loading?'Consultando registro…':data?`${data.devices.length} celular(es) registrado(s) · ${data.emitter_configured?'Emisor configurado':'Emisor sin configurar'}`:'Canal no disponible'}</span></div>
    {error && <p role="alert" className="cloud-warning">{error}</p>}
    {data?.emitter_error && <p role="alert" className="cloud-warning">El emisor informa un error de envío. Revisa su configuración antes de repetir pruebas.</p>}
    {data && !data.devices.length && <p>En Android, entra con esta misma cuenta y activa Cuidar → Alertas en este celular → Activar o actualizar avisos.</p>}
    {!!data?.devices.length && <label>Celular destinatario<select aria-label="Celular destinatario" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setConfirmed(false);setMessage('');}}>{data.devices.map((item,index)=><option key={item.installation_id} value={item.installation_id}>Celular {index+1} · registro {new Date(item.updated_at).toLocaleString('es')}</option>)}</select></label>}
    {device?.last_test && <p className="push-last-test" role="status">Última prueba: {delivery[device.last_test.state]} · {new Date(device.last_test.observed_at).toLocaleString('es')}</p>}
    <label className="push-test-consent"><input type="checkbox" checked={confirmed} disabled={busy||!device||!data?.emitter_configured} onChange={e=>setConfirmed(e.target.checked)}/>Enviar una notificación de PRUEBA. No es una emergencia.</label>
    <div className="push-test-actions"><button type="button" onClick={()=>void send()} disabled={busy||loading||!confirmed||!device||!data?.emitter_configured}><Send size={17}/>{busy?'Solicitando…':'Enviar prueba al celular'}</button><button type="button" onClick={()=>{setLoading(true);setRevision(n=>n+1);}} disabled={busy||loading}><RefreshCw size={17}/>Actualizar estado</button><a href="/acceso/acceso.html" target="_blank" rel="noopener noreferrer">Acceso y sincronización</a></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
