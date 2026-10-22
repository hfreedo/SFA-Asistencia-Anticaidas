// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ZoneSituation,type ZoneStatus} from './ZoneSituation';
afterEach(cleanup);
const now=Date.now();
const zone:ZoneStatus={state:'outside',last_confirmed:'outside',observed_at:new Date(now-10000).toISOString()};
it('a resolved incident does not hide a current outside situation',()=>{
  render(<ZoneSituation zone={zone} now={now} connected closedExit/>);
  expect(screen.getByRole('alert',{name:'Situación de geocerca'}).textContent).toContain('Atención cerrada, pero continúa fuera');
});
it.each(['stale','uncertain','imprecise'] as const)('retains the exit warning with %s GPS without claiming the person is currently outside',state=>{
  render(<ZoneSituation zone={{...zone,state}} now={now} connected closedExit/>);
  expect(screen.getByRole('alert').textContent).toContain('reingreso no confirmado');
  expect(screen.queryByText(/continúa fuera de la geocerca/)).toBeNull();
});
it('expires an outside assessment even without another successful response',()=>{
  render(<ZoneSituation zone={zone} now={now+100000} connected closedExit/>);
  expect(screen.getByRole('alert').textContent).toContain('Sin posición reciente');
});
it('a connection failure cannot imply confirmed reentry',()=>{
  render(<ZoneSituation zone={zone} now={now} connected={false} closedExit/>);
  expect(screen.getByRole('alert').textContent).toContain('reingreso no confirmado');
});
it('fresh confirmed inside replaces the outside situation',()=>{
  render(<ZoneSituation zone={{...zone,state:'inside',last_confirmed:'inside'}} now={now} connected closedExit/>);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('dentro de la zona confirmados');
});
