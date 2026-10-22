// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PushTestSettings} from './PushTestSettings';
const id='11111111-1111-4111-8111-111111111111';
const data={devices:[{installation_id:id,updated_at:new Date().toISOString(),last_test:null}],emitter_configured:true,emitter_error:false};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('does not send on mount and requires an explicit test confirmation',async()=>{
  const fetch=vi.fn().mockImplementation(async(_url,options)=>({ok:true,json:async()=>options.method==='POST'?{queued:true,event_id:'fixture'}:data}));
  vi.stubGlobal('fetch',fetch);
  render(<PushTestSettings residentId={1}/>);
  const button=await screen.findByRole('button',{name:'Enviar prueba al celular'});
  await screen.findByRole('combobox',{name:'Celular destinatario'});
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(fetch.mock.calls.some(call=>call[1].method==='POST')).toBe(false);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(button);
  await waitFor(()=>expect(fetch.mock.calls.some(call=>call[1].method==='POST')).toBe(true));
  const post=fetch.mock.calls.find(call=>call[1].method==='POST')!;
  expect(JSON.parse(post[1].body)).toEqual({installation_id:id,confirmed:true});
  expect(await screen.findByText(/Prueba en cola para el celular seleccionado/)).toBeTruthy();
});
it('explains registration instead of enabling a send without a receiver',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,devices:[]})}));
  render(<PushTestSettings residentId={1}/>);
  await screen.findByText(/En Android, entra con esta misma cuenta/);
  expect((screen.getByRole('button',{name:'Enviar prueba al celular'}) as HTMLButtonElement).disabled).toBe(true);
});
it('reports FCM acceptance without claiming that Android received it',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,devices:[{...data.devices[0],last_test:{state:'sent',observed_at:new Date().toISOString()}}]})}));
  render(<PushTestSettings residentId={1}/>);
  expect(await screen.findByText(/Aceptada por FCM; recepción no confirmada/)).toBeTruthy();
});
it('blocks testing when the local sending credential is not configured',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({...data,emitter_configured:false})}));
  render(<PushTestSettings residentId={1}/>);
  await screen.findByRole('combobox',{name:'Celular destinatario'});
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
});
