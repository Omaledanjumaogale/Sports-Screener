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

export const PRIMARY_SOURCE = 'https://betwatch.fr/';

// ── INTELLIGENCE_DIRECTORY ────────────────────────────────────────────────────
export const PREDICTION_SOURCES: ScraperSource[] = [
  { name: 'Forebet', url: 'https://www.forebet.com', kind: 'prediction', sport: 'football', type: 'AI/Math', desc: 'Mathematical football predictions and probability percentages' },
  { name: 'Sports-IQ', url: 'https://sports-iq.co.uk', kind: 'prediction', sport: 'multi', type: 'Analytics', desc: 'Sports intelligence and betting analytics' },
  { name: 'RedScores', url: 'https://redscores.com/', kind: 'prediction', sport: 'football', type: 'Results', desc: 'Live scores and football results' },
  { name: 'BTFStats', url: 'https://www.btfstats.com/', kind: 'prediction', sport: 'football', type: 'Stats', desc: 'Both teams to score and goal statistics' },
  { name: 'SBOStats', url: 'https://www.sbostats.com/partite', kind: 'prediction', sport: 'football', type: 'Stats', desc: 'Historical stats and probability data' },
  { name: 'UniScore', url: 'https://uniscore.com/en/', kind: 'prediction', sport: 'multi', type: 'Live', desc: 'Real-time multi-sport scores and stats' },
  { name: 'SoccerStats', url: 'https://www.soccerstats.com/', kind: 'prediction', sport: 'football', type: 'Deep Stats', desc: 'Comprehensive football statistics dataset' },
  { name: 'MatchPlay', url: 'https://www.matchplay.com/en', kind: 'prediction', sport: 'multi', type: 'Odds', desc: 'Global matches and odds monitoring' },
  { name: 'Pinnacle Predictions', url: 'https://www.pinnacle.com/betting-resources/en/predictions', kind: 'prediction', sport: 'multi', type: 'Sharp', desc: 'Pinnacle expert resources and sharp lines' },
  { name: 'DailyFaceoff', url: 'https://www.dailyfaceoff.com/', kind: 'prediction', sport: 'hockey', type: 'Lineups', desc: 'NHL starting goalies and line combinations' },
  { name: 'Covers', url: 'https://www.covers.com/', kind: 'prediction', sport: 'multi', type: 'Forum/Stats', desc: 'Sports betting forum and matchup stats' },
  { name: 'Packball', url: 'https://packball.com/matches', kind: 'prediction', sport: 'football', type: 'Predictions', desc: 'Football match predictions' },
  { name: 'StatsChecker', url: 'https://www.statschecker.com/', kind: 'prediction', sport: 'multi', type: 'Stats', desc: 'Sports statistics checker' },
  { name: 'TennisBrain', url: 'https://www.tennisbrain.com/predictions/', kind: 'prediction', sport: 'tennis', type: 'AI/Stats', desc: 'Tennis match predictions and analytics' },
  { name: 'AnnaBet Hoops', url: 'https://annabet.com/en/basketballstats/', kind: 'prediction', sport: 'basketball', type: 'Stats', desc: 'Basketball statistics' },
  { name: 'AnnaBet Soccer', url: 'https://annabet.com/en/soccerstats/', kind: 'prediction', sport: 'football', type: 'Stats', desc: 'Soccer statistics' },
  { name: 'ProgSport', url: 'https://www.progsport.com/', kind: 'prediction', sport: 'multi', type: 'Predictions', desc: 'Progressive sports predictions' },
  { name: 'DailySports Math', url: 'https://dailysports.net/mathematical-predictions/', kind: 'prediction', sport: 'multi', type: 'AI/Math', desc: 'Mathematical predictions' },
  { name: '24Live', url: 'https://24live.com/', kind: 'prediction', sport: 'multi', type: 'Live', desc: 'Live multi-sport results and fixtures' },
  { name: 'BettingBuddy', url: 'https://www.bettingbuddy.tips/en-US', kind: 'prediction', sport: 'multi', type: 'Tips', desc: 'Sports betting tips' },
  { name: 'NerdyTips', url: 'https://nerdytips.com/', kind: 'prediction', sport: 'football', type: 'AI', desc: 'AI algorithm football predictions' },
  { name: 'FootballTips365', url: 'https://footballtips365.co.uk/', kind: 'prediction', sport: 'football', type: 'Tips', desc: 'Football tips everyday' },
  { name: '365Scores Insights', url: 'https://www.365scores.com/football/league/premier-league-7/insights', kind: 'prediction', sport: 'football', type: 'Insights', desc: '365Scores league insights' },
  { name: 'Statarea', url: 'https://www.statarea.com/', kind: 'prediction', sport: 'football', type: 'Stats', desc: 'Statistics and predictions algorithm' }
];

export const STATISTICS_SOURCES: ScraperSource[] = [
  { name: 'WhoScored', url: 'https://www.whoscored.com', kind: 'statistics', sport: 'football', type: 'Deep Stats', desc: 'Detailed football stats, ratings and live data' },
  { name: 'FBref', url: 'https://fbref.com', kind: 'statistics', sport: 'football', type: 'Advanced', desc: 'Advanced stats including xG and progressive passes' },
  { name: 'Sofascore', url: 'https://www.sofascore.com', kind: 'statistics', sport: 'multi', type: 'Heatmaps', desc: 'Live scores, stats and heatmaps for multi-sports' },
  { name: 'FlashScore', url: 'https://www.flashscore.com', kind: 'statistics', sport: 'multi', type: 'H2H', desc: 'Live scores and results with deep H2H history' },
  { name: '11v11', url: 'https://www.11v11.com', kind: 'statistics', sport: 'football', type: 'History', desc: 'Historical stats and H2H records archive' },
  { name: 'Stathead Basketball', url: 'https://stathead.com/basketball', kind: 'statistics', sport: 'basketball', type: 'Advanced', desc: 'Advanced NBA stats finder and analytics' },
  { name: 'ATP Stats', url: 'https://www.atptour.com/en/stats', kind: 'statistics', sport: 'tennis', type: 'Official', desc: 'Official ATP statistics and rankings' },
  { name: 'TennisAbstract', url: 'https://www.tennisabstract.com', kind: 'statistics', sport: 'tennis', type: 'Analytics', desc: 'Deep tennis analytics — win probability, serve stats' },
  { name: 'Elite Prospects', url: 'https://www.eliteprospects.com', kind: 'statistics', sport: 'hockey', type: 'Scouting', desc: 'Ice hockey stats, player profiles and league data' },
  { name: 'Hockey Reference', url: 'https://www.hockey-reference.com', kind: 'statistics', sport: 'hockey', type: 'NHL Stats', desc: 'Complete NHL statistics and historical data' },
  { name: 'Squawka', url: 'https://www.squawka.com', kind: 'statistics', sport: 'football', type: 'Visuals', desc: 'Football data and stats visualisation — heatmaps' },
  { name: 'Understat', url: 'https://understat.com', kind: 'statistics', sport: 'football', type: 'xG', desc: 'Expected goals (xG) and points data for top leagues' },
  { name: 'Infogol', url: 'https://www.infogol.net', kind: 'statistics', sport: 'football', type: 'AI', desc: 'Expected goals data and betting predictions' }
];

export const ODDS_SOURCES: ScraperSource[] = [
  { name: 'Oddsportal', url: 'https://www.oddsportal.com', kind: 'odds', type: 'Comparison', desc: 'Odds comparison from 80+ bookmakers' },
  { name: 'Oddschecker', url: 'https://www.oddschecker.com', kind: 'odds', type: 'Comparison', desc: 'Best odds comparison and free bets registry' },
  { name: 'BetExplorer', url: 'https://www.betexplorer.com', kind: 'odds', type: 'History', desc: 'Odds statistics and historical odds archive' },
  { name: 'OddsMonkey', url: 'https://www.oddsmonkey.com', kind: 'odds', type: 'Matched', desc: 'Matched betting tools and arbitrage finder' },
  { name: 'The Odds API', url: 'https://the-odds-api.com', kind: 'odds', type: 'API', desc: 'Live odds API from 40+ international bookies' },
  { name: 'OddsPapi', url: 'https://api.oddspapi.io', kind: 'odds', type: 'API', desc: 'Free sports data API — schedules & live odds for 69 sports / 370 books' },
  { name: 'SharpAPI', url: 'https://api.sharpapi.io', kind: 'odds', type: 'API', desc: 'Flat real bookmaker odds (moneyline/spread/total) across major leagues' },
  { name: 'SportsGameOdds', url: 'https://api.sportsgameodds.com', kind: 'odds', type: 'API', desc: 'Events + live odds for major leagues (NBA/NFL/MLB/NHL/MLS' },
  { name: 'BetFair Exchange', url: 'https://www.betfair.com/exchange', kind: 'odds', type: 'Exchange', desc: 'Direct market odds with back/lay functionality' },
  { name: 'Pinnacle', url: 'https://www.pinnacle.com', kind: 'odds', type: 'Sharp', desc: 'Sharp bookmaker with highest limits/accurate odds' },
  { name: 'LiveScore', url: 'https://www.livescore.com', kind: 'odds', type: 'Live', desc: 'Live scores and real-time market odds' }
];

export const TIPS_SOURCES: ScraperSource[] = [
  { name: 'Tipstrr', url: 'https://tipstrr.com', kind: 'tips', type: 'Verified', desc: 'Verified tipsters with tracked ROI' },
  { name: 'BettingExpert', url: 'https://www.bettingexpert.com', kind: 'tips', type: 'Community', desc: 'Community tips with performance tracking' },
  { name: 'ProTipster', url: 'https://www.protipster.com', kind: 'tips', type: 'Professional', desc: 'Professional service with verified records' },
  { name: 'Zulubet', url: 'https://www.zulubet.com', kind: 'tips', type: 'Aggregator', desc: 'Aggregator of tips from multiple sources' },
  { name: 'Vitibet', url: 'https://vitibet.com', kind: 'tips', type: 'Free', desc: 'Free predictions with statistical backing' },
  { name: 'Victorspredict', url: 'https://www.victorspredict.com', kind: 'tips', type: 'Analysis', desc: 'Football predictions with deep analysis' },
  { name: 'PuntingMentor', url: 'https://www.puntingmentor.com', kind: 'tips', type: 'Strategy', desc: 'Expert tips and staking plans' }
];

export const BETTING_SOURCES: ScraperSource[] = [
  { name: 'Bet365', url: 'https://www.bet365.com', kind: 'betting', desc: 'Market leader for live betting/coverage' },
  { name: 'Betway', url: 'https://www.betway.com', kind: 'betting', desc: 'Global bookmaker with strong sports coverage' },
  { name: 'William Hill', url: 'https://www.williamhill.com', kind: 'betting', desc: 'Legacy UK bookmaker with deep markets' },
  { name: 'Paddy Power', url: 'https://www.paddypower.com', kind: 'betting', desc: 'Known for price boosts and unique markets' },
  { name: '1xBet', url: 'https://www.1xbet.com', kind: 'betting', desc: 'Widest range of markets and bet types' },
  { name: 'Unibet', url: 'https://www.unibet.com', kind: 'betting', desc: 'Strong tennis and ice hockey coverage' }
];

export const TIPSTER_SOURCES: ScraperSource[] = [
  { name: 'MyBetting Tips', url: 'https://mybettingtips.co.uk', kind: 'tipsters', sport: 'football', desc: 'Verified football tipsters with track records' },
  { name: 'Sportsbet.io Tips', url: 'https://sportsbet.io', kind: 'tipsters', sport: 'multi', desc: 'Crypto-integrated sports betting tips' },
  { name: 'FootballTipster Pro', url: 'https://www.footballtippro.com', kind: 'tipsters', sport: 'football', desc: 'Pro football subscription service' },
  { name: 'Tennis Tips Daily', url: 'https://www.tennistipsdaily.com', kind: 'tipsters', sport: 'tennis', desc: 'Daily ATP/WTA betting tips' },
  { name: 'Hockey Betting Tips', url: 'https://www.hockeybettingtips.net', kind: 'tipsters', sport: 'hockey', desc: 'NHL and EU hockey predictions' }
];

export const NEWS_SOURCES: ScraperSource[] = [
  { name: 'BBC Sport', url: 'https://www.bbc.co.uk/sport', kind: 'news', desc: 'Trusted sports news and injury reports' },
  { name: 'Sky Sports', url: 'https://www.skysports.com', kind: 'news', desc: 'Live transfers and injury updates' },
  { name: 'ESPN', url: 'https://www.espn.com', kind: 'news', desc: 'Global sports news coverage' },
  { name: 'The Athletic', url: 'https://theathletic.com', kind: 'news', desc: 'In-depth journalism and insider team news' },
  { name: 'L Equipe', url: 'https://www.lequipe.fr', kind: 'news', desc: 'French sports news (essential for Ligue 1)' },
  { name: 'Kicker', url: 'https://www.kicker.de', kind: 'news', desc: 'German football news (essential for Bundesliga)' },
  { name: 'Marca', url: 'https://www.marca.com', kind: 'news', desc: 'Spanish sports news (essential for La Liga)' },
  { name: 'Gazzetta dello Sport', url: 'https://www.gazzetta.it', kind: 'news', desc: 'Italian sports news (essential for Serie A)' }
];

export const BLOG_SOURCES: ScraperSource[] = [
  { name: 'StatsBomb', url: 'https://www.statsbomb.com', kind: 'blog', desc: 'Advanced football analytics and data journalism' },
  { name: 'WyScout Blog', url: 'https://blog.wyscout.com', kind: 'blog', desc: 'Tactical insights and scouting data' },
  { name: 'Pinnacle Blog', url: 'https://www.pinnacle.com/en/betting-articles', kind: 'blog', desc: 'Sharp betting education and strategy' },
  { name: 'Tennis World USA', url: 'https://www.tennisworldusa.org', kind: 'blog', desc: 'Tennis news and betting insights' },
  { name: 'The Hockey Writers', url: 'https://thehockeywriters.com', kind: 'blog', desc: 'Ice hockey analysis and prospect reports' }
];

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

export const PRIORITY_SOURCES: string[] = [
  'https://www.flashscore.com',
  'https://www.sofascore.com',
  'https://www.oddsportal.com',
  'https://www.forebet.com',
  'https://www.pinnacle.com/en/',
  'https://www.bet365.com/#/HO/',
  'https://oddspedia.com/',
  'https://sports-iq.co.uk',
  'https://www.soccerstats.com/',
  'https://24live.com/page/sport/match-list/soccer-5'
];

export const MINOR_LEAGUES: { name: string; code: string }[] = [
  { name: 'Eredivisie (Netherlands)', code: 'NED-1' },
  { name: 'Liga Portugal', code: 'POR-1' },
  { name: 'Championship (England)', code: 'ENG-2' },
  { name: 'Serie B (Italy)', code: 'ITA-2' },
  { name: 'Segunda Division (Spain)', code: 'ESP-2' }
];

// Full directory of every URL the agents may consult, deduplicated. The primary
// feed + per-sport pages come first (these are actually read); the priority
// sources and the rest are cross-reference registries for research/citation.
export function sourceUrlsFor(sportId: string): string[] {
  const pages = FIXTURE_PAGES[sportId] ?? FIXTURE_PAGES.football;
  const relevant = ALL_SOURCES.filter((s) => !s.sport || s.sport === 'multi' || s.sport === sportId);
  const seeds = [
    PRIMARY_SOURCE,
    ...pages,
    ...PRIORITY_SOURCES,
    ...relevant.map((s) => s.url)
  ];
  return Array.from(new Set(seeds));
}

export const ALL_SOURCES: ScraperSource[] = [
  ...PREDICTION_SOURCES,
  ...STATISTICS_SOURCES,
  ...ODDS_SOURCES,
  ...TIPS_SOURCES,
  ...BETTING_SOURCES,
  ...TIPSTER_SOURCES,
  ...NEWS_SOURCES,
  ...BLOG_SOURCES
];

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