import { expect,it } from "vitest";
import { relativeAge } from "./timeLabels";
it("uses readable ages and does not present invalid times as fresh",()=>{
  expect(relativeAge(21711)).toBe("hace 6 h 1 min");
  expect(relativeAge(61)).toBe("hace 1 min");
  expect(relativeAge(5)).toBe("hace 5 s");
  expect(relativeAge(90000)).toBe("hace 1 d 1 h");
  expect(relativeAge(Infinity)).toBe("hora por verificar");
  expect(relativeAge(-60)).toBe("hora por verificar");
});
