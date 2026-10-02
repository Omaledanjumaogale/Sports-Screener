import { describe,it,expect } from 'vitest';
import type { Pick,ScopeState } from './engine';
import { decideMarkets,adviceFor,metDecision,positiveDecisions,expectedTotalDecision } from './marketDecision';
const pick=(label:string,probability:number,odds=1.8):Pick=>({marketId:'firstHalfTotal',marketTitle:'First Half Total',label,probability,odds});
const market=(line:number,over=1.9,under=1.9)=>({id:'',kind:'ou' as const,title:'',pairs:[{line,over,under}]});
const scope=(main=190,home=100,away=94):ScopeState=>({id:'ft',title:'Full Game',markets:{mainTotal:market(main),homeTotal:market(home),awayTotal:market(away)}});
describe('market direction guidance',()=>{
 it('prefers the higher estimate without calling overlapping totals wrong',()=>{const picks=[pick('Over 78',75),pick('Under 89',68)];const decisions=decideMarkets(picks);expect(decisions[0].preferred?.label).toBe('Over 78');expect(adviceFor(picks[1],decisions)).toContain('both can win');expect(decisions[0].value).toContain('Positive estimated');});
 it('labels mutually opposed totals as not preferred',()=>{const picks=[pick('Over 89',75),pick('Under 78',68)];expect(adviceFor(picks[1],decideMarkets(picks))).toContain('Not preferred');});
 it('does not force a tied or low-confidence direction',()=>{expect(decideMarkets([pick('Over 80',56),pick('Under 80',54)])[0].preferred).toBeNull();expect(decideMarkets([pick('Over 80',52)])[0].preferred).toBeNull();});
 it('does not recommend extreme short-priced ladder rows',()=>{expect(decideMarkets([pick('Over 50',99,1.01),pick('Over 78',65,1.6),pick('Under 78',35,2.4)])[0].preferred?.label).toBe('Over 78');});
 it('separates probability preference from negative EV',()=>{expect(decideMarkets([pick('Over 78',60,1.5)])[0].value).toContain('no positive');});
 it('does not compare different market periods',()=>{const p={...pick('Under 190',90),marketId:'mainTotal'};expect(decideMarkets([pick('Over 78',65),p])).toHaveLength(2);});
 it('disables recommendations for generated prices',()=>{const s=scope();s.markets.firstHalfTotal={...market(80),derived:true} as any;expect(decideMarkets([pick('Over 78',75)],s)[0].explanation).toContain('Reference only');});
 it('deduplicates the same retained candidate',()=>{const p=pick('Over 78',75);expect(decideMarkets([p,p])[0].preferred?.label).toBe(p.label);});
 it('labels unquoted MET direction without invented confidence or odds',()=>{expect(metDecision(scope())).toMatchObject({met:190,direction:'over',label:'Over 190 MET',confidence:null,quoted:false});expect(metDecision(scope(190,90,96)).direction).toBe('under');});
 it('reports no clear direction when centres agree or are missing',()=>{expect(metDecision(scope(190,95,95)).direction).toBeNull();expect(metDecision(null).met).toBeNull();});
 it('rejects a distant one-sided ladder as a fair centre',()=>{const s=scope();s.markets.mainTotal=market(150,1.01,30);expect(metDecision(s).met).toBeNull();});
 it('interpolates a bracketed fair centre',()=>{const s=scope();s.markets.mainTotal.pairs=[{line:180,over:1.5,under:3},{line:200,over:3,under:1.5}];expect(metDecision(s).met).toBeCloseTo(190);});
});

 describe('positive guidance display and expected totals',()=>{
 it('hides negative-value and unclear preferred candidates',()=>{expect(positiveDecisions([pick('Over 78',60,1.5)])).toEqual([]);expect(positiveDecisions([pick('Over 78',54,2)])).toEqual([]);expect(positiveDecisions([pick('Over 78',75,1.8)])).toHaveLength(1);});
 it.each(['football','instant-football','vfootball','hockey'])('shows Over and Under MEG for %s when team totals support it',sport=>{expect(expectedTotalDecision(scope(3,2,2),sport).label).toBe('Over 3 MEG');expect(expectedTotalDecision(scope(3,1,1),sport).label).toBe('Under 3 MEG');});
 it('uses games for tennis and keeps the quoted line distinct from MEG',()=>{expect(expectedTotalDecision(scope(22,12,12),'tennis').label).toBe('Over 22 MEG');const p={...pick('Under 24.5',75,1.8),marketId:'mainTotal'};expect(expectedTotalDecision(scope(22,11,11),'tennis',[p])).toMatchObject({label:'Under 24.5 · quoted total',quoted:true,threshold:22});});
 it('does not invent a direction or positive edge with missing or generated quotes',()=>{expect(expectedTotalDecision(null,'tennis').label).toBeNull();expect(expectedTotalDecision(scope(22,11,11),'tennis').label).toBeNull();const s=scope();(s as any)._meta={oddsIsReal:false};expect(expectedTotalDecision(s,'basketball').label).toBeNull();expect(positiveDecisions([{...pick('Over 78',75),priceVerified:false}])).toEqual([]);});
 });
