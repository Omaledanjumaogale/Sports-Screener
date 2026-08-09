// Public API + internal persistence for the AI Predictor.
// Public queries/mutations are read/write for the predictor UI. Internal
// mutations (marked `internal`) are called only by the SMOA orchestrator.

import { query, mutation, action, internalMutation, internalAction, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

const sportId = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('baseball'),
  v.literal('americanfootball'),
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
);

const dayStatus = v.union(
  v.literal('pending'),
  v.literal('refreshing'),
  v.literal('ready'),
  v.literal('partial'),
  v.literal('stale'),
  v.literal('error')
);

const runStatus = v.union(
  v.literal('pending'),
  v.literal('running'),
  v.literal('complete'),
  v.literal('error')
);

// ── Per-sport keyword fingerprints ────────────────────────────────────────────
// Each entry is a list of words/phrases that POSITIVELY identify a match as
// belonging to that sport. A match must contain at least one of these to be
// admitted into that sport's tab.
const SPORT_KEYWORDS: Record<string, string[]> = {
  football: [
    'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'ligue 2',
    'champions league', 'europa league', 'conference league', 'championship',
    'league one', 'league two', 'eredivisie', 'primeira liga', 'super lig',
    'liga mx', 'mls', 'npfl', 'copa libertadores', 'copa america', 'fa cup',
    'efl cup', 'dfb pokal', 'copa del rey', 'coppa italia', 'soccer', 'football',
    'arsenal', 'chelsea', 'liverpool', 'man city', 'manchester', 'real madrid',
    'barcelona', 'bayern', 'juventus', 'inter milan', 'ac milan', 'psg', 'paris sg',
    'tottenham', 'everton', 'dortmund', 'napoli', 'roma', 'benfica', 'porto',
    'sporting', 'ajax', 'feyenoord', 'psv', 'celtic', 'newcastle', 'aston villa',
    'west ham', 'brighton', 'wolves', 'fulham', 'brentford', 'crystal palace',
    'leicester', 'southampton', 'leeds', 'nottingham', 'sevilla', 'villarreal',
    'real sociedad', 'betis', 'getafe', 'valencia', 'osasuna', 'lazio', 'atalanta',
    'fiorentina', 'torino', 'bologna', 'monaco', 'lille', 'marseille', 'lyon',
    'rennes', 'nice', 'leipzig', 'leverkusen', 'frankfurt', 'wolfsburg', 'gladbach',
    'scottish premiership', 'belgian pro league', 'turkish super lig', 'allsvenskan',
    'eliteserien', 'danish superliga', 'swiss super league', 'greek super league',
    'austrian bundesliga', 'brazil serie a', 'argentina primera', 'chile primera',
    'efl', 'cup final', 'world cup qualifying', 'nations league'
  ],
  basketball: [
    'nba', 'euroleague', 'wnba', 'ncaab', 'acb', 'liga acb', 'cba', 'pba',
    'lnb pro', 'fiba', 'basketball', 'celtics', 'lakers', 'warriors', 'bucks',
    'bulls', 'heat', 'knicks', 'nets', '76ers', 'clippers', 'suns', 'mavericks',
    'nuggets', 'raptors', 'hawks', 'pacers', 'hornets', 'wizards', 'pistons',
    'cavaliers', 'thunder', 'trail blazers', 'grizzlies', 'pelicans', 'spurs',
    'rockets', 'jazz', 'timberwolves', 'kings', 'magic', 'olympiacos', 'real madrid basket',
    'fenerbahce', 'anadolu efes', 'panathinaikos', 'maccabi', 'cska moscow',
    'alba berlin', 'baskonia', 'valencia basket', 'zenit', 'virtus bologna'
  ],
  tennis: [
    'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open',
    'australian open', 'roland garros', 'masters 1000', 'atp tour', 'wta tour',
    'alcaraz', 'sinner', 'djokovic', 'zverev', 'medvedev', 'swiatek', 'sabalenka',
    'rybakina', 'pegula', 'gauff', 'halep', 'osaka', 'federer', 'nadal', 'murray',
    'berrettini', 'tsitsipas', 'ruud', 'rune', 'norrie', 'fritz', 'tiafoe',
    'kyrgios', 'khachanov', 'hurkacz', 'bublik', 'auger-aliassime', 'tennis'
  ],
  rally: [
    'ittf', 'wtt', 'table tennis', 'ping pong', 'tt cup', 'world table tennis',
    'lebrun', 'harimoto', 'zhendong', 'ma long', 'fan zhendong', 'timo boll',
    'ovtcharov', 'chuqin', 'wang chuqin', 'yingsha', 'sun yingsha', 'chen meng',
    'calderano', 'aruna', 'moregard', 'jorgic', 'qiu', 'franziska', 'manyu',
    'lin gaoyuan', 'liang jingkun', 'pitchford', 'filus', 'samsonov', 'toth'
  ],
  hockey: [
    'nhl', 'khl', 'shl', 'liiga', 'ahl', 'del', 'czech extraliga', 'nl switzerland',
    'ice hockey', 'hockey', 'bruins', 'canadiens', 'maple leafs', 'rangers',
    'oilers', 'flames', 'canucks', 'senators', 'jets', 'avalanche', 'blues',
    'wild', 'predators', 'stars', 'blackhawks', 'red wings', 'penguins', 'flyers',
    'devils', 'islanders', 'sabres', 'capitals', 'hurricanes', 'panthers', 'lightning',
    'coyotes', 'sharks', 'ducks', 'kings', 'kraken', 'golden knights', 'cska', 'ska'
  ],
  baseball: [
    'mlb', 'npb', 'kbo', 'milb', 'baseball', 'yankees', 'red sox', 'dodgers',
    'giants', 'cubs', 'white sox', 'mets', 'astros', 'blue jays', 'rays',
    'athletics', 'mariners', 'angels', 'rangers', 'phillies', 'braves', 'marlins',
    'nationals', 'cardinals', 'brewers', 'reds', 'pirates', 'padres', 'rockies',
    'diamondbacks', 'tigers', 'royals', 'twins', 'guardians', 'orioles',
    'lvbp', 'lmb', 'australian baseball'
  ],
  americanfootball: [
    'nfl', 'ncaaf', 'xfl', 'cfl', 'super bowl', 'american football',
    'chiefs', 'eagles', 'cowboys', '49ers', 'ravens', 'bills', 'bengals',
    'steelers', 'browns', 'jets', 'patriots', 'dolphins', 'texans', 'jaguars',
    'colts', 'titans', 'raiders', 'chargers', 'broncos', 'packers', 'vikings',
    'bears', 'lions', 'buccaneers', 'falcons', 'saints', 'panthers', 'rams',
    'seahawks', 'cardinals', 'commanders', 'giants nfl'
  ],
  rugby: [
    'rugby', 'six nations', 'all blacks', 'springboks', 'wallabies', 'top 14',
    'super rugby', 'premiership rugby', 'urc', 'pro14', 'world cup rugby',
    'rugby league', 'rugby union', 'rugby international', 'english premiership',
    'new zealand', 'south africa', 'australia', 'ireland', 'scotland', 'wales',
    'france rugby', 'england rugby', 'argentina rugby', 'fiji', 'samoa',
    'tonga', 'japan rugby', 'stade toulousain', 'leinster', 'munster',
    'exeter chiefs', 'saracens', 'bath rugby', 'northampton', 'bristol rugby',
    'stormers', 'bulls rugby', 'lions rugby', 'sharks rugby', 'highlanders',
    'chiefs rugby', 'crusaders', 'blues rugby'
  ],
  cricket: [
    'cricket', 'ipl', 'big bash', 'hundred', 'test match', 'test cricket',
    'odi', 't20 international', 'pakistan super league', 'psl', 'bbl',
    'cricketer', 'bcci', 'icc', 'over', 'wicket', 'innings', 'super league cricket',
    'mumbai indians', 'chennai super kings', 'royal challengers', 'sunrisers',
    'kolkata knight', 'delhi capitals', 'rajasthan royals', 'punjab kings'
  ],
  mma: [
    'ufc', 'bellator', 'pfl', 'one championship', 'mma', 'mixed martial arts',
    'makhachev', 'topuria', 'namajunas', 'pereira', 'adesanya', 'jones',
    'ngannou', 'poirier', 'gaethje', 'volkanovski', 'holloway', 'strickland',
    'du plessis', 'aspinall', 'blachowicz', 'teixeira', 'procházka', 'ankalaev',
    'chimaev', 'covington', 'edwards', 'usman', 'championship fight', 'fight night'
  ],
  volleyball: [
    'volleyball', 'vnl', 'fivb', 'superlega', 'superleague volleyball',
    'cev champions league', 'brazil superliga', 'volleyball nations league',
    'world championship volleyball', 'italy serie a1 volleyball',
    'russian superleague', 'turkish volleyball'
  ]
};

/**
 * Returns true when a match genuinely belongs to `sportId`.
 * Uses TWO gates:
 *  1. POSITIVE: the league/team text contains at least one keyword that
 *     fingerprints this sport (or the match came from a typed API source).
 *  2. NEGATIVE: the text must NOT contain a keyword that fingerprints a
 *     DIFFERENT sport (prevents a rugby match leaking into basketball tab).
 */
export function matchBelongsToSport(
  m: { league?: string; homeTeam?: string; awayTeam?: string; source?: string },
  sportId: string
): boolean {
  const text = `${m.league || ''} ${m.homeTeam || ''} ${m.awayTeam || ''}`.toLowerCase();
  const ownKeywords = SPORT_KEYWORDS[sportId] ?? [];
  const fromTypedApi = /^(LiveAPI|TheSportsDB|BallDontLie|SportsData|OddsPapi|SharpAPI)/i.test(m.source ?? '');

  // NEGATIVE GATE — reject if matches another sport's fingerprint.
  for (const [sid, kws] of Object.entries(SPORT_KEYWORDS)) {
    if (sid === sportId) continue;
    if (kws.some((k) => text.includes(k))) return false;
  }

  // POSITIVE GATE — must contain at least one of this sport's keywords,
  // OR have arrived via a typed API that already performed sport filtering.
  if (fromTypedApi) return true;
  return ownKeywords.some((k) => text.includes(k));
}

// Backwards-compatible helper
export function isFootballMatch(m: { league?: string; homeTeam?: string; awayTeam?: string }): boolean {
  return matchBelongsToSport(m, 'football');
}

// ── Public queries ────────────────────────────────────────────────────────────

export const getDay = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

export const listMatches = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();

    return raw.filter((m) => matchBelongsToSport(m, args.sportId));
  }
});

// Range view for the AI Predictor date picker: every cached match for a sport
// whose cache day falls inside [fromDay, toDay]. Matches are stored under their
// dayKey (the day the agent ran for), NOT their kickoff startTime.
export const listMatchesInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    const raw = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();

    return raw.filter((m) => matchBelongsToSport(m, args.sportId));
  }
});

// Day-cache status for every day in a window (inclusive dayKey bounds). Lets the
// homepage show which of the 1–7 days actually have cached data/verdicts.
export const listDaysInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();
  }
});

export const getVerdict = query({
  args: { dayKey: v.string(), matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorVerdicts')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
  }
});

export const getDailyPnlSummary = query({
  args: { dayKey: v.string(), filter: v.optional(v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL'))) },
  handler: async (ctx, args) => {
    const filter = args.filter ?? 'ALL';
    return await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', filter))
      .first();
  }
});

export const saveDailyPnlSummary = mutation({
  args: {
    dayKey: v.string(),
    filter: v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL')),
    overallWinRatePct: v.number(),
    overallUnitsPnl: v.number(),
    overallRoiPct: v.number(),
    rows: v.any()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', args.filter))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
      return existing._id;
    } else {
      return await ctx.db.insert('aiPredictorStats', {
        dayKey: args.dayKey,
        filter: args.filter,
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
    }
  }
});

export const updateMatchResult = mutation({
  args: {
    matchId: v.string(),
    dayKey: v.string(),
    finalScore: v.string(),
    status: v.optional(
      v.union(v.literal('upcoming'), v.literal('inplay'), v.literal('finished'))
    )
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query('predictorMatches')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
    if (!match) {
      throw new Error(`Match not found: ${args.dayKey}/${args.matchId}`);
    }
    await ctx.db.patch(match._id, {
      finalScore: args.finalScore,
      status: args.status ?? 'finished',
      oddsSnapshot: {
        ...(match.oddsSnapshot ?? {}),
        finalScore: args.finalScore
      }
    });
    return { dayKey: args.dayKey, matchId: args.matchId, finalScore: args.finalScore, status: args.status ?? 'finished' };
  }
});

export const getActiveRun = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// ── Public mutation: user-triggered refresh ───────────────────────────────────

export const startRefresh = mutation({
  args: { sportId, dayKey: v.string(), incremental: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incremental = args.incremental ?? false;
    const runId = `run_${incremental ? 'inc_' : ''}${args.sportId}_${args.dayKey}_${now}`;

    const existing = await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();

    if (existing && existing.status === 'running') return { runId: existing.runId, alreadyRunning: true };

    await ctx.db.insert('predictorRuns', {
      runId,
      dayKey: args.dayKey,
      sportId: args.sportId,
      progress: 0,
      stage: 'Queued',
      status: 'running',
      startedAt: now,
      updatedAt: now
    });

    await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first()
      .then(async (day) => {
        if (day) {
          await ctx.db.patch(day._id, { status: 'refreshing', runId, updatedAt: now });
        } else {
          await ctx.db.insert('predictorDays', {
            dayKey: args.dayKey,
            sportId: args.sportId,
            status: 'refreshing',
            expiresAt: now + 24 * 60 * 60 * 1000,
            runId,
            cap: 1200,
            sourcesUsed: [],
            createdAt: now,
            updatedAt: now
          });
        }
      });

    // Fire-and-forget: kick off the orchestrator without blocking the mutation.
    // If scheduling fails (e.g. the internal action is missing/not deployed),
    // degrade the run/day to 'error' gracefully instead of 500-ing the mutation.
    try {
      if (incremental) {
        await ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runIncrementalRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      }
    } catch (err: any) {
      console.error('[predictor] failed to schedule refresh:', err?.message || err);
      await ctx.db
        .query('predictorRuns')
        .withIndex('by_runId', (q) => q.eq('runId', runId))
        .first()
        .then(async (run) => {
          if (run) {
            await ctx.db.patch(run._id, {
              status: 'error',
              stage: 'Failed',
              message: String(err?.message || err).slice(0, 300),
              completedAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        });
      await ctx.db
        .query('predictorDays')
        .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
        .order('desc')
        .first()
        .then(async (day) => {
          if (day) {
            await ctx.db.patch(day._id, { status: 'error', message: String(err?.message || err).slice(0, 300), updatedAt: Date.now() });
          }
        });
    }

    return { runId, alreadyRunning: false };
  }
});

// ── Internal mutations (orchestrator-only) ────────────────────────────────────

export const updateRun = internalMutation({
  args: {
    runId: v.string(),
    progress: v.number(),
    stage: v.string(),
    status: v.optional(runStatus),
    message: v.optional(v.string()),
    completedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('predictorRuns')
      .withIndex('by_runId', (q) => q.eq('runId', args.runId))
      .first();
    if (!run) return;
    await ctx.db.patch(run._id, {
      progress: Math.max(0, Math.min(100, Math.round(args.progress))),
      stage: args.stage,
      status: args.status ?? run.status,
      message: args.message ?? run.message,
      completedAt: args.completedAt ?? run.completedAt,
      updatedAt: Date.now()
    });
  }
});

export const upsertDay = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    status: dayStatus,
    runId: v.optional(v.string()),
    cap: v.optional(v.number()),
    sourcesUsed: v.optional(v.array(v.string())),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        runId: args.runId ?? existing.runId,
        cap: args.cap ?? existing.cap,
        sourcesUsed: args.sourcesUsed ?? existing.sourcesUsed,
        message: args.message,
        lastRefreshAt: args.status === 'ready' || args.status === 'partial' ? now : existing.lastRefreshAt,
        updatedAt: now
      });
      return existing._id;
    }
    return await ctx.db.insert('predictorDays', {
      dayKey: args.dayKey,
      sportId: args.sportId,
      status: args.status,
      runId: args.runId,
      cap: args.cap ?? 1200,
      sourcesUsed: args.sourcesUsed ?? [],
      message: args.message,
      expiresAt: now + 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const replaceMatches = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    matches: v.array(
      v.object({
        matchId: v.string(),
        league: v.string(),
        homeTeam: v.string(),
        awayTeam: v.string(),
        startTime: v.number(),
        source: v.string(),
        marketsAvailable: v.array(v.string()),
        scopes: v.any()
      })
    )
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .collect();
    for (const m of existing) await ctx.db.delete(m._id);

    const now = Date.now();
    for (const m of args.matches) {
      await ctx.db.insert('predictorMatches', {
        dayKey: args.dayKey,
        sportId: args.sportId,
        matchId: m.matchId,
        league: m.league,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        startTime: m.startTime,
        source: m.source,
        marketsAvailable: m.marketsAvailable,
        scopes: m.scopes,
        createdAt: now
      });
    }
    return args.matches.length;
  }
});

export const insertVerdicts = internalMutation({
  args: {
    dayKey: v.string(),
    sportId,
    verdicts: v.array(
      v.object({
        matchId: v.string(),
        agentsRun: v.array(v.string()),
        citations: v.array(v.string()),
        floor: v.number(),
        scopeSummary: v.string(),
        llmUsed: v.optional(v.boolean()),
        llmProvider: v.optional(v.string()),
        aiReport: v.optional(v.any())
      })
    )
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const vv of args.verdicts) {
      const existing = await ctx.db
        .query('predictorVerdicts')
        .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', vv.matchId))
        .first();
      const aiReport =
        vv.aiReport && typeof vv.aiReport === 'object'
          ? vv.aiReport
          : {
              verdictSummary: vv.scopeSummary,
              valueAssessment: '',
              riskWarning: '',
              tacticalRecommendation: '',
              crossCheckAnalysis: '',
              crossCheckSteps: [],
              top3Selections: [],
              punterEdge: '',
              bookmakerBiasNote: '',
              stakeAdvice: ''
            };
      const patch = {
        aiReport,
        llmUsed: vv.llmUsed ?? (vv.aiReport ? true : false),
        llmProvider: vv.llmProvider ?? '',
        updatedAt: now
      };
      if (existing) {
        await ctx.db.patch(existing._id, { ...patch, agentsRun: vv.agentsRun, citations: vv.citations });
      } else {
        await ctx.db.insert('predictorVerdicts', {
          dayKey: args.dayKey,
          sportId: args.sportId,
          matchId: vv.matchId,
          ...patch,
          agentsRun: vv.agentsRun,
          citations: vv.citations
        });
      }
    }
    return args.verdicts.length;
  }
});

export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const oldDays = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const d of oldDays) await ctx.db.delete(d._id);

    const oldMatches = await ctx.db
      .query('predictorMatches')
      .collect()
      .then((items) => items.filter((m) => m.dayKey < cutoff));
    for (const m of oldMatches) await ctx.db.delete(m._id);

    const oldVerdicts = await ctx.db
      .query('predictorVerdicts')
      .collect()
      .then((items) => items.filter((v) => v.dayKey < cutoff));
    for (const v of oldVerdicts) await ctx.db.delete(v._id);

    const oldStats = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const s of oldStats) await ctx.db.delete(s._id);

    const oldRuns = await ctx.db
      .query('predictorRuns')
      .collect()
      .then((items) => items.filter((r) => r.dayKey < cutoff));
    for (const r of oldRuns) await ctx.db.delete(r._id);

    return oldDays.length + oldMatches.length + oldVerdicts.length;
  }
});

// Internal entry used by the orchestrator's incremental refresh to rebuild
// verdicts from the ALREADY-CACHED matches+scopes (no new API or LLM spend).
export const getCachedMatches = internalQuery({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();
  }
});

// Internal action entry used by the midnight cron (Emeka Obi's cache cycle).
export const purgeAndMarkStale = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const deleted = await ctx.runMutation(internal.predictor.purgeOld, {});
    return { deleted };
  }
});

// ── Bootstrap actions: seed today's cache for all sports when DB is empty ─────

const ALL_SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'] as const;
type AnySSport = typeof ALL_SPORTS[number];

// Internal: seed a specific sport for today. Called by seedAllSports.
export const seedSportForToday = internalAction({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
    v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
    v.literal('mma'), v.literal('volleyball')
  )},
  handler: async (ctx, args): Promise<{ ok: boolean; kept: number }> => {
    const dayKey = new Date().toISOString().slice(0, 10);
    // Check if already cached for today — skip if fresh (status ready/partial/refreshing).
    const existing = await ctx.runQuery(internal.predictor.getDayInternal, {
      sportId: args.sportId as AnySSport,
      dayKey
    });
    if (existing && (existing.status === 'ready' || existing.status === 'partial' || existing.status === 'refreshing')) {
      console.log(`[Bootstrap] ${args.sportId} already cached for ${dayKey} (${existing.status}), skipping.`);
      return { ok: true, kept: 0 };
    }
    // Kick the full pipeline via the orchestrator.
    const result: any = await ctx.runAction(internal.predictorOrchestrator.runRefreshInternal, {
      sportId: args.sportId as AnySSport,
      dayKey,
      floor: 52
    });
    return { ok: result?.ok ?? false, kept: result?.kept ?? 0 };
  }
});

// Internal query to check a predictor day without going through public API.
export const getDayInternal = internalQuery({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
    v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
    v.literal('mma'), v.literal('volleyball')
  ), dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// Internal: stagger-seed all 11 sports for today with a 15-second gap between each.
export const seedAllSports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const dayKey = new Date().toISOString().slice(0, 10);
    console.log(`[Bootstrap] Seeding all sports for ${dayKey}…`);
    let seeded = 0;
    const sports: AnySSport[] = [...ALL_SPORTS];
    for (const sp of sports) {
      try {
        await ctx.runAction(internal.predictor.seedSportForToday, { sportId: sp });
        seeded++;
        // Stagger: wait 15 seconds between sports so the LLM/API providers
        // are not hammered simultaneously by 6 parallel pipeline runs.
        await new Promise((r) => setTimeout(r, 15_000));
      } catch (err: any) {
        console.error(`[Bootstrap] Failed to seed ${sp}:`, err?.message || err);
      }
    }
    return { seeded };
  }
});

// Public action: UI-callable — bootstraps today's data for all 11 sports.
// Safe to call multiple times; already-fresh days are skipped.
export const bootstrapToday = action({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; message: string }> => {
    const result: any = await ctx.runAction(internal.predictor.seedAllSports, {});
    return {
      seeded: result?.seeded ?? 0,
      message: `Bootstrap started for ${result?.seeded ?? 0} sport(s). Data will populate over the next few minutes.`
    };
  }
});

const NON_FOOTBALL_SPORTS = ['basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'] as const;

// Mutation to move all football matches stored under any non-football sport into Football ('football').
// Merges non-duplicates into football and deletes duplicates from the non-football sports.
export const migrateNonFootballMatchesToFootball = mutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let deleted = 0;
    let totalExamined = 0;

    for (const sp of NON_FOOTBALL_SPORTS) {
      const sportMatches = await ctx.db
        .query('predictorMatches')
        .withIndex('by_sport_day', (q) => q.eq('sportId', sp as any))
        .collect();

      totalExamined += sportMatches.length;

      for (const m of sportMatches) {
        if (isFootballMatch(m)) {
          const existingFootballMatches = await ctx.db
            .query('predictorMatches')
            .withIndex('by_sport_day', (q) => q.eq('sportId', 'football').eq('dayKey', m.dayKey))
            .collect();

          const dup = existingFootballMatches.find(
            (f) => f.matchId === m.matchId || (f.homeTeam.toLowerCase() === m.homeTeam.toLowerCase() && f.awayTeam.toLowerCase() === m.awayTeam.toLowerCase())
          );

          if (dup) {
            await ctx.db.delete(m._id);
            deleted++;
          } else {
            await ctx.db.patch(m._id, { sportId: 'football' });
            migrated++;
          }

          const verdict = await ctx.db
            .query('predictorVerdicts')
            .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
            .first();

          if (verdict && verdict.sportId === sp) {
            await ctx.db.patch(verdict._id, { sportId: 'football' });
          }
        }
      }
    }

    return { migrated, deleted, totalExamined };
  }
});

export const migrateNonFootballMatchesInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let deleted = 0;
    let totalExamined = 0;

    for (const sp of NON_FOOTBALL_SPORTS) {
      const sportMatches = await ctx.db
        .query('predictorMatches')
        .withIndex('by_sport_day', (q) => q.eq('sportId', sp as any))
        .collect();

      totalExamined += sportMatches.length;

      for (const m of sportMatches) {
        if (isFootballMatch(m)) {
          const existingFootballMatches = await ctx.db
            .query('predictorMatches')
            .withIndex('by_sport_day', (q) => q.eq('sportId', 'football').eq('dayKey', m.dayKey))
            .collect();

          const dup = existingFootballMatches.find(
            (f) => f.matchId === m.matchId || (f.homeTeam.toLowerCase() === m.homeTeam.toLowerCase() && f.awayTeam.toLowerCase() === m.awayTeam.toLowerCase())
          );

          if (dup) {
            await ctx.db.delete(m._id);
            deleted++;
          } else {
            await ctx.db.patch(m._id, { sportId: 'football' });
            migrated++;
          }

          const verdict = await ctx.db
            .query('predictorVerdicts')
            .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
            .first();

          if (verdict && verdict.sportId === sp) {
            await ctx.db.patch(verdict._id, { sportId: 'football' });
          }
        }
      }
    }

    return { migrated, deleted, totalExamined };
  }
});

// ── Purge wrongly-cached matches from any sport tab ───────────────────────────
// Scans every cached match under `sportId` and deletes any that fail the
// two-gate matchBelongsToSport check.
export const purgeWrongSportMatches = mutation({
  args: {
    sportId: v.union(
      v.literal('football'), v.literal('basketball'), v.literal('tennis'),
      v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
      v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
      v.literal('mma'), v.literal('volleyball')
    )
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId))
      .collect();

    let deleted = 0;
    let kept = 0;
    for (const m of all) {
      if (!matchBelongsToSport(m, args.sportId)) {
        await ctx.db.delete(m._id);
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) await ctx.db.delete(verdict._id);
        deleted++;
      } else {
        kept++;
      }
    }
    return { sportId: args.sportId, examined: all.length, deleted, kept };
  }
});

export const purgeWrongSportMatchesInternal = internalMutation({
  args: {
    sportId: v.union(
      v.literal('football'), v.literal('basketball'), v.literal('tennis'),
      v.literal('rally'), v.literal('hockey'), v.literal('baseball'),
      v.literal('americanfootball'), v.literal('rugby'), v.literal('cricket'),
      v.literal('mma'), v.literal('volleyball')
    )
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId))
      .collect();

    let deleted = 0;
    for (const m of all) {
      if (!matchBelongsToSport(m, args.sportId)) {
        await ctx.db.delete(m._id);
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) await ctx.db.delete(verdict._id);
        deleted++;
      }
    }
    return { deleted, examined: all.length };
  }
});
