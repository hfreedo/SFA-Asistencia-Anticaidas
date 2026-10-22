// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {LocalIncidentPanel} from './LocalIncidentPanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
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
