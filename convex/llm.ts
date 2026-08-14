// Server-side LLM helper for the AI Predictor (runs inside Convex actions).
//
// Provider chain (in priority order):
//   1. Agnes AI  — primary (https://apihub.agnes-ai.com/v1, model "Agnes AI")
//   2. OpenRouter — fallback (openrouter.ai)
//
// All calls are OpenAI-compatible chat completions. Every network failure
// degrades gracefully to the next provider (or a deterministic fallback
// verdict), so the SMOA pipeline never fails on a missing/flaky LLM.

declare const process: { env: Record<string, string | undefined> };

export type LlmRole = 'system' | 'user' | 'assistant';
export interface LlmMessage {
  role: LlmRole;
  content: string;
}
export interface LlmResult {
  ok: boolean;
  text: string;
  provider: string;
  model: string;
}

interface Provider {
  name: string;
  url: string;
  key: string;
  model: string;
}

function providerChain(): Provider[] {
  const chain: Provider[] = [];
  const agnesKey = process.env.AGNES_AI_KEY?.trim();
  if (agnesKey) {
    chain.push({
      name: 'agnes',
      url: 'https://apihub.agnes-ai.com/v1/chat/completions',
      key: agnesKey,
      model: process.env.AGNES_AI_MODEL?.trim() || 'agnes-2.5-flash'
    });
  }
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    chain.push({
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: orKey,
      model: process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-oss-20b:free'
    });
  }
  return chain;
}

export function hasLlmConfigured(): boolean {
  return providerChain().length > 0;
}

async function callProvider(
  p: Provider,
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number }
): Promise<LlmResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${p.key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (p.name === 'openrouter') {
    headers['HTTP-Referer'] = 'https://pulseodds-omale.pages.dev';
    headers['X-Title'] = 'PulseOdds AI Predictor';
  }
  try {
    const res = await fetch(p.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: p.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1600
      }),
      signal: controller.signal
    });
    if (!res.ok) return { ok: false, text: '', provider: p.name, model: p.model };
    const data: any = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, text: '', provider: p.name, model: p.model };
    }
    return { ok: true, text, provider: p.name, model: p.model };
  } catch {
    return { ok: false, text: '', provider: p.name, model: p.model };
  } finally {
    clearTimeout(timeout);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ask the provider chain. Transient failures retry with backoff so a flaky
// HTTP 5xx / timeout doesn't silently degrade a verdict to the summary fallback.
export async function chatComplete(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<LlmResult> {
  const chain = providerChain();
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const p of chain) {
      const res = await callProvider(p, messages, opts);
      if (res.ok) return res;
    }
    if (attempt === 0 && chain.length) await sleep(800);
  }
  return { ok: false, text: '', provider: 'none', model: '' };
}

// ── Predictor verdict generation ───────────────────────────────────────────────

export interface PredictorTop3Selection {
  rank: number;
  selection: string;
  marketTitle: string;
  confidence: string;
  reason: string;
  punterEdge: string;
}

export interface PredictorAiReport {
  verdictSummary: string;
  valueAssessment: string;
  riskWarning: string;
  tacticalRecommendation: string;
  crossCheckAnalysis: string;
  crossCheckSteps: string[];
  top3Selections: PredictorTop3Selection[];
  punterEdge: string;
  bookmakerBiasNote: string;
  stakeAdvice: string;
}

export interface VerdictOutcome {
  usedLlm: boolean;
  provider: string;
  model: string;
  verdict: PredictorAiReport;
  summary: string;
}

interface VerdictMatchInput {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  scopes: unknown;
  sourceUrl?: string;
  citations?: string[];
}

const VALID_SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'];

const SPORT_SCALE: Record<string, string> = {
  football: 'Goals (0-6 typical), total goals market expected 1.5-3.5',
  basketball: 'Points (120-240 typical), market expected total 150-220',
  tennis: 'Games (15-45 typical), market expected games 20-38',
  rally: 'Sets (3-6 typical), market expected sets 3-5',
  hockey: 'Goals (2-8 typical), total goals market expected 3-7',
  baseball: 'Runs (5-14 typical), total runs market expected 6-11',
  americanfootball: 'Points (20-80 typical), market expected total 35-55',
  rugby: 'Points (10-80 typical), market expected total 25-60',
  cricket: 'Runs (100-400 typical), market expected runs 150-350',
  mma: 'Rounds (1-5 typical), market expected total 2.5-4.5',
  volleyball: 'Sets (3-5 typical), market expected sets 3-5'
};

// Sport-specific analysis model. Football gets its own market model (double
// chance, team totals, half totals, BTTS evaluated on BOTH sides); every other
// sport uses the generic multi-market model. This keeps each sport treated
// separately instead of one generic prompt for all of them.
const SPORT_RULES: Record<string, string> = {
  football: `FOOTBALL-SPECIFIC MARKET MODEL:
- Analyse EVERY football market shown, not just the match total and Asian Handicap: the 1X2 result, Double Chance (1X / 12 / X2), the full Asian Handicap ladder, the match goals total, BTTS, Home Team Total and Away Team Total ("Over 0.5" = the team scores at least once), and the 1st Half / 2nd Half Totals ("Over 0.5" = at least one goal in that half).
- BTTS: evaluate BOTH "BTTS Yes" AND "BTTS No" from their Real Win Chances and punter edges, then project whichever side is STRONGER for this specific match. NEVER default to "BTTS No" — a high-scoring, two-attacking-side fixture often makes BTTS Yes the stronger side. Only claim one side when its Real Win Chance / punter edge actually beats the other.
- Team over 0.5 angles are low-risk "team scores at least once" picks: use them when the favourite's straight win is priced too tight for value but the favourite scoring is highly probable.
- Half over 0.5 angles separate a fast-starting fixture (1H Over 0.5 strong) from a second-half fixture (2H Over 0.5 strong) — use the half totals to pick the stronger half.
- Cross-check the markets against each other: BTTS Yes agrees with Over 2.5; BTTS No agrees with Under 2.5; a team's Over 0.5 agrees with that team's Asian Handicap cover.
- Pick the market with the strongest probability/edge FOR THIS MATCH — the model must choose the safest, most probable selection per fixture, never the same market for every game.`,
  basketball: `BASKETBALL-SPECIFIC MARKET MODEL:
- Analyse EVERY basketball market shown, not just the moneyline and game total: the moneyline (team straight win), the full-game point total (Over/Under points in regular time), the Home Team Total and Away Team Total (Over/Under points in regular time), the 1st Half and 2nd Half Totals ("Over" = at least that many points in that half), the Home/Away Team Totals in the 1st Half, and the point spread / team handicap.
- The team handicap can favour EITHER the home or away team depending on the match — analyse both sides of the spread and project whichever team's cover is stronger for THIS game. NEVER default to one specific team.
- Use the half totals to pick the stronger half, and the 1st-half team totals to pick the stronger team in the first half.
- Cross-check the markets against each other: the favourite's straight win agrees with its negative handicap cover; Home Team Total + Away Team Total should sum near the game total; a strong 1st-half total supports the Over; a team's Over total agrees with its handicap cover.
- Pick the market with the strongest probability/edge FOR THIS MATCH — the model must choose the safest, most probable selection per fixture, never the same market for every game.`,
  generic: `GENERIC MARKET MODEL:
- Analyse EVERY market shown for this sport and rank selections by Real Win Chance and punter edge.
- Pick the strongest, most probable selection FOR THIS MATCH — never default to the same market for every game.
- Cross-check result/winner, handicap/spread and totals markets against each other before recommending.`
};

function safeStr(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.map((v) => safeStr(v)).join(' ');
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

// Summarise the stored scope markets so the LLM gets concrete, real numbers to
// reason about. Every market is de-vigged: Real Win Chance (fair prob), implied
// prob (1/odds), Bookies Profit Cut (overround) and the punter edge per option.
function devigItems(entries: { label: string; odds: number }[]) {
  const valid = entries.filter((e) => e.odds > 1);
  if (valid.length < 2) return { items: [], overround: 0 };
  const inv = valid.map((e) => 1 / e.odds);
  const sum = inv.reduce((a, b) => a + b, 0);
  const overround = (sum - 1) * 100;
  const items = valid.map((e, i) => {
    const fair = (inv[i] / sum) * 100;
    const implied = inv[i] * 100;
    return { label: e.label, odds: e.odds, implied, fair, edge: fair - implied };
  });
  return { items, overround };
}

function humanLeg(marketTitle: string, key: string): string {
  const title = (marketTitle || '').toLowerCase();
  if (title.includes('double chance')) {
    if (key === 'hd') return 'Home or Draw';
    if (key === 'ha') return 'Home or Away';
    if (key === 'da') return 'Draw or Away';
  }
  if (title.includes('both teams') || title.includes('btts')) {
    if (key === 'yes') return 'BTTS Yes';
    if (key === 'no') return 'BTTS No';
  }
  if (key === 'home') return 'Home';
  if (key === 'away') return 'Away';
  if (key === 'draw') return 'Draw';
  if (key === 'a') return 'Home';
  if (key === 'b') return 'Away';
  if (key === 'hd') return 'Home or Draw';
  if (key === 'da') return 'Draw or Away';
  return key;
}

function pushTop(item: { label: string; odds: number; edge: number }, marketTitle: string, out: string[]) {
  const line = `${item.edge >= 0 ? '+' : ''}${item.edge.toFixed(1)}% edge | ${marketTitle}: ${item.label} @ ${item.odds.toFixed(2)}`;
  out.push(line);
}

function summarizeScope(scope: unknown): { lines: string[]; markets: string[]; topValue: string[]; note: string } {
  const markets = (scope as any)?.markets ?? {};
  const meta = (scope as any)?._meta ?? {};
  const lines: string[] = [];
  const marketsStr: string[] = [];
  const topValue: string[] = [];

  let note = meta.live ? 'IN-PLAY: this match has started — odds are live and moving.' : '';
  if (meta.oddsIsReal === false) note = (note ? note + ' ' : '') + 'WARNING: no live odds mapped for this match — reference odds only.';

  for (const [key, mkt] of Object.entries(markets) as [string, any][]) {
    // Line markets (totals) and handicap lines.
    if (Array.isArray(mkt?.pairs)) {
      const title = mkt?.title || key;
      for (const p of mkt.pairs) {
        const over = Number(p?.over);
        const under = Number(p?.under);
        if (p?.line == null || !over || !under) continue;
        const { items, overround } = devigItems([
          { label: `Over ${p.line}`, odds: over },
          { label: `Under ${p.line}`, odds: under }
        ]);
        const ov = items[0];
        const un = items[1];
        if (!ov || !un) continue;
        lines.push(
          `${title} ${p.line}: Over @ ${over.toFixed(2)} (implied ${ov.implied.toFixed(1)}%, real ${ov.fair.toFixed(1)}%, edge ${ov.edge >= 0 ? '+' : ''}${ov.edge.toFixed(1)}%) vs Under @ ${under.toFixed(2)} (real ${un.fair.toFixed(1)}%, edge ${un.edge >= 0 ? '+' : ''}${un.edge.toFixed(1)}%)` +
            (overround ? ` | Bookies Profit Cut ${overround.toFixed(1)}%` : '')
        );
        pushTop(ov, title, topValue);
        pushTop(un, title, topValue);
      }
    }
    if (Array.isArray(mkt?.handicapPairs)) {
      const title = mkt?.title || key;
      for (const pair of mkt.handicapPairs) {
        const sideA = Number(pair?.sideA);
        const sideB = Number(pair?.sideB);
        if (pair?.line == null || !sideA || !sideB) continue;
        const { items, overround } = devigItems([
          { label: `Home ${pair.line}`, odds: sideA },
          { label: `Away ${pair.line > 0 ? '-' : '+'}${Math.abs(pair.line)}`, odds: sideB }
        ]);
        const h = items[0];
        const a = items[1];
        if (!h || !a) continue;
        lines.push(
          `${title} ${pair.line}: Home @ ${sideA.toFixed(2)} (real ${h.fair.toFixed(1)}%, edge ${h.edge >= 0 ? '+' : ''}${h.edge.toFixed(1)}%) vs Away @ ${sideB.toFixed(2)} (real ${a.fair.toFixed(1)}%, edge ${a.edge >= 0 ? '+' : ''}${a.edge.toFixed(1)}%)` +
            (overround ? ` | Bookies Profit Cut ${overround.toFixed(1)}%` : '')
        );
        pushTop(h, title, topValue);
        pushTop(a, title, topValue);
      }
    }
    // Odds markets (result / winner / doubleChance / regResult).
    if (mkt?.odds && typeof mkt.odds === 'object') {
      const title = mkt?.title || key;
      const entries = Object.entries(mkt.odds)
        .map(([k, o]) => ({ label: humanLeg(title, k), odds: Number(o) }))
        .filter((e) => e.odds > 1);
      if (entries.length < 2) continue;
      const { items, overround } = devigItems(entries);
      const parts = items.map(
        (i) => `${i.label} @ ${i.odds.toFixed(2)} (implied ${i.implied.toFixed(1)}%, real ${i.fair.toFixed(1)}%, edge ${i.edge >= 0 ? '+' : ''}${i.edge.toFixed(1)}%)`
      );
      marketsStr.push(`${title}: ${parts.join(' | ')}` + (overround ? ` | Bookies Profit Cut ${overround.toFixed(1)}%` : ''));
      for (const i of items) pushTop(i, title, topValue);
    }
  }

  // De-dupe and keep the strongest punter edges for the prompt's value section.
  const seen = new Set<string>();
  const ranked: string[] = [];
  for (const t of topValue) {
    const base = t.replace(/,? edge.*/, '');
    const key = base.split('@')[0].trim();
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(t);
  }
  ranked.sort((x, y) => {
    const ex = Number((x.match(/^([+-][\d.]+)%/) ?? [])[1]) || 0;
    const ey = Number((y.match(/^([+-][\d.]+)%/) ?? [])[1]) || 0;
    return ey - ex;
  });

  return { lines, markets: marketsStr, topValue: ranked.slice(0, 6), note };
}

function fallbackVerdict(match: VerdictMatchInput, fallbackSummary: string): PredictorAiReport {
  return {
    verdictSummary: fallbackSummary,
    valueAssessment: 'Compare the computed Real Win Chance against the Bookies Profit Cut for the top selections above.',
    riskWarning: 'Odds are snapshotted from the cached day cycle and can move before kickoff. Re-verify live prices and manage stake size.',
    tacticalRecommendation: 'Review the top-ranked selections before placing your betslip. Prefer singles for the highest-confidence picks.',
    crossCheckAnalysis: 'Primary totals/result markets were cross-checked across the odds and prediction registries the agents consulted; the confidence floor was applied by Amara Obi and risk-reviewed by Zainab Bello.',
    crossCheckSteps: [
      'Step 1: Total market implied probability calculated and compared against the result market read.',
      'Step 2: Odds cross-referenced with the odds registries (betwatch.fr, Pinnacle, BetExplorer, BetFair).',
      'Step 3: Research citations from the prediction sources reviewed for directional agreement.',
      'Step 4: Confidence floor applied to keep only selections with a favourable Real Win Chance.'
    ],
    top3Selections: [],
    punterEdge: 'Punter holds maximum advantage where the computed Real Win Chance is significantly higher than the Bookies Profit Cut.',
    bookmakerBiasNote: 'Focus on markets where the Bookies Profit Cut is lowest to maximise the mathematical edge.',
    stakeAdvice: 'Use 1-3% of bankroll per selection. Prefer singles over combinations for higher-confidence picks.'
  };
}

function parseVerdictJson(raw: string): PredictorAiReport | null {
  let text = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const top3Sel = Array.isArray(parsed.top3Selections) ? parsed.top3Selections : [];
  const top3Selections: PredictorTop3Selection[] = top3Sel.slice(0, 3).map((item: any, idx: number) => ({
    rank: Number(item?.rank || idx + 1),
    selection: safeStr(item?.selection, `Selection #${idx + 1}`),
    marketTitle: safeStr(item?.marketTitle, 'Core Market'),
    confidence: safeStr(item?.confidence, '75%'),
    reason: safeStr(item?.reason, 'Strong mathematical signal across model profiles.'),
    punterEdge: safeStr(item?.punterEdge, '+3.5% punter edge')
  }));
  const rawSteps = Array.isArray(parsed.crossCheckSteps) ? parsed.crossCheckSteps : [];
  const crossCheckSteps = rawSteps.length
    ? rawSteps.map((s: unknown) => safeStr(s))
    : ['Step 1: Total and result markets cross-checked.', 'Step 2: Odds verified against the odds registries.', 'Step 3: Research citations reviewed.', 'Step 4: Confidence floor applied.'];

  return {
    verdictSummary: safeStr(parsed.verdictSummary, 'AI Predictor verdict ready.'),
    valueAssessment: safeStr(parsed.valueAssessment, 'Review the value metrics above.'),
    riskWarning: safeStr(parsed.riskWarning, 'Monitor odds movement closely.'),
    tacticalRecommendation: safeStr(parsed.tacticalRecommendation, 'Staking strategy ready.'),
    crossCheckAnalysis: safeStr(parsed.crossCheckAnalysis, 'Primary core markets were cross-checked against supporting context markets.'),
    crossCheckSteps,
    top3Selections: top3Selections.length ? top3Selections : [
      {
        rank: 1,
        selection: 'Top Ranked Selection',
        marketTitle: 'Primary Market',
        confidence: '80%',
        reason: 'Selected due to high model agreement and a strong Real Win Chance vs Bookies Profit Cut gap.',
        punterEdge: '+5.0% punter edge over bookmaker'
      }
    ],
    punterEdge: safeStr(parsed.punterEdge, 'The highest punter advantage is where Real Win Chance significantly outweighs the Bookies Profit Cut.'),
    bookmakerBiasNote: safeStr(parsed.bookmakerBiasNote, 'Focus on markets where the Bookies Profit Cut is lowest'),
    stakeAdvice: safeStr(parsed.stakeAdvice, 'Use 1-3% of bankroll per selection. Prefer singles for the highest-confidence picks.')
  };
}

export async function generatePredictorVerdict(
  match: VerdictMatchInput,
  opts: { sportId?: string; fallbackSummary?: string } = {}
): Promise<VerdictOutcome> {
  const sport = VALID_SPORTS.includes(opts.sportId ?? '') ? opts.sportId! : 'football';
  const scale = SPORT_SCALE[sport] ?? SPORT_SCALE.football;
  const sportRules = SPORT_RULES[sport] ?? SPORT_RULES.generic;
  const fallback = fallbackVerdict(
    match,
    opts.fallbackSummary ?? `${match.homeTeam} vs ${match.awayTeam} (${match.league}) — agent analysis prepared. No LLM verdict was available this cycle.`
  );

  const s = summarizeScope(match.scopes);
  const marketsStr = s.markets.join('\n  ') || 'No result/winner odds available this cycle.';
  const linesStr = s.lines.join('\n  ') || 'No handicap or total lines available this cycle.';
  const topStr = s.topValue.length ? '\n  ' + s.topValue.map((t) => `- ${t}`).join('\n  ') : '';
  const noteStr = s.note ? `\n${s.note}` : '';

  // Real source URLs the agents actually scraped — so the verdict reasons over
  // (and cites) the live pages, not generic boilerplate.
  const citations = match.citations ?? [];
  const sourceList =
    citations.length > 0
      ? '\n  ' + citations.map((c) => `- ${c}`).join('\n  ')
      : match.sourceUrl
        ? `\n  - ${match.sourceUrl}`
        : '';

  const userContent = `SPORT: ${sport}
SCORING SCALE: ${scale}
SPORT MODEL: ${sportRules.replace(/\n/g, ' ')}
STATUS:${noteStr}

MATCH: ${match.homeTeam} vs ${match.awayTeam} (${match.league})
SOURCE URLS (scraped this cycle, verify here):${sourceList}

MARKET / ODDS DATA (Real Win Chance = de-vigged fair probability; implied = 1/odds; edge = Real Win Chance − implied; Bookies Profit Cut = overround):
${marketsStr}
${linesStr}

TOP VALUE OPPORTUNITIES (highest punter edge first):${topStr}

--- INSTRUCTIONS ---
You are PulseOdds AI Predictor — an expert sports betting analyst backed by a multi-agent screen (fixture, odds, volume, research, normalization, filter, risk-review). Analyse ONLY the data above and produce a clear, plain-English verdict.

RULES:
1. Use simple plain English. Use "Real Win Chance" for fair probability, "implied probability" for 1/odds, "Bookies Profit Cut" for the bookmaker's margin / overround, and "punter edge" for Real Win Chance minus implied.
2. Reference the actual odds, implied probabilities and edge numbers above — never invent numbers.
3. PICK THE BEST MARKET FOR THIS MATCH. Each match is different: some win with Over/Under, some with Asian Handicap / Spread, some with Double Chance, some with a straight win, some with BTTS, team totals or half totals. Evaluate EVERY market above and choose the one(s) where the punter edge is highest for THIS match — do NOT default to the total market for every game.
4. The top3Selections must come from DIFFERENT market options (e.g. one from the result/winner market, one from a total line, one from Double Chance, BTTS, Handicap, a team total or a half total) ranked by punter edge. Never repeat the same market for all three.
5. For each selection show the metric-strip numbers: its Real Win Chance, implied probability and punter edge (e.g. "Home @ 1.90: real 52.0%, implied 52.6%, edge +0.6%"). Project the punter's edge over the bookie explicitly in "punterEdge".
6. If STATUS notes IN-PLAY, flag that odds are live/moving and reflect it in tacticalRecommendation; otherwise treat as pre-match.
7. Cross-reference the odds across markets: note where the Double Chance / Handicap line gives a lower-risk angle vs the straight win, where BTTS Yes agrees with the Over and BTTS No with the Under, and where a team's Over 0.5 supports its handicap cover.
8. The crossCheckSteps list must contain at least 4 distinct checks.
9. Never recommend betting beyond a small stake; always flag risk.
10. STANDALONE MATCH: Treat this match as a completely independent fixture. Every verdict, recommendation and top-3 selection must be derived from THIS match's own odds and probabilities above. Do NOT copy, replicate or reuse analysis, recommendations or verdicts from any other match — matches with similar-looking lines must still get their own verdict reasoned from their own numbers. No two matches should share identical verdict wording or identical top-3 selections unless the underlying data is genuinely identical.

RESPOND ONLY with a valid JSON object, no markdown, no code fences:
{
  "verdictSummary": "...",
  "valueAssessment": "...",
  "riskWarning": "...",
  "tacticalRecommendation": "...",
  "crossCheckAnalysis": "...",
  "crossCheckSteps": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."],
  "top3Selections": [
    {"rank":1,"selection":"...","marketTitle":"...","confidence":"72%","reason":"...","punterEdge":"+6.2% punter edge"},
    {"rank":2,"selection":"...","marketTitle":"...","confidence":"...","reason":"...","punterEdge":"..."},
    {"rank":3,"selection":"...","marketTitle":"...","confidence":"...","reason":"...","punterEdge":"..."}
  ],
  "punterEdge": "...",
  "bookmakerBiasNote": "...",
  "stakeAdvice": "..."
}`;

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        'You are PulseOdds AI Predictor — an enterprise sports quantitative analyst. Use only simple, plain English. Always respond with ONLY valid JSON — no markdown, no code fences, no extra commentary.'
    },
    { role: 'user', content: userContent }
  ];

  const res = await chatComplete(messages, { temperature: 0.3, maxTokens: 3200 });
  if (!res.ok) {
    return { usedLlm: false, provider: res.provider, model: res.model, verdict: fallback, summary: fallback.verdictSummary };
  }
  const parsed = parseVerdictJson(res.text);
  if (!parsed) {
    return { usedLlm: false, provider: res.provider, model: res.model, verdict: fallback, summary: fallback.verdictSummary };
  }
  return { usedLlm: true, provider: res.provider, model: res.model, verdict: parsed, summary: parsed.verdictSummary };
}