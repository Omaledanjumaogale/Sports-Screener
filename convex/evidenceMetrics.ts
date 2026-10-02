import { gradeSelection } from './predictorGrading';
/** Scores immutable published probabilities only; pushes and unknown probabilities are excluded. */
export function evidenceMetrics(rows: any[]) {
  let resolved=0,wins=0,probabilitySum=0,brier=0,logLoss=0,priced=0,units=0;
  const sources=new Set<string>();const sports=new Set<string>();const markets=new Set<string>();
  for(const row of rows){sources.add(row.source);sports.add(row.sportId);for(const pick of Array.isArray(row.report?.top3Selections)?row.report.top3Selections:[]){
    const raw=typeof pick.confidence==='number'?String(pick.confidence):String(pick.confidence??'').trim();
    if(!/^\d+(?:\.\d+)?%?$/.test(raw))continue;
    const confidence=Number(raw.replace('%',''));if(confidence<0||confidence>100)continue;
    const grade=gradeSelection(pick.selection,pick.marketTitle,row.finalScore,{homeTeam:row.homeTeam,awayTeam:row.awayTeam});
    if(grade!=='win'&&grade!=='loss')continue;
    const actual=grade==='win'?1:0;const probability=confidence/100;const bounded=Math.min(1-1e-9,Math.max(1e-9,probability));
    resolved++;wins+=actual;probabilitySum+=probability;brier+=(probability-actual)**2;logLoss-=actual*Math.log(bounded)+(1-actual)*Math.log(1-bounded);markets.add(pick.marketTitle);
    const odds=Number(pick.rawOdds??pick.odds);if(Number.isFinite(odds)&&odds>1){priced++;units+=actual?odds-1:-1;}
  }}
  const days=rows.map(row=>row.dayKey).filter(Boolean).sort();
  return {resolved,wins,winRatePct:resolved?wins/resolved*100:null,averageConfidencePct:resolved?probabilitySum/resolved*100:null,calibrationGapPct:resolved?(probabilitySum-wins)/resolved*100:null,brierScore:resolved?brier/resolved:null,logLoss:resolved?logLoss/resolved:null,pricedPicks:priced,grossRoiPct:priced?units/priced*100:null,from:days[0]??null,to:days.at(-1)??null,sports:[...sports],markets:[...markets],sources:[...sources],interpretation:'Prospective archive sample; gross ROI only when actual decimal odds were retained. Fees, slippage and independent held-out evaluation remain separate.'};
}
