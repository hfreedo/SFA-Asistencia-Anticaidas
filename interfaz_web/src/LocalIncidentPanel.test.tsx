// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {LocalIncidentPanel} from './LocalIncidentPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps failed consultation visible without duplicating the shared session remedy',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401}));
  render(<LocalIncidentPanel residentId={7} connectionPaused onPrepare={vi.fn()}/>);
  await screen.findByText('Consulta de incidentes sin verificar');
  expect(screen.queryByRole('button',{name:'Revisar preparación'})).toBeNull();
  expect(screen.queryByText('Consulta sin verificar')).toBeNull();
  fireEvent.click(screen.getByLabelText('Opciones de atención'));
  expect(screen.getByText('Ver detalle del diagnóstico')).toBeTruthy();
});
it('does not report zero history on an unverified channel and routes the remedy',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401}));
  const prepare=vi.fn();
  render(<LocalIncidentPanel residentId={7} onPrepare={prepare}/>);
  await screen.findByText('Consulta de incidentes sin verificar');
  expect(screen.queryByRole('button',{name:'Ver historial (0)'})).toBeNull();
  expect(screen.getByRole('button',{name:'Ver historial'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Revisar preparación'}));
  expect(prepare).toHaveBeenCalledOnce();
});
it('keeps monitoring and reports the badge while hiding the entire segment in another view',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({viewer_id:'fixture',can_attend:true,events:[{id:'fixture',event_type:'SOS',simulated:false,observed_at:new Date().toISOString(),detail:{},actor_id:null,outcome:null,updated_at:null}],zone_status:null})});
  vi.stubGlobal('fetch',fetch);
  const changed=vi.fn();
  const {rerender}=render(<LocalIncidentPanel residentId={1} visible={false} onAttentionChange={changed}/>);
  await waitFor(()=>expect(changed).toHaveBeenLastCalledWith({pending:1,followup:false}));
  expect(screen.queryByRole('heading',{name:'Incidentes y atención'})).toBeNull();
  rerender(<LocalIncidentPanel residentId={1} visible onAttentionChange={changed}/>);
  expect(screen.getByRole('heading',{name:'Incidentes y atención'})).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('keeps the priority alert visible and expands attention commands on request',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({viewer_id:'fixture',can_attend:true,events:[{id:'fixture',event_type:'SOS',simulated:false,observed_at:new Date().toISOString(),detail:{text:'Solicitud de prueba estructural'},actor_id:null,outcome:null,updated_at:null}],zone_status:null})}));
  const snapshot=vi.fn();
  render(<LocalIncidentPanel residentId={7} onSnapshotChange={snapshot}/>);
  expect(await screen.findByRole('alert',{name:'Atención pendiente'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Tomar atención'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Revisar pendientes'}));
  expect(await screen.findByRole('button',{name:'Tomar atención'})).toBeTruthy();
  await waitFor(()=>expect(snapshot).toHaveBeenCalledWith(7,expect.objectContaining({events:expect.arrayContaining([expect.objectContaining({event_type:'SOS'})]),error:''})));
});
it('only presents the empty state after verification and keeps preparation in secondary options',async()=>{
  let resolve!:(value:unknown)=>void;
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(done=>{resolve=done;})));
  const prepare=vi.fn();
  render(<LocalIncidentPanel residentId={7} onPrepare={prepare}/>);
  expect(screen.queryByText(/Sin incidentes pendientes/)).toBeNull();
  resolve({ok:true,json:async()=>({viewer_id:'fixture',can_attend:false,events:[],zone_status:{state:'unknown',last_confirmed:'unknown',observed_at:null}})});
  await screen.findByText(/Sin incidentes pendientes/);
  expect(screen.queryByText('No se puede confirmar la situación de la zona')).toBeNull();
  expect(screen.getByLabelText('Opciones de atención').closest('details')?.hasAttribute('open')).toBe(false);
  fireEvent.click(screen.getByLabelText('Opciones de atención'));
  fireEvent.click(screen.getByRole('button',{name:'Preparar acceso y sincronización'}));
  expect(prepare).toHaveBeenCalledOnce();
  fireEvent.keyDown(screen.getByLabelText('Opciones de atención'),{key:'Escape'});
  expect(screen.getByLabelText('Opciones de atención').closest('details')?.hasAttribute('open')).toBe(false);
});
it('does not let a reassuring empty state compete with unresolved geofence followup',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({viewer_id:'fixture',can_attend:false,events:[],zone_status:{state:'outside',last_confirmed:'outside',observed_at:new Date().toISOString()}})}));
  render(<LocalIncidentPanel residentId={7}/>);
  await screen.findByText('La persona continúa fuera de la geocerca');
  expect(screen.queryByText(/Sin incidentes pendientes/)).toBeNull();
});
