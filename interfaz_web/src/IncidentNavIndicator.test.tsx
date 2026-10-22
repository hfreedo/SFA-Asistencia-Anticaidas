// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {IncidentNavIndicator} from './IncidentNavIndicator';
afterEach(cleanup);
it('indicates unresolved incidents or zone follow-up without adding a full panel',()=>{
  const {rerender,container}=render(<IncidentNavIndicator attention={{pending:2,followup:false}}/>);
  expect(screen.getByLabelText(/2 incidente/)).toBeTruthy();
  rerender(<IncidentNavIndicator attention={{pending:0,followup:true}}/>);
  expect(screen.getByLabelText(/Geocerca por revisar/)).toBeTruthy();
  rerender(<IncidentNavIndicator attention={{pending:0,followup:false}}/>);
  expect(container.innerHTML).toBe('');
});
