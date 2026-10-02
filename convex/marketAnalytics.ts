import { query } from './_generated/server';
import { v } from 'convex/values';
import { requireAdmin } from './access';
import { marketEvidence, type EvidenceRow } from '../src/lib/marketEvidence';

const archivedSports=['football','basketball','tennis','hockey','baseball'] as const;
export const report=query({args:{sport:v.string(),from:v.string(),to:v.string(),mode:v.union(v.literal('preferred'),v.literal('all')),cursor:v.optional(v.string())},handler:async(ctx,args)=>{
  await requireAdmin(ctx);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(args.from)||!/^\d{4}-\d{2}-\d{2}$/.test(args.to))throw new Error('Use YYYY-MM-DD dates.');
  const from=Date.parse(args.from),to=Date.parse(args.to);
  if(!Number.isFinite(from)||!Number.isFinite(to)||new Date(from).toISOString().slice(0,10)!==args.from||new Date(to).toISOString().slice(0,10)!==args.to||to<from||to-from>366*86400000)throw new Error('Choose an ordered date range of at most 366 days.');
  const supported=archivedSports.find(s=>s===args.sport);
  const allSports=[...archivedSports,'rally','instant-football','instant-basketball','vfootball','rugby','cricket','mma','volleyball'];
  if(!allSports.includes(args.sport as any))throw new Error('Unknown sport.');
  const page=supported?await ctx.db.query('predictionEvidence').withIndex('by_sport_day',q=>q.eq('sportId',supported).gte('dayKey',args.from).lte('dayKey',args.to)).order('desc').paginate({numItems:100,cursor:args.cursor??null}):{page:[],isDone:true,continueCursor:''};
  // Exclude bulky raw odds and reports from the response. Legacy picks are converted without inventing prices.
  const rows=page.page.map(row=>Object.fromEntries(Object.entries({sportId:row.sportId,dayKey:row.dayKey,matchId:row.matchId,homeTeam:row.homeTeam,awayTeam:row.awayTeam,finalScore:row.finalScore,periodScores:row.periodScores,publishedPicks:row.publishedPicks,report:row.publishedPicks?undefined:{top3Selections:row.report?.top3Selections??[]},decisions:row.decisions,capturedAt:row.capturedAt,startTime:row.startTime,modelVersion:row.modelVersion}).filter(([,value])=>value!==undefined))) as unknown as EvidenceRow[];
  const data=marketEvidence(rows,args.mode);
  return { ...data,rows,from:args.from,to:args.to,sport:args.sport,truncated:!page.isDone,cursor:page.continueCursor,isDone:page.isDone,pageSize:100,generatedAt:Date.now(),automatedCoverage:!!supported,
    interpretation:'Immutable pre-kickoff sample. Preferred mode uses the decision stored at publication; legacy reports lack this record. One observation per fixture, market, direction and confidence band; groups are overlapping and must not be summed as unique games. Missing period scores, partial Asian settlements and unsupported markets are excluded from binary win rates. Wilson 95% intervals are descriptive; correlated games and multiple comparisons limit conclusions. Gross ROI excludes fees and slippage.' };
}});
