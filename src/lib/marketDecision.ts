import type { Pick, ScopeState } from './engine';

export const DECISION_VERSION = 'market-direction-v1';
export type DirectionDecision = { marketId: string; title: string; preferred: Pick | null; explanation: string; value: string };
export const pickKey = (p: Pick) => `${p.marketId}:${p.label.toLowerCase().trim()}`;
export function totalLine(label: string): { direction: 'over' | 'under'; line: number } | null {
  const m = label.match(/\b(over|under)\s+(-?\d+(?:\.\d+)?)/i);
  return m ? { direction: m[1].toLowerCase() as 'over' | 'under', line: Number(m[2]) } : null;
}
/** One quoted choice per market. High probability alone is not positive value. */
export function decideMarkets(picks: Pick[], scope?: ScopeState | null): DirectionDecision[] {
  const groups = new Map<string, Pick[]>();
  for (const p of picks) {
    if (!p.marketId || !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 100) continue;
    const list = groups.get(p.marketId) ?? [];
    if (!list.some(x => pickKey(x) === pickKey(p))) list.push(p);
    groups.set(p.marketId, list);
  }
  return [...groups].map(([marketId, rows]) => {
    const eligible = rows.filter(p => Number.isFinite(p.odds) && p.odds > 1.15).sort((a,b) => b.probability-a.probability || b.odds-a.odds);
    const best = eligible[0];
    // Compare opposite directions, not neighbouring lines on the same ladder.
    const side = (p: Pick) => totalLine(p.label)?.direction ?? p.label.replace(/[+-]?\d+(?:\.\d+)?/g,'').trim().toLowerCase();
    const opposite = best && eligible.find(p => side(p) !== side(best));
    const referenceOnly = rows.every(p=>p.priceVerified===false) || (scope?.markets?.[marketId] as any)?.derived === true || (scope as any)?._meta?.oddsIsReal === false;
    const clear = !referenceOnly && best && best.probability >= 55 && (!opposite || best.probability-opposite.probability >= 3);
    const preferred = clear ? best : null;
    const ev = best ? best.probability/100*best.odds-1 : null;
    return { marketId, title: rows[0].marketTitle, preferred,
      explanation: referenceOnly ? 'Reference only: generated or fallback prices are not verified bookmaker quotes.' : preferred ? `Highest estimated chance among quoted options above 1.15 odds. ${opposite ? `Opposite-direction estimate: ${opposite.probability.toFixed(1)}%.` : 'No eligible opposing quote to compare.'}` : 'No clear direction: needs a 55% estimate and a 3-point lead over the opposing direction, with odds above 1.15.',
      value: ev === null ? 'No eligible price' : ev <= 0 ? 'Probability lean only · no positive estimated value at this price' : 'Positive estimated value · model uncertainty still applies' };
  });
}
export function adviceFor(p: Pick, decisions: DirectionDecision[]): string {
  const d = decisions.find(x => x.marketId === p.marketId);
  if (!d?.preferred) return 'No clear edge';
  if (pickKey(p) === pickKey(d.preferred)) return 'Preferred quoted pick';
  const a=totalLine(p.label), b=totalLine(d.preferred.label);
  if (a && b) {
    if (a.direction === b.direction) return `Same direction · prefer ${d.preferred.label}`;
    const over=a.direction==='over'?a:b, under=a.direction==='under'?a:b;
    if (over.line < under.line) return `Compatible alternative · both can win between ${over.line} and ${under.line}; prefer ${d.preferred.label}`;
  }
  return `Not preferred · lean ${d.preferred.label}`;
}
function centre(scope: ScopeState | null | undefined, id: string): number | null {
  if ((scope?.markets?.[id] as any)?.derived || (scope as any)?._meta?.oddsIsReal === false) return null;
  const rows = (scope?.markets?.[id]?.pairs ?? []).filter(p => p.line !== null && typeof p.line==='number' && Number.isFinite(p.line) && typeof p.over==='number' && p.over>1 && typeof p.under==='number' && p.under>1)
    .map(p => ({ line:p.line!, over:(1/p.over!)/(1/p.over!+1/p.under!) })).sort((a,b)=>a.line-b.line);
  if (!rows.length) return null;
  for (let i=1;i<rows.length;i++) {
    const a=rows[i-1],b=rows[i];
    if (a.over>=.5 && b.over<=.5 && a.over!==b.over) return a.line+(.5-a.over)*(b.line-a.line)/(b.over-a.over);
  }
  const nearest=[...rows].sort((a,b)=>Math.abs(a.over-.5)-Math.abs(b.over-.5))[0];
  // A distant one-sided ladder cannot locate the fair centre.
  return Math.abs(nearest.over-.5)<=.025 ? nearest.line : null;
}
export function metDecision(scope: ScopeState | null | undefined) {
  const met=centre(scope,'mainTotal'), home=centre(scope,'homeTotal'), away=centre(scope,'awayTotal');
  const proxy=home!==null&&away!==null ? home+away : null;
  const gap=met!==null&&proxy!==null?proxy-met:null;
  const direction=gap!==null && Math.abs(gap)>=2 ? gap>0?'over':'under' : null;
  return { met:met===null?null:Math.round(met*10)/10, teamTotalProxy:proxy===null?null:Math.round(proxy*10)/10, direction,
    label:met===null?'MET unavailable':direction?`${direction==='over'?'Over':'Under'} ${Math.round(met*10)/10} MET`:'No clear MET direction',
    explanation:met===null?'Enter complete total prices to calculate MET.':proxy===null?'MET is a market-implied centre, roughly 50/50; team-total cross-checks are missing.':direction?'Team-total market centres suggest this direction. These prices are correlated, not independent predictive evidence.':'Team-total centres are within 2 points of MET; neither direction has a clear cross-check.',
    confidence:null, quoted:false, version:DECISION_VERSION };
}
