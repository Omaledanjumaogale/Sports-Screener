import { describe,it,expect } from 'vitest';
import { gradeEvidence,marketEvidence,marketContext,type EvidenceRow } from './marketEvidence';
import type { Pick } from './engine';
const p=(marketId:string,label:string,probability=85,odds=1.8):Pick=>({marketId,marketTitle:marketId,label,probability,odds});
const row:EvidenceRow={sportId:'basketball',dayKey:'2026-10-01',matchId:'test',homeTeam:'Philadelphia 76ers',awayTeam:'Boston Celtics',finalScore:'100 - 98',capturedAt:1,startTime:2};
describe('result grading for evidence',()=>{
 it('never grades a missing half-time score with full-time totals',()=>{expect(gradeEvidence(p('firstHalfTotal','Over 78'),row)).toBeNull();expect(gradeEvidence(p('firstHalfTotal','Over 78'),{...row,periodScores:{h1:{home:40,away:42}}})).toBe('win');});
 it('recognizes camel-case half/team totals',()=>{expect(marketContext(p('firstHalfHomeTotal','Over 39')).side).toBe('home');expect(gradeEvidence(p('team1Total','Over 99'),row)).toBe('win');expect(gradeEvidence(p('team2Total','Over 99'),row)).toBe('loss');});
 it('uses the signed spread rather than digits in a team name',()=>{expect(gradeEvidence(p('handicap','Philadelphia 76ers -3'),row)).toBe('loss');expect(gradeEvidence(p('handicap','Boston Celtics +3'),row)).toBe('win');});
 it('keeps half wins and half losses out of binary accuracy',()=>{expect(gradeEvidence(p('handicap','Away +2.25'),row)).toBe('partial');expect(gradeEvidence(p('mainTotal','Over 198.25'),row)).toBe('partial');});
 it('does not confuse covering and winning outright',()=>{expect(gradeEvidence(p('handicap','Away +3'),row)).toBe('win');expect(gradeEvidence(p('winner','Away Win'),row)).toBe('loss');});
 it('settles integer line equality as a push',()=>{expect(gradeEvidence(p('mainTotal','Over 198'),row)).toBe('push');});
 it('abstains from second-half overtime settlement without a bookmaker rule',()=>{expect(gradeEvidence(p('secondHalfTotal','Over 80'),{...row,finalScore:'120 - 110',periodScores:{rt:{home:115,away:105},h2:{home:52,away:57}}})).toBeNull();});
 it('refuses tennis games totals from a sets score',()=>{expect(gradeEvidence(p('mainTotal','Over 2.5'),{...row,sportId:'tennis',finalScore:'2 - 1'})).toBeNull();});
 it('refuses unsupported period and scoring units',()=>{expect(gradeEvidence(p('cornersTotal','Over 9'),row)).toBeNull();expect(gradeEvidence(p('regulationTotal','Over 190'),row)).toBeNull();});
 it('grades football BTTS, double chance and exact scores explicitly',()=>{const r={...row,sportId:'football',finalScore:'2 - 1'};expect(gradeEvidence(p('btts','Yes'),r)).toBe('win');expect(gradeEvidence(p('doubleChance','1X'),r)).toBe('win');expect(gradeEvidence(p('correctScore','2 - 1'),r)).toBe('win');});
});
describe('prospective market statistics',()=>{
 it('counts 85 wins in 105 distinct fixtures without ladder inflation',()=>{
   const picks=[p('handicap','Away +3'),p('handicap','Away +4',82)];
   const rows=Array.from({length:105},(_,i)=>({...row,matchId:String(i),finalScore:i<85?'100 - 98':'110 - 98',publishedPicks:picks,decisions:{markets:[{preferred:picks[0]}]}}));
   const result=marketEvidence([...rows,rows[0]]);expect(result.fixtures).toBe(105);expect(result.groups[0]).toMatchObject({wins:85,resolved:105,fixtures:105});expect(result.groups[0].lowerPct).toBeLessThan(85/105*100);
   const conditional=result.conditionals.find(c=>c.key.includes('wins outright'));expect(conditional?.wins).toBe(0);
 });
 it('does not reconstruct preferred decisions for legacy rows',()=>{const legacy={...row,report:{top3Selections:[{selection:'Over 190',marketTitle:'Match Total',confidence:'85%',odds:1.8}]}};expect(marketEvidence([legacy]).groups).toHaveLength(0);expect(marketEvidence([legacy],'all').groups[0].wins).toBe(1);});
 it('excludes generated prices and late captures',()=>{const r={...row,publishedPicks:[{...p('mainTotal','Over 190'),priceVerified:false}]};expect(marketEvidence([r],'all').groups).toHaveLength(0);expect(marketEvidence([{...r,capturedAt:3}]).skippedLate).toBe(1);});
 it('does not invent confidence calibration for MET leans',()=>{const result=marketEvidence([{...row,decisions:{met:{met:190,direction:'over'}}}]);expect(result.met).toMatchObject({wins:1,resolved:1,averageConfidencePct:null,brierScore:null});});
 it('separates partial, push and unavailable outcomes',()=>{const result=marketEvidence([{...row,publishedPicks:[p('mainTotal','Over 198.25'),p('homeTotal','Over 100'),p('firstHalfTotal','Over 78')]}],'all');expect(result.groups.find(g=>g.key.includes('ft:match:total'))?.partial).toBe(1);expect(result.groups.find(g=>g.key.includes('ft:home:total'))?.pushes).toBe(1);expect(result.groups.find(g=>g.key.includes('h1'))?.unavailable).toBe(1);});
});
