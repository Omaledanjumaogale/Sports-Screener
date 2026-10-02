import type { Pick } from './engine';
import { totalLine, pickKey } from './marketDecision';

export type EvidenceGrade = 'win' | 'loss' | 'push' | 'partial' | null;
export type ScorePair = { home:number; away:number };
export type EvidenceRow = { sportId:string; dayKey:string; matchId:string; homeTeam?:string; awayTeam?:string; finalScore?:string; periodScores?:Record<string,ScorePair>; publishedPicks?:Pick[]; decisions?:any; report?:any; modelVersion?:string; capturedAt?:number; startTime?:number };
export function scorePair(score?:string): ScorePair|null {
  const m=String(score??'').match(/^\s*(\d+)\s*[-:]\s*(\d+)\s*$/);
  return m?{home:Number(m[1]),away:Number(m[2])}:null;
}
export function marketContext(p:Pick) {
  const text=`${p.marketId} ${p.marketTitle}`.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase();
  const period=/first half|1st half|\bh1\b|\b1h\b/.test(text)?'h1':/second half|2nd half|\bh2\b|\b2h\b/.test(text)?'h2':/(?:first|1st) quarter|\bq1\b/.test(text)?'q1':/(?:second|2nd) quarter|\bq2\b/.test(text)?'q2':/(?:third|3rd) quarter|\bq3\b/.test(text)?'q3':/(?:fourth|4th) quarter|\bq4\b/.test(text)?'q4':/regulation|reg result|regresult/.test(text)?'rt':'ft';
  const side=/home|team\s*1|player\s*1/.test(text)?'home':/away|team\s*2|player\s*2/.test(text)?'away':'match';
  const family=/handicap|spread|puck line|run line|asian/.test(text)?'handicap':totalLine(p.label)?'total':/both.*score|btts/.test(text)?'btts':/double chance/.test(text)?'double-chance':/correct score/.test(text)?'correct-score':/winner|result|moneyline|1x2|match win/.test(text)?'winner':'other';
  // Units/periods not present in a final points score must not be guessed.
  const unsupported=/first set|second set|set 1|set 2|games|corners|cards|never down|1up|2up|innings|tiebreak/.test(text);
  return {period,side,family,unsupported,key:`${period}:${side}:${family}`};
}
export function selectionSide(p:Pick,row:EvidenceRow): 'home'|'away'|'draw'|null {
  const label=p.label.toLowerCase();
  const h=row.homeTeam?.toLowerCase(),a=row.awayTeam?.toLowerCase();
  const home=!!h&&label.includes(h),away=!!a&&label.includes(a);
  if(home!==away)return home?'home':'away';
  if (/\b(home|side a|team a|team 1|player 1)\b|^1$/.test(label)) return 'home';
  if (/\b(away|side b|team b|team 2|player 2)\b|^2$/.test(label)) return 'away';
  if (/\bdraw\b|^x$/.test(label)) return 'draw';
  return null;
}
function gradeDelta(delta:number):EvidenceGrade {return Math.abs(delta)<1e-8?'push':delta>0?'win':'loss';}
function splitGrade(value:number,line:number):EvidenceGrade {
  const fraction=Math.abs(line*4-Math.round(line*4));
  if (fraction<1e-8 && Math.abs(line*2-Math.round(line*2))>1e-8) {
    const a=gradeDelta(value+line-.25),b=gradeDelta(value+line+.25);
    return a===b?a:'partial';
  }
  return gradeDelta(value+line);
}
export function gradeEvidence(p:Pick,row:EvidenceRow):EvidenceGrade {
  const c=marketContext(p);
  if (c.unsupported) return null;
  // Tennis final score counts sets; it cannot settle games/point totals or game spreads.
  if (row.sportId==='tennis' && c.family!=='winner' && c.family!=='correct-score') return null;
  if (row.sportId==='cricket' || row.sportId==='rally') return null;
  const score=c.period==='ft'?scorePair(row.finalScore):row.periodScores?.[c.period];
  if (!score || ![score.home,score.away].every(n=>Number.isFinite(n)&&n>=0)) return null;
  const regulation=row.periodScores?.rt,final=scorePair(row.finalScore);
  // Second-half overtime inclusion differs by bookmaker. Without a retained rule, abstain.
  if(c.period==='h2' && regulation && final && (regulation.home!==final.home||regulation.away!==final.away))return null;
  const line=totalLine(p.label);
  if (c.family==='total' && line) {
    const points=c.side==='home'?score.home:c.side==='away'?score.away:score.home+score.away;
    const value=line.direction==='over'?points:-points;
    return splitGrade(value,line.direction==='over'?-line.line:line.line);
  }
  if (c.family==='handicap') {
    const side=selectionSide(p,row);
    // Last signed number avoids interpreting the "76" in Philadelphia 76ers as a spread.
    const numbers=[...p.label.matchAll(/([+-]\d+(?:\.\d+)?)(?!\d)/g)];
    const last=numbers.at(-1)?.[1] ?? (/\s0(?:\.0)?\s*$/.test(p.label)?'0':null);
    if (!side || side==='draw' || last===null) return null;
    return splitGrade(side==='home'?score.home-score.away:score.away-score.home,Number(last));
  }
  if (c.family==='winner') {
    const side=selectionSide(p,row);if(!side)return null;
    if(side==='draw')return score.home===score.away?'win':'loss';
    if(score.home===score.away)return /football/.test(row.sportId)||row.sportId==='unknown'?'loss':'push';
    return (side==='home'?score.home>score.away:score.away>score.home)?'win':'loss';
  }
  if(c.family==='btts' && /football/.test(row.sportId)) {
    const yes=/\byes\b/i.test(p.label),no=/\bno\b/i.test(p.label);if(yes===no)return null;
    return ((score.home>0&&score.away>0)===yes)?'win':'loss';
  }
  if(c.family==='double-chance') {
    const label=p.label.toLowerCase(),outcome=score.home>score.away?'1':score.home<score.away?'2':'x';
    const allowed=/1x|home.*draw|draw.*home/.test(label)?'1x':/x2|away.*draw|draw.*away/.test(label)?'x2':/12|home.*away|away.*home/.test(label)?'12':null;
    return allowed?allowed.includes(outcome)?'win':'loss':null;
  }
  if(c.family==='correct-score') {
    const expected=scorePair(p.label);return expected?expected.home===score.home&&expected.away===score.away?'win':'loss':null;
  }
  return null;
}
export function retainedPicks(row:EvidenceRow):Pick[] {
  if(Array.isArray(row.publishedPicks)) return row.publishedPicks.filter(p=>p.priceVerified!==false);
  return (Array.isArray(row.report?.top3Selections)?row.report.top3Selections:[]).flatMap((p:any)=>{
    const raw=String(p.confidence??'').trim();if(!/^\d+(?:\.\d+)?%?$/.test(raw))return[];
    const probability=Number(raw.replace('%',''));if(probability<0||probability>100)return[];
    return [{marketId:String(p.marketId??p.marketTitle??'unknown'),marketTitle:String(p.marketTitle??'Unknown'),label:String(p.selection??''),probability,odds:Number(p.rawOdds??p.odds)||0}];
  });
}
type Bucket={key:string;title:string;fixtures:Set<string>;wins:number;losses:number;pushes:number;partial:number;unavailable:number;confidenceSum:number;brierSum:number;priced:number;units:number};
function bucket(key:string,title=key):Bucket{return {key,title,fixtures:new Set(),wins:0,losses:0,pushes:0,partial:0,unavailable:0,confidenceSum:0,brierSum:0,priced:0,units:0};}
function record(b:Bucket,p:Pick,row:EvidenceRow) {
  b.fixtures.add(`${row.sportId}:${row.dayKey}:${row.matchId}`);const grade=gradeEvidence(p,row);
  if(grade==='win'||grade==='loss'){const win=grade==='win';b[win?'wins':'losses']++;b.confidenceSum+=p.probability;b.brierSum+=(p.probability/100-(win?1:0))**2;if(Number.isFinite(p.odds)&&p.odds>1){b.priced++;b.units+=win?p.odds-1:-1;}}
  else if(grade==='push')b.pushes++;else if(grade==='partial')b.partial++;else b.unavailable++;
}
function summarize(b:Bucket) {
  const n=b.wins+b.losses,p=n?b.wins/n:0,z=1.96,den=1+z*z/Math.max(1,n),centre=(p+z*z/(2*Math.max(1,n)))/den,spread=z*Math.sqrt(p*(1-p)/Math.max(1,n)+z*z/(4*Math.max(1,n)**2))/den;
  return {key:b.key,title:b.title,fixtures:b.fixtures.size,wins:b.wins,losses:b.losses,pushes:b.pushes,partial:b.partial,unavailable:b.unavailable,resolved:n,winRatePct:n?p*100:null,lowerPct:n?(centre-spread)*100:null,upperPct:n?(centre+spread)*100:null,averageConfidencePct:n?b.confidenceSum/n:null,brierScore:n?b.brierSum/n:null,grossRoiPct:b.priced?b.units/b.priced*100:null,priced:b.priced};
}
/** At most one observation per fixture/market/direction/band. Do not inflate games with line ladders. */
export function marketEvidence(rows:EvidenceRow[],mode:'preferred'|'all'='preferred') {
  const groups=new Map<string,Bucket>(),conditionals=new Map<string,Bucket>(),met=bucket('MET','MET direction'),unique=new Set<string>();
  let fullArchive=0,legacyArchive=0,skippedLate=0;
  for(const row of rows) {
    const fixture=`${row.sportId}:${row.dayKey}:${row.matchId}`;if(unique.has(fixture))continue;unique.add(fixture);
    if(row.capturedAt!==undefined&&row.startTime!==undefined&&row.capturedAt>=row.startTime){skippedLate++;continue;}
    if(Array.isArray(row.publishedPicks))fullArchive++;else legacyArchive++;
    const all=retainedPicks(row).filter(p=>Number.isFinite(p.probability)&&p.probability>=0&&p.probability<=100);
    // Never apply today's decision policy to historical candidates and call it published advice.
    const storedKeys=new Set<string>((row.decisions?.markets??[]).filter((d:any)=>d.preferred).map((d:any)=>pickKey(d.preferred)));
    const selected=mode==='all'?all:all.filter(p=>storedKeys.has(pickKey(p)));
    const observations=new Map<string,Pick>();
    for(const p of selected) {
      const context=marketContext(p),side=totalLine(p.label)?.direction??selectionSide(p,row)??p.label.toLowerCase();
      const band=p.probability<60?'below 60%':p.probability<70?'60–69%':p.probability<80?'70–79%':p.probability<90?'80–89%':'90–100%';
      const key=`${row.sportId} · ${context.key} · ${side} · ${band}`;
      const old=observations.get(key);if(!old||p.probability>old.probability)observations.set(key,p);
    }
    for(const [key,p] of observations){const b=groups.get(key)??bucket(key,`${p.marketTitle} · ${key}`);record(b,p,row);groups.set(key,b);}
    const storedMet=row.decisions?.met;
    if(typeof storedMet?.met==='number' && ['over','under'].includes(storedMet?.direction))record(met,{marketId:'mainTotal',marketTitle:'Match Total',label:`${storedMet.direction} ${storedMet.met}`,probability:50,odds:0},row);
    const plus=all.filter(p=>marketContext(p).family==='handicap' && marketContext(p).period==='ft' && /\+\d/.test(p.label)).sort((a,b)=>b.probability-a.probability)[0];
    if(plus){const side=selectionSide(plus,row);if(!side||side==='draw')continue;
      const band=plus.probability>=80?'80%+':'below 80%';
      for(const kind of ['covers spread','wins outright'] as const){const key=`${side} plus-handicap ${band} · ${kind}`,b=conditionals.get(key)??bucket(key);record(b,kind==='covers spread'?plus:{...plus,marketId:'winner',marketTitle:'Match Winner',label:side,odds:0},row);conditionals.set(key,b);}
      for(const direction of ['over','under']){const total=all.filter(p=>{const c=marketContext(p);return c.family==='total'&&c.period==='ft'&&c.side===side&&totalLine(p.label)?.direction===direction;}).sort((a,b)=>b.probability-a.probability)[0];if(!total)continue;const key=`${side} plus-handicap ${band} · team total ${direction}`,b=conditionals.get(key)??bucket(key);record(b,total,row);conditionals.set(key,b);}
    }
  }
  return {fixtures:unique.size,fullArchive,legacyArchive,skippedLate,groups:[...groups.values()].map(summarize).sort((a,b)=>(b.lowerPct??-1)-(a.lowerPct??-1)),conditionals:[...conditionals.values()].map(summarize),met:{...summarize(met),averageConfidencePct:null,brierScore:null},mode};
}
