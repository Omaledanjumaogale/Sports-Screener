import { createServer } from 'vite';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'production';
const server = await createServer({ mode:'production', server:{middlewareMode:true}, appType:'custom' });
try {
  const { render } = await server.ssrLoadModule('svelte/server');
  const { default: Board } = await server.ssrLoadModule('/src/lib/components/MarketDirectionBoard.svelte');
  const { default: Card } = await server.ssrLoadModule('/src/lib/components/PredictorMatchCard.svelte');
  const market = (id,line) => ({id,title:id,kind:'ou',pairs:[{line,over:1.9,under:1.9}]});
  const scope = {id:'ft',title:'Full game',markets:{mainTotal:market('mainTotal',22),homeTotal:market('homeTotal',11),awayTotal:market('awayTotal',11)}};
  const pick = {marketId:'mainTotal',marketTitle:'Total games',label:'Under 24.5',probability:75,odds:1.8};
  assert.equal(render(Board,{props:{scope,sportId:'tennis',picks:[{...pick,probability:60,odds:1.5}]}}).body.includes('direction-board'),false);
  const positive = render(Board,{props:{scope,sportId:'tennis',picks:[pick]}}).body;
  assert.match(positive,/Preferred pick/); assert.match(positive,/Under 24.5/); assert.doesNotMatch(positive,/No clear edge/);
  const match={matchId:'qa-direction',sportId:'tennis',homeTeam:'Player A',awayTeam:'Player B',league:'QA',source:'QA',startTime:Date.now()+86400000,scopes:scope};
  const analysis={picks:[pick],metrics:[],profiles:[],chips:[],headline:''};
  const fixture=render(Card,{props:{match,analysis,qualifying:[pick]}}).body;
  assert.match(fixture,/Positive estimated edge preview/); assert.match(fixture,/Preferred pick/); assert.match(fixture,/Under 24.5/);
  const negative=render(Card,{props:{match,analysis:{...analysis,picks:[{...pick,probability:60,odds:1.5}]}}}).body;
  assert.doesNotMatch(negative,/Positive estimated edge preview/);
  for (const sportId of ['football','hockey','tennis','basketball','baseball','rugby','cricket','mma','volleyball','rally','instant-football','instant-basketball','vfootball']) {
    const html=render(Board,{props:{scope:{...scope,markets:{...scope.markets,homeTotal:market('homeTotal',14),awayTotal:market('awayTotal',14)}},sportId,picks:[]}}).body;
    assert.match(html,/Over 22/);
  }
  console.log('21 direction UI checks passed: hidden negative guidance, positive fixture preview, and total direction across all 13 sports.');
} finally { await server.close(); }
