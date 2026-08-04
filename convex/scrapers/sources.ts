// Central registry of every data source the AI Predictor agents consult.
// The primary feed is betwatch.fr; the rest are cross-reference registries used
// for odds confirmation, volume checks and research validation.
//
// Keys are read server-side from Convex env (set via `npx convex env set`), never
// committed to the repo.

declare const process: { env: Record<string, string | undefined> };

export interface ScraperSource {
  name: string;
  url: string;
  kind: 'primary' | 'odds' | 'betting' | 'prediction';
  sport?: string;
}

export const PRIMARY_SOURCE = 'https://betwatch.fr/';

export const ODDS_SOURCES: ScraperSource[] = [
  { name: 'Oddsportal', url: 'https://www.oddsportal.com', kind: 'odds' },
  { name: 'Oddschecker', url: 'https://www.oddschecker.com', kind: 'odds' },
  { name: 'BetExplorer', url: 'https://www.betexplorer.com', kind: 'odds' },
  { name: 'The Odds API', url: 'https://the-odds-api.com', kind: 'odds' },
  { name: 'Pinnacle', url: 'https://www.pinnacle.com', kind: 'odds' },
  { name: 'BetFair Exchange', url: 'https://www.betfair.com/exchange', kind: 'odds' }
];

export const BETTING_SOURCES: ScraperSource[] = [
  { name: 'Bet365', url: 'https://www.bet365.com', kind: 'betting' },
  { name: 'Betway', url: 'https://www.betway.com', kind: 'betting' },
  { name: 'William Hill', url: 'https://www.williamhill.com', kind: 'betting' },
  { name: '1xBet', url: 'https://www.1xbet.com', kind: 'betting' }
];

export const PREDICTION_SOURCES: ScraperSource[] = [
  { name: 'SportyTrader', url: 'https://www.sportytrader.com', kind: 'prediction' },
  { name: 'SoccerVista', url: 'https://www.soccervista.com', kind: 'prediction', sport: 'football' },
  { name: 'Betmate', url: 'https://betmate.ai', kind: 'prediction' },
  { name: 'Soccerstats', url: 'https://www.soccerstats.com', kind: 'prediction', sport: 'football' },
  { name: 'Basketball-Reference', url: 'https://www.basketball-reference.com', kind: 'prediction', sport: 'basketball' }
];

export const ALL_SOURCES: ScraperSource[] = [...ODDS_SOURCES, ...BETTING_SOURCES, ...PREDICTION_SOURCES];

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
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : 250;
}
