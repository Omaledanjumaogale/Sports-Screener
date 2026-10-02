import type { ScorePair } from '../../src/lib/marketEvidence';
/** BALLDONTLIE v1 games quarter fields are period points, not cumulative scores. */
export function basketballPeriods(game:any):Record<string,ScorePair> {
  const out:Record<string,ScorePair>={};
  for(let n=1;n<=4;n++) {
    const h=game?.[`home_q${n}`],a=game?.[`visitor_q${n}`];
    if(typeof h==='number'&&typeof a==='number'&&Number.isInteger(h)&&Number.isInteger(a)&&h>=0&&a>=0)out[`q${n}`]={home:h,away:a};
  }
  if(out.q1&&out.q2)out.h1={home:out.q1.home+out.q2.home,away:out.q1.away+out.q2.away};
  if(out.q3&&out.q4)out.h2={home:out.q3.home+out.q4.home,away:out.q3.away+out.q4.away};
  if(out.h1&&out.h2)out.rt={home:out.h1.home+out.h2.home,away:out.h1.away+out.h2.away};
  const h=game?.home_team_score,a=game?.visitor_team_score;
  // Conflicting quarter totals are excluded as a unit, not silently patched.
  if(typeof h==='number'&&typeof a==='number'&&Object.values(out).some(s=>s.home>h||s.away>a))return {};
  return out;
}
