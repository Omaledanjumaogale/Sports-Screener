// Central registry of every data source the AI Predictor agents consult.
//
// This file is the app's INTELLIGENCE_DIRECTORY — the curated directory of real
// prediction sites, statistics providers, odds registries, tipster feeds, news
// sources and data APIs that the agents search, research, fetch and scrape.
//
// Only sources verified to return real, parseable data are wired into the live
// fixture/odds agents (see FIXTURE_PAGES and the working API config). The rest
// remain catalogued so the research/citation agents can reference them. Keys are
// read server-side from Convex env (set via `npx convex env set`), never committed.

declare const process: { env: Record<string, string | undefined> };

export type SourceKind =
  | 'primary'
  | 'prediction'
  | 'statistics'
  | 'odds'
  | 'tips'
  | 'betting'
  | 'tipsters'
  | 'news'
  | 'blog'
  | 'priority';

export interface ScraperSource {
  name: string;
  url: string;
  kind: SourceKind;
  sport?: string;
  type?: string;
  desc?: string;
}

export type SourceCategory =
  | 'provider_api'
  | 'fixture_registry'
  | 'odds_registry'
  | 'statistics_registry'
  | 'prediction_intelligence'
  | 'live_scores'
  | 'betting_operator'
  | 'tipster_network'
  | 'news_media'
  | 'analytics_blog';

export interface PrimarySource extends ScraperSource {
  category: SourceCategory;
  tier: 1 | 2 | 3;
  realtime: boolean;
}

const BETWATCH_URL = 'https://betwatch.fr/';

// West Africa Time day-key helpers (server-side twin of src/lib/watTime.ts).
// Predictor caches are keyed by the WAT day string so "today" never drifts
// by an hour at UTC midnight (WAT is UTC+1, fixed offset).
export function watTodayKey(base: Date | number = new Date()): string {
  const ms = typeof base === 'number' ? base : base.getTime();
  return new Date(ms + 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function watDayKeyFor(offsetDays: number, base: Date | number = new Date()): string {
  const ms = (typeof base === 'number' ? base : base.getTime()) + offsetDays * 86_400_000;
  return watTodayKey(ms);
}

const PROVIDER_API_PRIMARY: PrimarySource[] = [
  { name: 'TheSportsDB', url: 'https://www.thesportsdb.com/api/v1/json', kind: 'primary', type: 'API', category: 'provider_api', tier: 1, realtime: true, desc: 'Multi-sport fixtures and entities registry (free public key)' },
  { name: 'The Odds API', url: 'https://api.the-odds-api.com/v4', kind: 'primary', type: 'API', category: 'odds_registry', tier: 1, realtime: true, desc: '~78 sports, real bookmaker odds (quota-capped)' },
  { name: 'BallDontLie', url: 'https://api.balldontlie.io/v1', kind: 'primary', type: 'API', sport: 'basketball', category: 'provider_api', tier: 1, realtime: true, desc: 'NBA games and real-time stats' },
  { name: 'SportsData.io', url: 'https://api.sportsdata.io/v3', kind: 'primary', type: 'API', sport: 'basketball', category: 'provider_api', tier: 2, realtime: true, desc: 'NBA scores and schedule feed' },
  { name: 'OddsPapi', url: 'https://api.oddspapi.io/v4', kind: 'primary', type: 'API', category: 'odds_registry', tier: 1, realtime: true, desc: '69 sports, fixtures/schedules + odds free tier' },
  { name: 'SharpAPI', url: 'https://api.sharpapi.io/api/v1', kind: 'primary', type: 'API', category: 'odds_registry', tier: 1, realtime: true, desc: 'Flat real bookmaker odds h2h/spread/total across major leagues' },
  { name: 'SportsGameOdds', url: 'https://api.sportsgameodds.com/v2', kind: 'primary', type: 'API', category: 'odds_registry', tier: 2, realtime: true, desc: 'Events + live odds major leagues (NBA/NFL/MLB/NHL/MLS)' },
  { name: 'ParlayAPI', url: 'https://parlay-api.com/v1', kind: 'primary', type: 'API', category: 'odds_registry', tier: 2, realtime: true, desc: 'The-Odds-API drop-in free 1000 credits/mo' },
  { name: 'PinnAPI', url: 'https://pinnapi.com', kind: 'primary', type: 'API', category: 'odds_registry', tier: 3, realtime: true, desc: 'Pinnacle-family odds REST feed (paid)' }
];

const FIXTURE_REGISTRY_PRIMARY: PrimarySource[] = [
  { name: 'BetWatch', url: BETWATCH_URL, kind: 'primary', sport: 'football', type: 'Fixture Feed', category: 'fixture_registry', tier: 2, realtime: true, desc: 'French-language football fixture and result feed' },
  { name: 'BetExplorer', url: 'https://www.betexplorer.com', kind: 'primary', sport: 'multi', type: 'Fixtures+Odds', category: 'fixture_registry', tier: 1, realtime: true, desc: 'Verified parseable next-fixtures and odds history for all 11 sports' },
  { name: 'FlashScore', url: 'https://www.flashscore.com', kind: 'primary', sport: 'multi', type: 'Live+Fixtures', category: 'live_scores', tier: 1, realtime: true, desc: 'Live scores and results with deep H2H history' },
  { name: '24Live', url: 'https://24live.com', kind: 'primary', sport: 'multi', type: 'Live+Fixtures', category: 'live_scores', tier: 2, realtime: true, desc: 'Live multi-sport results and fixtures' },
  { name: 'Sofascore', url: 'https://www.sofascore.com', kind: 'primary', sport: 'multi', type: 'Live+Stats', category: 'statistics_registry', tier: 1, realtime: true, desc: 'Live scores, stats and heatmaps multi-sport' },
  { name: 'LiveScore', url: 'https://www.livescore.com', kind: 'primary', sport: 'multi', type: 'Live+Odds', category: 'live_scores', tier: 2, realtime: true, desc: 'Live scores and real-time market odds' },
  { name: 'UniScore', url: 'https://uniscore.com/en/', kind: 'primary', sport: 'multi', type: 'Live', category: 'live_scores', tier: 3, realtime: true, desc: 'Real-time multi-sport scores and stats' },
  { name: 'RedScores', url: 'https://redscores.com/', kind: 'primary', sport: 'football', type: 'Results', category: 'fixture_registry', tier: 3, realtime: true, desc: 'Live scores and football results' },
  { name: 'MatchPlay', url: 'https://www.matchplay.com/en', kind: 'primary', sport: 'multi', type: 'Odds+Fixtures', category: 'fixture_registry', tier: 3, realtime: false, desc: 'Global matches and odds monitoring' }
];

const ODDS_REGISTRY_PRIMARY: PrimarySource[] = [
  { name: 'Oddsportal', url: 'https://www.oddsportal.com', kind: 'primary', type: 'Comparison', category: 'odds_registry', tier: 1, realtime: true, desc: 'Odds comparison from 80+ bookmakers' },
  { name: 'Oddschecker', url: 'https://www.oddschecker.com', kind: 'primary', type: 'Comparison', category: 'odds_registry', tier: 2, realtime: true, desc: 'Best odds comparison and free bets registry' },
  { name: 'OddsMonkey', url: 'https://www.oddsmonkey.com', kind: 'primary', type: 'Matched', category: 'odds_registry', tier: 3, realtime: false, desc: 'Matched betting tools and arbitrage finder' },
  { name: 'BetFair Exchange', url: 'https://www.betfair.com/exchange', kind: 'primary', type: 'Exchange', category: 'odds_registry', tier: 1, realtime: true, desc: 'Direct market odds with back/lay + volume' },
  { name: 'Pinnacle', url: 'https://www.pinnacle.com', kind: 'primary', type: 'Sharp', category: 'odds_registry', tier: 1, realtime: true, desc: 'Sharp bookmaker highest limits accurate odds' },
  { name: 'Oddspedia', url: 'https://oddspedia.com/', kind: 'primary', type: 'Comparison', category: 'odds_registry', tier: 2, realtime: true, desc: 'Odds comparison aggregator' }
];

const STATISTICS_REGISTRY_PRIMARY: PrimarySource[] = [
  { name: 'WhoScored', url: 'https://www.whoscored.com', kind: 'primary', sport: 'football', type: 'Deep Stats', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Detailed football stats, ratings and live data' },
  { name: 'FBref', url: 'https://fbref.com', kind: 'primary', sport: 'football', type: 'Advanced', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Advanced stats xG and progressive passes' },
  { name: '11v11', url: 'https://www.11v11.com', kind: 'primary', sport: 'football', type: 'History', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Historical stats and H2H records archive' },
  { name: 'Stathead Basketball', url: 'https://stathead.com/basketball', kind: 'primary', sport: 'basketball', type: 'Advanced', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Advanced NBA stats finder and analytics' },
  { name: 'ATP Stats', url: 'https://www.atptour.com/en/stats', kind: 'primary', sport: 'tennis', type: 'Official', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Official ATP statistics and rankings' },
  { name: 'TennisAbstract', url: 'https://www.tennisabstract.com', kind: 'primary', sport: 'tennis', type: 'Analytics', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Deep tennis analytics — win probability, serve stats' },
  { name: 'Elite Prospects', url: 'https://www.eliteprospects.com', kind: 'primary', sport: 'hockey', type: 'Scouting', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Ice hockey stats, player profiles and league data' },
  { name: 'Hockey Reference', url: 'https://www.hockey-reference.com', kind: 'primary', sport: 'hockey', type: 'NHL Stats', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Complete NHL statistics and historical data' },
  { name: 'Squawka', url: 'https://www.squawka.com', kind: 'primary', sport: 'football', type: 'Visuals', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Football data and stats visualisation — heatmaps' },
  { name: 'Understat', url: 'https://understat.com', kind: 'primary', sport: 'football', type: 'xG', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Expected goals (xG) and points data top leagues' },
  { name: 'Infogol', url: 'https://www.infogol.net', kind: 'primary', sport: 'football', type: 'AI', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Expected goals data and betting predictions' },
  { name: 'BTFStats', url: 'https://www.btfstats.com/', kind: 'primary', sport: 'football', type: 'Stats', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Both teams to score and goal statistics' },
  { name: 'SBOStats', url: 'https://www.sbostats.com/partite', kind: 'primary', sport: 'football', type: 'Stats', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Historical stats and probability data' },
  { name: 'SoccerStats', url: 'https://www.soccerstats.com/', kind: 'primary', sport: 'football', type: 'Deep Stats', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Comprehensive football statistics dataset' }
];

const PREDICTION_INTELLIGENCE_PRIMARY: PrimarySource[] = [
  { name: 'Forebet', url: 'https://www.forebet.com', kind: 'primary', sport: 'football', type: 'AI/Math', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Mathematical football predictions and probability percentages' },
  { name: 'Pinnacle Predictions', url: 'https://www.pinnacle.com/betting-resources/en/predictions', kind: 'primary', sport: 'multi', type: 'Sharp', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Pinnacle expert resources and sharp lines' },
  { name: 'Covers', url: 'https://www.covers.com/', kind: 'primary', sport: 'multi', type: 'Forum/Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Sports betting forum and matchup stats' },
  { name: 'Packball', url: 'https://packball.com/matches', kind: 'primary', sport: 'football', type: 'Predictions', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'Football match predictions' },
  { name: 'TennisBrain', url: 'https://www.tennisbrain.com/predictions/', kind: 'primary', sport: 'tennis', type: 'AI/Stats', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Tennis match predictions and analytics' },
  { name: 'AnnaBet Hoops', url: 'https://annabet.com/en/basketballstats/', kind: 'primary', sport: 'basketball', type: 'Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Basketball statistics and predictions' },
  { name: 'AnnaBet Soccer', url: 'https://annabet.com/en/soccerstats/', kind: 'primary', sport: 'football', type: 'Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Soccer statistics and predictions' },
  { name: 'NerdyTips', url: 'https://nerdytips.com/', kind: 'primary', sport: 'football', type: 'AI', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'AI algorithm football predictions' },
  { name: 'DailyFaceoff', url: 'https://www.dailyfaceoff.com/', kind: 'primary', sport: 'hockey', type: 'Lineups', category: 'prediction_intelligence', tier: 1, realtime: true, desc: 'NHL starting goalies and line combinations' },
  { name: 'Tipstrr', url: 'https://tipstrr.com', kind: 'primary', type: 'Verified', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Verified tipsters with tracked ROI' },
  { name: 'BettingExpert', url: 'https://www.bettingexpert.com', kind: 'primary', type: 'Community', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'Community tips with performance tracking' },
  { name: 'ProTipster', url: 'https://www.protipster.com', kind: 'primary', type: 'Professional', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'Professional service with verified records' },
  { name: 'PuntingMentor', url: 'https://www.puntingmentor.com', kind: 'primary', type: 'Strategy', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'Expert tips and staking plans' }
];

const BETTING_OPERATOR_PRIMARY: PrimarySource[] = [
  { name: 'Bet365', url: 'https://www.bet365.com', kind: 'primary', category: 'betting_operator', tier: 1, realtime: true, desc: 'Market leader for live betting/coverage' },
  { name: 'Betway', url: 'https://www.betway.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Global bookmaker with strong sports coverage' },
  { name: 'William Hill', url: 'https://www.williamhill.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Legacy UK bookmaker with deep markets' },
  { name: 'Paddy Power', url: 'https://www.paddypower.com', kind: 'primary', category: 'betting_operator', tier: 3, realtime: true, desc: 'Price boosts and unique markets' },
  { name: '1xBet', url: 'https://www.1xbet.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Widest range of markets and bet types' },
  { name: 'Unibet', url: 'https://www.unibet.com', kind: 'primary', category: 'betting_operator', tier: 3, realtime: true, desc: 'Strong tennis and ice hockey coverage' }
];

// ── INTELLIGENCE_DIRECTORY — now UPGRADED to PrimarySource tiered catalogue ──
// Every source in the intelligence directory is now a PRIMARY SOURCE with
// explicit category, tier, and realtime flags. The old ScraperSource "kind"
// field is preserved for backwards compatibility but is no longer the
// authoritative classification.
export const PREDICTION_SOURCES: PrimarySource[] = [
  { name: 'Forebet', url: 'https://www.forebet.com', kind: 'primary', sport: 'football', type: 'AI/Math', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Mathematical football predictions and probability percentages' },
  { name: 'RedScores', url: 'https://redscores.com/', kind: 'primary', sport: 'football', type: 'Results', category: 'fixture_registry', tier: 3, realtime: true, desc: 'Live scores and football results' },
  { name: 'BTFStats', url: 'https://www.btfstats.com/', kind: 'primary', sport: 'football', type: 'Stats', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Both teams to score and goal statistics' },
  { name: 'SBOStats', url: 'https://www.sbostats.com/partite', kind: 'primary', sport: 'football', type: 'Stats', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Historical stats and probability data' },
  { name: 'UniScore', url: 'https://uniscore.com/en/', kind: 'primary', sport: 'multi', type: 'Live', category: 'live_scores', tier: 3, realtime: true, desc: 'Real-time multi-sport scores and stats' },
  { name: 'SoccerStats', url: 'https://www.soccerstats.com/', kind: 'primary', sport: 'football', type: 'Deep Stats', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Comprehensive football statistics dataset' },
  { name: 'MatchPlay', url: 'https://www.matchplay.com/en', kind: 'primary', sport: 'multi', type: 'Odds', category: 'fixture_registry', tier: 3, realtime: false, desc: 'Global matches and odds monitoring' },
  { name: 'Pinnacle Predictions', url: 'https://www.pinnacle.com/betting-resources/en/predictions', kind: 'primary', sport: 'multi', type: 'Sharp', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Pinnacle expert resources and sharp lines' },
  { name: 'DailyFaceoff', url: 'https://www.dailyfaceoff.com/', kind: 'primary', sport: 'hockey', type: 'Lineups', category: 'prediction_intelligence', tier: 1, realtime: true, desc: 'NHL starting goalies and line combinations' },
  { name: 'Covers', url: 'https://www.covers.com/', kind: 'primary', sport: 'multi', type: 'Forum/Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Sports betting forum and matchup stats' },
  { name: 'Packball', url: 'https://packball.com/matches', kind: 'primary', sport: 'football', type: 'Predictions', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'Football match predictions' },
  { name: 'TennisBrain', url: 'https://www.tennisbrain.com/predictions/', kind: 'primary', sport: 'tennis', type: 'AI/Stats', category: 'prediction_intelligence', tier: 1, realtime: false, desc: 'Tennis match predictions and analytics' },
  { name: 'AnnaBet Hoops', url: 'https://annabet.com/en/basketballstats/', kind: 'primary', sport: 'basketball', type: 'Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Basketball statistics and predictions' },
  { name: 'AnnaBet Soccer', url: 'https://annabet.com/en/soccerstats/', kind: 'primary', sport: 'football', type: 'Stats', category: 'prediction_intelligence', tier: 2, realtime: false, desc: 'Soccer statistics and predictions' },
  { name: '24Live', url: 'https://24live.com/', kind: 'primary', sport: 'multi', type: 'Live', category: 'live_scores', tier: 2, realtime: true, desc: 'Live multi-sport results and fixtures' },
  { name: 'NerdyTips', url: 'https://nerdytips.com/', kind: 'primary', sport: 'football', type: 'AI', category: 'prediction_intelligence', tier: 3, realtime: false, desc: 'AI algorithm football predictions' }
];

export const STATISTICS_SOURCES: PrimarySource[] = [
  { name: 'WhoScored', url: 'https://www.whoscored.com', kind: 'primary', sport: 'football', type: 'Deep Stats', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Detailed football stats, ratings and live data' },
  { name: 'FBref', url: 'https://fbref.com', kind: 'primary', sport: 'football', type: 'Advanced', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Advanced stats including xG and progressive passes' },
  { name: 'Sofascore', url: 'https://www.sofascore.com', kind: 'primary', sport: 'multi', type: 'Heatmaps', category: 'statistics_registry', tier: 1, realtime: true, desc: 'Live scores, stats and heatmaps for multi-sports' },
  { name: 'FlashScore', url: 'https://www.flashscore.com', kind: 'primary', sport: 'multi', type: 'H2H', category: 'live_scores', tier: 1, realtime: true, desc: 'Live scores and results with deep H2H history' },
  { name: '11v11', url: 'https://www.11v11.com', kind: 'primary', sport: 'football', type: 'History', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Historical stats and H2H records archive' },
  { name: 'Stathead Basketball', url: 'https://stathead.com/basketball', kind: 'primary', sport: 'basketball', type: 'Advanced', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Advanced NBA stats finder and analytics' },
  { name: 'ATP Stats', url: 'https://www.atptour.com/en/stats', kind: 'primary', sport: 'tennis', type: 'Official', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Official ATP statistics and rankings' },
  { name: 'TennisAbstract', url: 'https://www.tennisabstract.com', kind: 'primary', sport: 'tennis', type: 'Analytics', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Deep tennis analytics — win probability, serve stats' },
  { name: 'Elite Prospects', url: 'https://www.eliteprospects.com', kind: 'primary', sport: 'hockey', type: 'Scouting', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Ice hockey stats, player profiles and league data' },
  { name: 'Hockey Reference', url: 'https://www.hockey-reference.com', kind: 'primary', sport: 'hockey', type: 'NHL Stats', category: 'statistics_registry', tier: 1, realtime: false, desc: 'Complete NHL statistics and historical data' },
  { name: 'Squawka', url: 'https://www.squawka.com', kind: 'primary', sport: 'football', type: 'Visuals', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Football data and stats visualisation — heatmaps' },
  { name: 'Understat', url: 'https://understat.com', kind: 'primary', sport: 'football', type: 'xG', category: 'statistics_registry', tier: 2, realtime: false, desc: 'Expected goals (xG) and points data for top leagues' },
  { name: 'Infogol', url: 'https://www.infogol.net', kind: 'primary', sport: 'football', type: 'AI', category: 'statistics_registry', tier: 3, realtime: false, desc: 'Expected goals data and betting predictions' }
];

export const ODDS_SOURCES: PrimarySource[] = [
  { name: 'Oddsportal', url: 'https://www.oddsportal.com', kind: 'primary', type: 'Comparison', category: 'odds_registry', tier: 1, realtime: true, desc: 'Odds comparison from 80+ bookmakers' },
  { name: 'Oddschecker', url: 'https://www.oddschecker.com', kind: 'primary', type: 'Comparison', category: 'odds_registry', tier: 2, realtime: true, desc: 'Best odds comparison and free bets registry' },
  { name: 'BetExplorer', url: 'https://www.betexplorer.com', kind: 'primary', type: 'History', category: 'fixture_registry', tier: 1, realtime: true, desc: 'Odds statistics and historical odds archive' },
  { name: 'OddsMonkey', url: 'https://www.oddsmonkey.com', kind: 'primary', type: 'Matched', category: 'odds_registry', tier: 3, realtime: false, desc: 'Matched betting tools and arbitrage finder' },
  { name: 'The Odds API', url: 'https://the-odds-api.com', kind: 'primary', type: 'API', category: 'provider_api', tier: 1, realtime: true, desc: 'Live odds API from 40+ international bookies' },
  { name: 'OddsPapi', url: 'https://api.oddspapi.io', kind: 'primary', type: 'API', category: 'provider_api', tier: 1, realtime: true, desc: 'Free sports data API — schedules & live odds for 69 sports / 370 books' },
  { name: 'SharpAPI', url: 'https://api.sharpapi.io', kind: 'primary', type: 'API', category: 'provider_api', tier: 1, realtime: true, desc: 'Flat real bookmaker odds (moneyline/spread/total) across major leagues' },
  { name: 'SportsGameOdds', url: 'https://api.sportsgameodds.com', kind: 'primary', type: 'API', category: 'provider_api', tier: 2, realtime: true, desc: 'Events + live odds for major leagues (NBA/NFL/MLB/NHL/MLS)' },
  { name: 'BetFair Exchange', url: 'https://www.betfair.com/exchange', kind: 'primary', type: 'Exchange', category: 'odds_registry', tier: 1, realtime: true, desc: 'Direct market odds with back/lay functionality' },
  { name: 'Pinnacle', url: 'https://www.pinnacle.com', kind: 'primary', type: 'Sharp', category: 'odds_registry', tier: 1, realtime: true, desc: 'Sharp bookmaker with highest limits/accurate odds' },
  { name: 'LiveScore', url: 'https://www.livescore.com', kind: 'primary', type: 'Live', category: 'live_scores', tier: 2, realtime: true, desc: 'Live scores and real-time market odds' }
];

export const TIPS_SOURCES: PrimarySource[] = [
  { name: 'Tipstrr', url: 'https://tipstrr.com', kind: 'primary', type: 'Verified', category: 'tipster_network', tier: 2, realtime: false, desc: 'Verified tipsters with tracked ROI' },
  { name: 'BettingExpert', url: 'https://www.bettingexpert.com', kind: 'primary', type: 'Community', category: 'tipster_network', tier: 3, realtime: false, desc: 'Community tips with performance tracking' },
  { name: 'ProTipster', url: 'https://www.protipster.com', kind: 'primary', type: 'Professional', category: 'tipster_network', tier: 3, realtime: false, desc: 'Professional service with verified records' },
  { name: 'PuntingMentor', url: 'https://www.puntingmentor.com', kind: 'primary', type: 'Strategy', category: 'tipster_network', tier: 3, realtime: false, desc: 'Expert tips and staking plans' }
];

export const BETTING_SOURCES: PrimarySource[] = [
  { name: 'Bet365', url: 'https://www.bet365.com', kind: 'primary', category: 'betting_operator', tier: 1, realtime: true, desc: 'Market leader for live betting/coverage' },
  { name: 'Betway', url: 'https://www.betway.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Global bookmaker with strong sports coverage' },
  { name: 'William Hill', url: 'https://www.williamhill.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Legacy UK bookmaker with deep markets' },
  { name: 'Paddy Power', url: 'https://www.paddypower.com', kind: 'primary', category: 'betting_operator', tier: 3, realtime: true, desc: 'Known for price boosts and unique markets' },
  { name: '1xBet', url: 'https://www.1xbet.com', kind: 'primary', category: 'betting_operator', tier: 2, realtime: true, desc: 'Widest range of markets and bet types' },
  { name: 'Unibet', url: 'https://www.unibet.com', kind: 'primary', category: 'betting_operator', tier: 3, realtime: true, desc: 'Strong tennis and ice hockey coverage' }
];

export const TIPSTER_SOURCES: PrimarySource[] = [
  { name: 'MyBetting Tips', url: 'https://mybettingtips.co.uk', kind: 'primary', sport: 'football', category: 'tipster_network', tier: 3, realtime: false, desc: 'Verified football tipsters with track records' },
  { name: 'Sportsbet.io Tips', url: 'https://sportsbet.io', kind: 'primary', sport: 'multi', category: 'tipster_network', tier: 3, realtime: false, desc: 'Crypto-integrated sports betting tips' },
  { name: 'Tennis Tips Daily', url: 'https://www.tennistipsdaily.com', kind: 'primary', sport: 'tennis', category: 'tipster_network', tier: 3, realtime: false, desc: 'Daily ATP/WTA betting tips' },
  { name: 'Hockey Betting Tips', url: 'https://www.hockeybettingtips.net', kind: 'primary', sport: 'hockey', category: 'tipster_network', tier: 3, realtime: false, desc: 'NHL and EU hockey predictions' }
];

export const NEWS_SOURCES: PrimarySource[] = [
  { name: 'BBC Sport', url: 'https://www.bbc.co.uk/sport', kind: 'primary', category: 'news_media', tier: 1, realtime: true, desc: 'Trusted sports news and injury reports' },
  { name: 'Sky Sports', url: 'https://www.skysports.com', kind: 'primary', category: 'news_media', tier: 1, realtime: true, desc: 'Live transfers and injury updates' },
  { name: 'ESPN', url: 'https://www.espn.com', kind: 'primary', category: 'news_media', tier: 1, realtime: true, desc: 'Global sports news coverage' },
  { name: 'The Athletic', url: 'https://theathletic.com', kind: 'primary', category: 'news_media', tier: 1, realtime: false, desc: 'In-depth journalism and insider team news' },
  { name: 'L Equipe', url: 'https://www.lequipe.fr', kind: 'primary', category: 'news_media', tier: 2, realtime: true, desc: 'French sports news (essential for Ligue 1)' },
  { name: 'Kicker', url: 'https://www.kicker.de', kind: 'primary', category: 'news_media', tier: 2, realtime: true, desc: 'German football news (essential for Bundesliga)' },
  { name: 'Marca', url: 'https://www.marca.com', kind: 'primary', category: 'news_media', tier: 2, realtime: true, desc: 'Spanish sports news (essential for La Liga)' },
  { name: 'Gazzetta dello Sport', url: 'https://www.gazzetta.it', kind: 'primary', category: 'news_media', tier: 2, realtime: true, desc: 'Italian sports news (essential for Serie A)' }
];

export const BLOG_SOURCES: PrimarySource[] = [
  { name: 'StatsBomb', url: 'https://www.statsbomb.com', kind: 'primary', category: 'analytics_blog', tier: 1, realtime: false, desc: 'Advanced football analytics and data journalism' },
  { name: 'WyScout Blog', url: 'https://blog.wyscout.com', kind: 'primary', category: 'analytics_blog', tier: 2, realtime: false, desc: 'Tactical insights and scouting data' },
  { name: 'Pinnacle Blog', url: 'https://www.pinnacle.com/en/betting-articles', kind: 'primary', category: 'analytics_blog', tier: 1, realtime: false, desc: 'Sharp betting education and strategy' },
  { name: 'The Hockey Writers', url: 'https://thehockeywriters.com', kind: 'primary', category: 'analytics_blog', tier: 2, realtime: false, desc: 'Ice hockey analysis and prospect reports' }
];

// ── Unified PRIMARY catalogue with 10 categories (all sources are now primary)
const TIPSTER_NETWORK_PRIMARY: PrimarySource[] = [...TIPS_SOURCES, ...TIPSTER_SOURCES];
const NEWS_MEDIA_PRIMARY: PrimarySource[] = [...NEWS_SOURCES];
const ANALYTICS_BLOG_PRIMARY: PrimarySource[] = [...BLOG_SOURCES];

export const PRIMARY_SOURCES_BY_CATEGORY: Record<SourceCategory, PrimarySource[]> = {
  provider_api: PROVIDER_API_PRIMARY,
  fixture_registry: FIXTURE_REGISTRY_PRIMARY,
  odds_registry: ODDS_REGISTRY_PRIMARY,
  statistics_registry: STATISTICS_REGISTRY_PRIMARY,
  prediction_intelligence: PREDICTION_INTELLIGENCE_PRIMARY,
  live_scores: FIXTURE_REGISTRY_PRIMARY.filter((s) => s.category === 'live_scores'),
  betting_operator: BETTING_OPERATOR_PRIMARY,
  tipster_network: TIPSTER_NETWORK_PRIMARY,
  news_media: NEWS_MEDIA_PRIMARY,
  analytics_blog: ANALYTICS_BLOG_PRIMARY
};

export const ALL_PRIMARY_SOURCES: PrimarySource[] = Array.from(
  new Map<string, PrimarySource>([
    ...PROVIDER_API_PRIMARY,
    ...FIXTURE_REGISTRY_PRIMARY,
    ...ODDS_REGISTRY_PRIMARY,
    ...STATISTICS_REGISTRY_PRIMARY,
    ...PREDICTION_INTELLIGENCE_PRIMARY,
    ...BETTING_OPERATOR_PRIMARY,
    ...PREDICTION_SOURCES,
    ...STATISTICS_SOURCES,
    ...ODDS_SOURCES,
    ...TIPS_SOURCES,
    ...BETTING_SOURCES,
    ...TIPSTER_SOURCES,
    ...NEWS_SOURCES,
    ...BLOG_SOURCES
  ].map((s) => [s.url, s])).values()
);

export const PRIMARY_SOURCE_URLS: string[] = Array.from(new Set(ALL_PRIMARY_SOURCES.map((s) => s.url)));

export function primarySourcesForSport(sportId: string): PrimarySource[] {
  return ALL_PRIMARY_SOURCES.filter((s) => !s.sport || s.sport === 'multi' || s.sport === sportId);
}

// Fixture parsing is intentionally restricted to FIXTURE_PAGES (the verified
// per-sport page lists below). The PRIORITY_SOURCES / sourceUrlsFor seeders were
// removed: feeding generic homepages (news, operators, tier-1 registries) into
// the row parsers was the #1 cause of cross-sport mislabelled fixtures.

// Verified-to-parse, per-sport live pages used by the fixture/odds agents.
// BetExplorer /next/ pages carry live decimal odds; Forebet/TennisBrain/AnnaBet
// give per-sport prediction rows; SoccerVista gives match links with form context.
export const FIXTURE_PAGES: Record<string, string[]> = {
  football: [
    'https://www.betexplorer.com/football/next/',
    'https://www.forebet.com/en/football-tips-and-predictions-for-today',
    'https://www.soccervista.com/predictions/',
    'https://annabet.com/en/soccerstats/',
    'https://www.betexplorer.com/football/'
  ],
  basketball: [
    'https://www.betexplorer.com/basketball/next/',
    'https://annabet.com/en/basketballstats/',
    'https://www.basketball-reference.com/boxscores/'
  ],
  tennis: [
    'https://www.betexplorer.com/tennis/next/',
    'https://www.tennisbrain.com/predictions/',
    'https://www.atptour.com/en/scores'
  ],
  rally: [
    'https://www.betexplorer.com/table-tennis/next/',
    'https://www.betexplorer.com/table-tennis/',
    'https://www.ittf.com/',
    'https://www.wttseries.com/'
  ],
  hockey: [
    'https://www.betexplorer.com/hockey/next/',
    'https://www.dailyfaceoff.com/',
    'https://www.nhl.com/scores'
  ],
  baseball: [
    'https://www.betexplorer.com/baseball/next/',
    'https://www.espn.com/mlb/schedule'
  ],
  americanfootball: [
    'https://www.betexplorer.com/american-football/next/',
    'https://www.espn.com/nfl/schedule',
    'https://www.flashscore.com/american-football/'
  ],
  rugby: [
    'https://www.betexplorer.com/rugby/next/',
    'https://www.espn.com/rugby/schedule',
    'https://www.rugbypass.com/fixtures/'
  ],
  cricket: [
    'https://www.betexplorer.com/cricket/',
    'https://www.espncricinfo.com/scores',
    'https://www.betexplorer.com/cricket/next/'
  ],
  mma: [
    'https://www.betexplorer.com/mixed-martial-arts/',
    'https://www.espn.com/mma/schedule',
    'https://www.sherdog.com/events/latest'
  ],
  volleyball: [
    'https://www.betexplorer.com/volleyball/next/',
    'https://www.fivb.com/competitions'
  ]
};

export const MINOR_LEAGUES: { name: string; code: string }[] = [
  { name: 'Eredivisie (Netherlands)', code: 'NED-1' },
  { name: 'Liga Portugal', code: 'POR-1' },
  { name: 'Championship (England)', code: 'ENG-2' },
  { name: 'Serie B (Italy)', code: 'ITA-2' },
  { name: 'Segunda Division (Spain)', code: 'ESP-2' }
];

// Backwards-compatible alias: ALL_SOURCES now maps to the unified PRIMARY
// catalogue. Every source is a primary source — the old "kind-only" second-class
// classification no longer exists anywhere in the registry.
export const ALL_SOURCES: ScraperSource[] = ALL_PRIMARY_SOURCES;

// ── Market catalogue the agents reason over (per sport) ───────────────────────
export interface MarketDef {
  id: string;
  label: string;
  icon: string;
  cat: string;
}
export const MARKET_GROUPS: Record<string, { label: string; emoji: string; markets: MarketDef[] }> = {
  football: {
    label: 'Football',
    emoji: '⚽',
    markets: [
      { id: '1x2', label: '1X2 Full Time', icon: '🏠', cat: 'Match Result' },
      { id: 'btts', label: 'Both Teams to Score', icon: '✅', cat: 'Goals' },
      { id: 'over25', label: 'Over 2.5 Goals', icon: '📈', cat: 'Goals' },
      { id: 'under35', label: 'Under 3.5 Goals', icon: '📉', cat: 'Goals' },
      { id: 'asian_hcp', label: 'Asian Handicap', icon: '⚖️', cat: 'Handicap' },
      { id: 'fh_goal', label: '1st Half Goal', icon: '⏱', cat: 'Halves' },
      { id: 'corners', label: 'Corners O/8.5', icon: '🚩', cat: 'Special' },
      { id: 'double_chance', label: 'Double Chance', icon: '🔒', cat: 'Handicap' }
    ]
  },
  basketball: {
    label: 'Basketball',
    emoji: '🏀',
    markets: [
      { id: 'moneyline', label: 'Moneyline', icon: '🏠', cat: 'Match Winner' },
      { id: 'spread', label: 'Point Spread', icon: '⚖️', cat: 'Handicap' },
      { id: 'total_pts', label: 'Total Points O/U', icon: '📈', cat: 'Totals' },
      { id: 'first_qtr', label: '1st Quarter Winner', icon: '⏱', cat: 'Quarter' },
      { id: 'team_pts', label: 'Team Total Points', icon: '📊', cat: 'Props' }
    ]
  },
  tennis: {
    label: 'Tennis',
    emoji: '🎾',
    markets: [
      { id: 'match_winner', label: 'Match Winner', icon: '🎾', cat: 'Winner' },
      { id: 'set_winner', label: 'Set Winner', icon: '1️⃣', cat: 'Sets' },
      { id: 'total_games', label: 'Total Games O/U', icon: '📈', cat: 'Games' },
      { id: 'tiebreak', label: 'Tiebreak in Match', icon: '⚡', cat: 'Special' }
    ]
  },
  hockey: {
    label: 'Ice Hockey',
    emoji: '🏒',
    markets: [
      { id: 'puck_line', label: 'Puck Line', icon: '⚖️', cat: 'Handicap' },
      { id: 'moneyline_ot', label: 'Moneyline (incl OT)', icon: '🏒', cat: 'Winner' },
      { id: 'total_goals', label: 'Total Goals O/U', icon: '📈', cat: 'Goals' },
      { id: 'period_winner', label: 'Period Winner', icon: '⏱', cat: 'Period' }
    ]
  },
  baseball: {
    label: 'Baseball',
    emoji: '⚾',
    markets: [
      { id: 'moneyline', label: 'Moneyline', icon: '🏠', cat: 'Match Result' },
      { id: 'run_line', label: 'Run Line', icon: '⚖️', cat: 'Handicap' },
      { id: 'total_runs', label: 'Total Runs O/U', icon: '📈', cat: 'Totals' }
    ]
  },
  rally: {
    label: 'Table Tennis',
    emoji: '🏓',
    markets: [
      { id: 'match_winner', label: 'Match Winner', icon: '🏓', cat: 'Winner' },
      { id: 'set_winner', label: 'Set Winner', icon: '1️⃣', cat: 'Sets' },
      { id: 'total_sets', label: 'Total Sets O/U', icon: '📈', cat: 'Sets' }
    ]
  },
  americanfootball: {
    label: 'American Football',
    emoji: '🏈',
    markets: [
      { id: 'moneyline', label: 'Moneyline', icon: '🏠', cat: 'Match Winner' },
      { id: 'spread', label: 'Point Spread', icon: '⚖️', cat: 'Handicap' },
      { id: 'total_pts', label: 'Total Points O/U', icon: '📈', cat: 'Totals' },
      { id: 'team_total', label: 'Team Total Points', icon: '📊', cat: 'Props' }
    ]
  },
  rugby: {
    label: 'Rugby',
    emoji: '🏉',
    markets: [
      { id: 'moneyline', label: 'Moneyline (2-way)', icon: '🏉', cat: 'Winner' },
      { id: 'handicap', label: 'Handicap', icon: '⚖️', cat: 'Handicap' },
      { id: 'total_pts', label: 'Total Points O/U', icon: '📈', cat: 'Totals' }
    ]
  },
  cricket: {
    label: 'Cricket',
    emoji: '🏏',
    markets: [
      { id: 'match_winner', label: 'Match Winner', icon: '🏏', cat: 'Result' },
      { id: 'total_runs', label: 'Total Runs O/U', icon: '📈', cat: 'Runs' },
      { id: 'run_line', label: 'Run Line', icon: '⚖️', cat: 'Handicap' }
    ]
  },
  mma: {
    label: 'MMA',
    emoji: '🥊',
    markets: [
      { id: 'fight_winner', label: 'Fight Winner', icon: '🥊', cat: 'Winner' },
      { id: 'total_rounds', label: 'Total Rounds O/U', icon: '📈', cat: 'Rounds' },
      { id: 'method', label: 'Method of Victory', icon: '🎯', cat: 'Method' }
    ]
  },
  volleyball: {
    label: 'Volleyball',
    emoji: '🏐',
    markets: [
      { id: 'match_winner', label: 'Match Winner', icon: '🏐', cat: 'Winner' },
      { id: 'total_sets', label: 'Total Sets O/U', icon: '📈', cat: 'Sets' },
      { id: 'set_winner', label: 'Set Winner', icon: '1️⃣', cat: 'Sets' }
    ]
  }
};

export const AI_STRENGTH_LEVELS: { level: string; accuracy: string; color: string }[] = [
  { level: 'Bronze', accuracy: '70-75%', color: '#cd7f32' },
  { level: 'Silver', accuracy: '76-82%', color: '#c0c0c0' },
  { level: 'Gold', accuracy: '83-89%', color: '#ffd700' },
  { level: 'Platinum', accuracy: '90-95%', color: '#e5e4e2' },
  { level: 'Diamond', accuracy: '96%+', color: '#b9f2ff' }
];

// ── Verified working sports data APIs ────────────────────────────────────────
// Provider priority for the live pipeline (see sportsApis.ts for the chain):
//   1. OddsPapi       — free, 69 sports, generous fixture schedules (PRIMARY)
//   2. SharpAPI       — flat real bookmaker odds (h2h/spread/total) across
//                       soccer/basketball/hockey/baseball/tennis
//   3. SportsGameOdds — events + odds for major leagues
//   4. ParlayAPI      — TOA-compatible free odds (drop-in, 1000 credits/month)
//   5. The Odds API   — the-odds-api (kept for drop-in parity, quota-capped)
//   6. TheSportsDB / BallDontLie / SportsData.io — multi-sport + NBA coverage
// The OddsPapi + SharpAPI keys are the always-on data layer; Parlay / TOA /
// SportsGameOdds free credit buckets are rotated so monthly allocations are
// spread across the whole month (see usage ledger in sportsApis.ts) instead of
// being exhausted at the start of the month.
export enum SportsApi {
  TheSportsDB = 'thesportsdb', // multi-sport fixtures (free public key)
  TheOddsApi = 'odds_api',     // ~78 sports, real bookmaker odds (quota-capped)
  BallDontLie = 'balldontlie', // NBA games/stats
  SportsDataIo = 'sportsdataio', // NBA scores
  OddsPapi = 'oddspapi',       // free: 69 sports, fixtures/schedules + odds
  SharpApi = 'sharpapi',       // flat real bookmaker odds (h2h/spread/total)
  SportsGameOdds = 'sportsgameodds', // events + odds, major leagues
  ParlayApi = 'parlay_api',    // the-odds-api drop-in (free, 1000 credits/mo)
  PinnApi = 'pinnapi'          // pinnacle-family odds (REST needs paid plan)
}

export const WORKING_APIS: { id: SportsApi; name: string; url: string; key: string }[] = [
  {
    id: SportsApi.TheSportsDB,
    name: 'TheSportsDB',
    url: 'https://www.thesportsdb.com/api/v1/json',
    key: 'THESPORTSDB_API_KEY'
  },
  {
    id: SportsApi.TheOddsApi,
    name: 'The Odds API',
    url: 'https://api.the-odds-api.com/v4',
    key: 'ODDS_API_KEY'
  },
  {
    id: SportsApi.BallDontLie,
    name: 'BallDontLie',
    url: 'https://api.balldontlie.io/v1',
    key: 'BALLDONTLIE_API_KEY'
  },
  {
    id: SportsApi.SportsDataIo,
    name: 'SportsData.io',
    url: 'https://api.sportsdata.io/v3',
    key: 'SPORT_DATA_IO_KEY'
  },
  {
    id: SportsApi.OddsPapi,
    name: 'OddsPapi',
    url: 'https://api.oddspapi.io/v4',
    key: 'ODDS_PAPI_API_KEY'
  },
  {
    id: SportsApi.SharpApi,
    name: 'SharpAPI',
    url: 'https://api.sharpapi.io/api/v1',
    key: 'SHARPAPI_API_KEY'
  },
  {
    id: SportsApi.SportsGameOdds,
    name: 'SportsGameOdds',
    url: 'https://api.sportsgameodds.com/v2',
    key: 'SPORTS_GAME_ODDS_API_KEY'
  },
  {
    id: SportsApi.ParlayApi,
    name: 'ParlayAPI',
    url: 'https://parlay-api.com/v1',
    key: 'PARLAY_API'
  },
  {
    id: SportsApi.PinnApi,
    name: 'PinnAPI',
    url: 'https://pinnapi.com',
    key: 'PINNAPI_API_KEY'
  }
];

export function apiUrl(id: SportsApi): string {
  return WORKING_APIS.find((a) => a.id === id)?.url ?? '';
}
export function apiKeyFor(id: SportsApi): string {
  if (id === SportsApi.TheSportsDB) {
    return env('THESPORTSDB_API_KEY') || '123';
  }
  return env(WORKING_APIS.find((a) => a.id === id)?.key ?? '');
}

export function env(name: string): string {
  return process.env[name]?.trim() || '';
}

export function jinaKey(): string {
  return env('JINA_API_KEY');
}
export function firecrawlKey(): string {
  return env('FIRECRAWL_API_KEY');
}
export function serperKey(): string {
  return env('SERPER_API_KEY');
}
export function brightdataKey(): string {
  return env('BRIGHTDATA_API_KEY');
}

export function dailyCap(): number {
  const raw = env('PREDICTOR_DAILY_CAP');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1200) : 1200;
}