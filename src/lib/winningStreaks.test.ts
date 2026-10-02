import {expect,it}from'vitest';import{winningStreaks}from'./winningStreaks';
const win={group:'football',picks:2,wins:2,losses:0};
it('breaks streaks across calendar gaps and tied days',()=>{expect(winningStreaks([{dayKey:'2026-10-01',rows:[win]},{dayKey:'2026-10-03',rows:[win]}]).get('football')?.max).toBe(1);expect(winningStreaks([{dayKey:'2026-10-01',rows:[win]},{dayKey:'2026-10-02',rows:[{...win,wins:1,losses:1}]}]).get('football')?.cur).toBe(0);});
it('counts consecutive winning dates without extending through missing groups',()=>{const result=winningStreaks([{dayKey:'2026-10-01',rows:[win]},{dayKey:'2026-10-02',rows:[win]},{dayKey:'2026-10-03',rows:[]}]).get('football');expect(result?.max).toBe(2);expect(result?.cur).toBe(0);});
