import {it,expect} from 'vitest';
import {basketballPeriods} from '../../convex/apis/basketballPeriods';
it('retains documented quarter points and aggregates halves excluding overtime',()=>{const result=basketballPeriods({home_q1:29,home_q2:34,home_q3:28,home_q4:24,visitor_q1:23,visitor_q2:25,visitor_q3:30,visitor_q4:27,home_team_score:120,visitor_team_score:110});expect(result.h1).toEqual({home:63,away:48});expect(result.rt).toEqual({home:115,away:105});});
it('does not turn null, missing or string quarters into zero',()=>{expect(basketballPeriods({home_q1:null,visitor_q1:20,home_q2:'25',visitor_q2:20})).toEqual({});});
it('rejects conflicting quarter totals',()=>{expect(basketballPeriods({home_q1:50,visitor_q1:20,home_team_score:40,visitor_team_score:30})).toEqual({});});
