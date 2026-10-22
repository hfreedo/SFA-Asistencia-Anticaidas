// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FallAlertScreen,isNewConfirmedFall} from './SfaDashboard';

afterEach(()=>{cleanup();vi.useRealTimers();});
it('does not reopen for repeated telemetry but detects a genuinely new fall',()=>{
  const fall={type:'telemetry' as const,state:'CAIDA_CONFIRMADA' as const,fall_count:3,
    ax:0,ay:0,az:1,accel_g:1,tilt_deg:70,motion:0,received_at:new Date().toISOString()};
  expect(isNewConfirmedFall(null,fall)).toBe(true);
  expect(isNewConfirmedFall(fall,{...fall,received_at:new Date().toISOString()})).toBe(false);
  expect(isNewConfirmedFall(fall,{...fall,fall_count:4})).toBe(true);
  expect(isNewConfirmedFall({...fall,state:'NORMAL'},fall)).toBe(true);
  expect(isNewConfirmedFall(fall,{...fall,state:'NORMAL'})).toBe(false);
});
it('confirms only after holding and cancels when the pointer leaves',()=>{
  vi.useFakeTimers();
  const confirm=vi.fn().mockResolvedValue(undefined);
  render(<FallAlertScreen profile={null} startedAt={new Date()} onConfirm={confirm}/>);
  const button=screen.getByRole('button',{name:/Mantener para confirmar/});
  fireEvent.pointerDown(button);
  act(()=>vi.advanceTimersByTime(600));
  fireEvent.pointerLeave(button);
  act(()=>vi.advanceTimersByTime(1500));
  expect(confirm).not.toHaveBeenCalled();
  fireEvent.pointerDown(button);
  act(()=>vi.advanceTimersByTime(1220));
  expect(confirm).toHaveBeenCalledTimes(1);
});
it('shows hardware errors on the curtain and disables duplicate requests',()=>{
  render(<FallAlertScreen profile={null} startedAt={new Date()} onConfirm={vi.fn()} confirming error="El cinturon no responde"/>);
  expect(screen.getByRole('alert').textContent).toContain('no responde');
  expect((screen.getByRole('button',{name:/Confirmando/}) as HTMLButtonElement).disabled).toBe(true);
});
it('cleans up a pending hold when the screen is removed',()=>{
  vi.useFakeTimers();
  const confirm=vi.fn().mockResolvedValue(undefined);
  const {unmount}=render(<FallAlertScreen profile={null} startedAt={new Date()} onConfirm={confirm}/>);
  fireEvent.pointerDown(screen.getByRole('button'));
  unmount();
  act(()=>vi.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
});
