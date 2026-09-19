# The Offline Master Model — Multi-Sport Odds & Lines Analysis Framework

**Version:** 1.0
**Type:** Offline analytical constitution (a "brain," not a bot). Zero AI inference, zero web browsing, zero live data pulls, zero third-party site fetching. Operates *exclusively* on the odds and lines a punter manually types into the existing screener input fields.
**Sports covered in this version:** Football, Basketball, Tennis, Table Tennis, Ice Hockey.
**Not yet covered:** Baseball — its screener/documentation has not been supplied yet. Part 6 explains exactly what's needed to extend this document once it is.
**Companion tools this document governs:**

| Sport | Engine doc | Tool file |
|---|---|---|
| Football | `Football_Matchday-Screener-V4-Documentation.md` | `Football_Matchday-Screener-V4.html` |
| Basketball | `Basketball-Screener-V1-Documentation.md` | `Basketball-Matchday-Screener-V1.html` |
| Tennis | `tennis-screener-v1-documentation.md` | `tennis-matchday-screener-v1.html` |
| Table Tennis | `rally-line-screener-documentation-v2.md` | `rally-line-tt-totals-screener.html` |
| Ice Hockey | `ice-hockey-screener-v1-documentation.md` | `ice-hockey-matchday-screener-v1.html` |

---

## HOW THIS DOCUMENT RELATES TO THE OTHER FILES YOU UPLOADED

You uploaded two different *families* of documents, and they don't mix, so it's worth being explicit about which one this document extends and which one it deliberately replaces.

**Family 1 — the five screener tools and their docs above.** These are real, working, offline HTML calculators. They read odds you type in, run genuine arithmetic (implied probability, de-vigging, interpolation, cross-market differencing), and every one of their disclaimers sections says the same true thing in different words: *the math is exact, the thresholds are reasoned rather than statistically fitted, and no odds-only tool can manufacture positive expected value against a bookmaker's own margin.* This document is a direct extension of that family. It keeps every one of those tools' calculations as "significant check measures" (your words) — nothing here overrides or replaces the MET/MEG/TTC/PGD/TGD/CSI math already built. It adds one missing layer: a disciplined way to combine the *outputs* of those tools with each other, across markets and across scopes, before a verdict is issued.

**Family 2 — `SKILL.md`, `PUNTER_MASTER_MODEL_v4.md`, `PUNTER_MASTER_MODEL_V2.pdf`, and `Football_Prediction_Prompt.docx`.** These are AI-agent prompts. They assume an LLM will browse SofaScore/Forebet/Pinnacle/etc., scrape live stats, run a "7-layer ensemble" of named machine-learning models (XGBoost, LightGBM, a Bayesian live-update engine) that no such prompt can actually execute, and they repeatedly use language like "unbroken winning streak," "beat the bookies," and "guaranteed... safe" selections. None of that is compatible with what you've asked this document to be: something that works completely offline, reads only the odds a punter types in, and contains nothing hallucinated or assumed. So this document does **not** carry forward the ensemble/ML/Bayesian layer names, the web-scraping instructions, the "beat the bookies" framing, or the 75–100%-guaranteed-band language from those four files. What it *does* keep from them, stripped of the fabricated-data-source problem, is the underlying instinct that a single market's percentage isn't the whole story — that instinct is legitimate, and Part 0.6 below turns it into something that actually runs on real, entered odds instead of imagined live feeds.

One honest correction up front, because it matters more than anything else in this document: **no framework built from odds alone can guarantee a win, and this one doesn't either.** What it can do — and this is a real, mathematically grounded upgrade over "highest single percentage wins" — is refuse to hand out its highest confidence label unless *several independent readings of the same bookmaker's own pricing* agree with each other. That's the actual mechanism behind every "beat the bookmaker" claim in this document from here on, and it's spelled out in full in Part 0.3 and Part 0.6.

---

# PART 0 — THE CHARTER (governs all five sports)

## 0.1 The Prime Directive — Data Fidelity

Every number this model touches must come from an odds/line field the punter actually filled in in the relevant screener, for the specific match being screened, at the moment it's being screened.

- If a field is empty, the check that depends on it is **skipped**, not estimated. It is marked `[NOT ENTERED]`.
- Nothing is ever filled in from memory, from "typical" values for that league/sport, from training data about the teams or players, or from an assumption about what a bookmaker "probably" has priced elsewhere.
- No check is ever upgraded from Poor/Borderline to Strong because of context that wasn't entered as odds (form, injuries, weather, motivation, a "feeling" about the match). If a punter wants to factor those things in, they do it themselves, on top of this model's output — this model does not do it for them, and does not pretend to.
- Every output must be traceable, field by field, back to a specific number the punter typed in. If a maintainer or punter can't point to the exact input that produced a number in this document's framework, that number is wrong and should not be displayed.

This is the same rule `SKILL.md`'s "PRIME DIRECTIVE" states for football and the same rule every screener's Known Limitations section implicitly enforces by disclosing what it *doesn't* know. This document simply makes it explicit and applies it to all five sports and to the new cross-market layer described below.

## 0.2 What "beating the bookmaker" can and cannot mean from odds alone

Read this before reading anything else in this document, because everything else is built to be consistent with it.

A bookmaker's posted odds already have their margin baked in. If you normalize (de-vig) those odds and treat the result as "the probability," you have recovered the bookmaker's *own* estimate of the outcome — not an independent, more accurate one. Multiplying, ranking, or re-badging that number cannot turn it into a genuinely higher win-rate. That's not a limitation of this specific document; it's a mathematical fact about where the number came from, and it's true of every screener in this family, and it would still be true of a "guaranteed 75–100%" model that browsed the entire internet before saying so.

There are exactly **three** things an odds-only framework can legitimately do that add real value on top of just reading one market's percentage:

1. **Margin minimization.** Among two bets you'd otherwise treat as equally likely, the one charging less bookmaker margin is strictly better to take. This is arithmetic, not prediction — see the Table Tennis chapter's EV-as-margin-cost treatment, which is the clearest existing statement of this principle in your files.
2. **Cross-market inconsistency detection.** A bookmaker prices dozens of markets on the same match, often via different trading models or at different times. When two markets that describe the *same underlying fact* disagree with each other (tennis's dual tiebreak signal; hockey's OT Split Consistency Check; table tennis's Correct-Score-vs-Total-Sets flag; basketball's Team Total Consistency), that disagreement is a genuine, observable fact about the market — not a guess about the future. One side of the disagreement may be the "sharper" price, but this model cannot tell you which one; it can only tell you that a disagreement exists and hand you both numbers.
3. **Confluence discipline.** A single market's high percentage might mean the match is genuinely lopsided, or it might mean that one specific market was priced slightly off relative to everything else the bookmaker itself is saying about the same match. The only way to tell these apart from outside the bookmaker's own systems is to check whether *other, independent* markets on the same match agree. This is the actual, non-hallucinated mechanism this document adds — see 0.6.

Nothing beyond these three exists to be extracted from odds alone. Any output from this framework that looks like a fourth kind of edge is a bug, not a feature — flag it and remove it.

## 0.3 The Two Numbers — Market Probability vs. Confluence Tier

This is the most important structural decision in this document, so it gets its own section.

Every recommendation this model produces shows **two separate, never-merged numbers**:

- **Market Probability %** — the plain, de-vigged, normalized implied probability straight from the relevant market(s), exactly as each screener already computes it (MET/MEG value-zone %, Profile A/B normalized %, CSI %, etc.). This number is a *direct read of the bookmaker's own price*. It is never inflated, boosted, or adjusted by this document.
- **Confluence Tier** — a label (Tier 1 / Tier 2 / Tier 3 / No Read) describing *how many independent angles of that same bookmaker's pricing agree with each other* about the direction of the bet. This is **not a probability** and is never displayed as a percentage of winning. It is a measure of internal consistency, not of predictive accuracy.

**Why they are never combined into one fake "boosted" number:** a bet that is 58% by Market Probability and Tier 1 by Confluence is not secretly a 78% bet. It is a 58% bet that several independent markets agree is roughly a 58%-ish situation — which is more trustworthy than a 58% bet where a different market on the same fixture is quietly implying something else, but it is still, honestly, a 58% bet. Conflating the two numbers into a single inflated figure is exactly the kind of invented-confidence output this document exists to prevent. Keep them side by side, always.

## 0.4 The Confluence Ledger — the model's core new mechanism

This is the piece that did not exist anywhere in your five screeners individually (each one screens its own markets and scopes largely on their own terms) and is the actual answer to "analyse all the market options together against each instead of independently."

For any candidate selection (a specific market + direction — e.g., "Match Total Over 2.5", "Game Total Under 187.5", "1st Set Over 9.5 games"), build a **ledger** of every *independent, already-computed verdict* available in the current match's entered data that speaks to the same underlying question. "Independent" means: a verdict that isn't simply re-reading the same single field twice. Each source below is instantiated per sport in Parts 1–5.

| Ledger row | What it is | Vote |
|---|---|---|
| **Primary Scope Verdict** | The main Profile A/B (or equivalent) tier for the scope you're screening (e.g., FT) | Required — this is the candidate itself |
| **Cross-Scope Verdict** | The same-direction Profile A/B (or equivalent) tier from a *different* time segment of the same match (e.g., 2H, or 1st Half/1st Quarter/1st Set/1st Period vs. the full match) | Agree / Disagree / N/A |
| **Cross-Market Consistency Verdict** | A structurally distinct comparison of two *different* markets on the same fact (TTC, PGD, TGD, CSI-vs-MEG, CS Reconciliation-vs-direct-market, OT Split Check, Match Shape Consistency Flag, or football's BTTS-vs-Total check) | Agree / Disagree / N/A |
| **Structural / Scoreline Verdict** | A read of the correct-score or scoreline-clustering structure specific to that sport (Resistance Zone for football, CSI decisive/competitive split for tennis, CS Reconciliation for hockey, Match Shape sweep/4-set/5-set split for table tennis) | Agree / Disagree / N/A |
| **Ranking Corroboration** | Whether the sport's own "best specific line" ranking (Profile D, or the Rally Line Final Verdict) independently surfaces the *same* direction as its own top pick | Agree / Disagree / N/A (bonus only) |

**Tallying rule:**

```
Agree  = a source's verdict points the same direction as the candidate
Disagree = a source's verdict points the opposite direction
N/A    = the field(s) needed for that source were not entered

agreeCount    = count of Agree rows
disagreeCount = count of Disagree rows
```

**Tier assignment — this is the whole point of the exercise:**

```
if disagreeCount ≥ 1:
    Tier 3 — Conflicted. (ANY explicit contradiction caps the tier here,
    no matter how many other rows agree. A high market probability
    cannot buy its way out of a real, named contradiction from
    another market on the same match.)

else if agreeCount ≥ 3:
    Tier 1 — High Confluence

else if agreeCount == 2:
    Tier 2 — Moderate Confluence

else if agreeCount ≤ 1:
    Tier 3 — Single-Angle (only the primary market itself supports this;
    everything else was either unavailable or simply hasn't been checked)

if every row is N/A:
    No Read — not enough odds entered to say anything beyond the raw
    market percentage itself.
```

**Why the hard conflict cap matters more than the vote count:** this is the specific mechanism that stops a screener from ever recommending something purely "because it has the highest percentage." A candidate can carry an 80% Market Probability and still be capped at Tier 3 if, say, the BTTS market or the Team Total Consistency check on the very same fixture is quietly implying the opposite. That candidate isn't wrong to consider — the 80% is real — but it does not earn this framework's highest confidence label until the contradiction is resolved or explained (see each sport's chapter for what "resolved" looks like), and the punter reading the output is told exactly which two things disagree and why, not just given a lower number.

**Margin discipline as a tiebreaker, not a vote:** when two candidates land in the same Tier, prefer whichever carries the lower bookmaker margin (Part 0.5). This never changes a Tier — it only orders candidates that are already equally trustworthy by confluence.

## 0.5 The Universal Math Primitives (unchanged across all five sports)

These are the shared arithmetic building blocks already implemented across your screeners; this document does not alter any of them, only names them once so each sport chapter can reference them without re-deriving.

- **Implied probability:** `p = 1 / decimal_odds`.
- **De-vig / normalization (two-way):** `p_side = implied(side) / (implied(sideA) + implied(sideB))`.
- **De-vig / normalization (n-way, e.g. correct score):** each outcome's raw implied probability divided by the sum of all *entered* outcomes' implied probabilities. Degrades gracefully — and is labeled as degraded — with partial entry; see each screener's "coverage" concept.
- **Margin / overround:** `margin% = (Σ implied probabilities across a full market) − 100%`.
- **Market-Expected-Value line (MET/MEG):** the line at which normalized Over probability crosses 50%, found by linear interpolation between the two bracketing entered lines. Same algorithm for basketball's MET, tennis's MEG, and ice hockey's MEG — only the unit (points/games/goals) and the value-zone width change per sport.
- **Value zone:** the band around the MET/MEG line where the odds are close enough to 50/50 to carry meaningful probability while still returning better-than-shortest-price odds. Width is sport-specific (see each chapter).
- **EV / margin-cost (not a profit forecast):** `EV = (probability/100 × odds) − 1`, computed only from a market's own de-vigged probability and its own price. As the Table Tennis documentation states plainly and this document adopts as a cross-sport rule: this number will sit at or near zero by mathematical necessity when the probability and the odds come from the same market. Read it as "how much margin is this specific price charging me," never as "expected profit."

## 0.6 The Master Verdict Card — unified output format (all sports)

Every screened candidate, once run through the ledger, is reported in this exact shape. Nothing is omitted or reordered; missing fields are shown as `—`, never silently dropped.

```
═══════════════════════════════════════════════════════════
MATCH: [names]     SPORT: [sport]     SCOPE(S) ENTERED: [list]
═══════════════════════════════════════════════════════════
CANDIDATE:  [market + direction, e.g. "Match Total — Over 2.5"]

  Market Probability:      XX.X%     (source: [which computed field])
  Bookmaker Margin:        X.X%      (on this specific price)

  CONFLUENCE LEDGER
   • Primary Scope Verdict ........... [tier/value]
   • Cross-Scope Verdict ............. [Agree/Disagree/N/A — value]
   • Cross-Market Consistency ........ [Agree/Disagree/N/A — value]
   • Structural/Scoreline Verdict .... [Agree/Disagree/N/A — value]
   • Ranking Corroboration ........... [Agree/Disagree/N/A — value]

  CONFLUENCE TIER:  [Tier 1 High / Tier 2 Moderate / Tier 3 Single-Angle
                      or Conflicted / No Read]
  [If Tier 3-Conflicted: state the exact two things that disagree.]

  MISSING DATA:  [fields not entered that blocked a ledger row]

  ⚠ This is a market-probability and cross-market-consistency read,
    not a prediction. See Part 0.2. Not financial advice.
═══════════════════════════════════════════════════════════
```

When several candidates across several markets/scopes are screened for the same match, rank them **Tier first, Market Probability second, margin% third (lower is better)** — never by Market Probability alone. This ordering rule is itself the concrete, mechanical answer to "not just the factor that it has the highest percentage."

## 0.7 What this model will never do

- Never invent a probability, an edge, or a "true" number that doesn't reduce to a de-vigged calculation from odds the punter typed in.
- Never claim access to team news, injuries, weather, form, head-to-head history, or any live data — this entire document assumes none of that exists as an input, because none of it does.
- Never use the words "guaranteed," "unbroken winning streak," "risk-free," or "safe" to describe a Tier or a probability. The correct vocabulary is "high confluence," "internally consistent," and "moderate/low confluence" — describing agreement between markets, not certainty about the future.
- Never let a single high-percentage market override an explicit, named contradiction from another market on the same fixture (Part 0.4's hard conflict cap is absolute).
- Never recommend chasing losses, increasing stake size to "catch up," or treating a Tier 1 read as a reason to stake more than a punter otherwise would. Tier reflects consistency of the *evidence*, not size of the *edge* — there is no calculation anywhere in this document that translates a Tier into a stake size, and none should be added without a genuine bankroll-management framework, which is outside this document's scope.
- If reading or producing this kind of output ever stops feeling like a disciplined screening exercise and starts feeling compulsive, free and confidential support is available in most regions through national gambling-help helplines. This line is carried over verbatim in spirit from the Table Tennis and Football documentation already in your files, because it belongs in every sport chapter, not just those two.

---

# PART 1 — FOOTBALL MASTER MODEL

## 1.1 Existing engine (recap — full detail lives in the V4 documentation)

`Football_Matchday-Screener-V4.html` runs three independent scope engines — 1st Half, 2nd Half, Full Time — each with Profile A (Under), Profile B (Over), Profile C (1X2/DC/AH ranking), and (FT only) Profile D (goal-line/team-total/BTTS ranking). Thresholds come from `SCOPE_BASE[scope]` adjusted by `LEAGUE_DELTA[preset]` (balanced/lowScoring/highScoring/cup). This model treats every one of those outputs as a valid ledger input; nothing here recalculates them.

## 1.2 New Layer — Scoreline Structure Checks

`SKILL.md`'s Checks 1–8 contain a genuinely useful pattern-read of correct-score odds that the V4 screener's Profile A/B checks don't fully capture on their own (they use only a handful of scoreline cells per check; SKILL.md's Resistance Zone idea looks at *clustering* across the whole grid). This document keeps that idea, in plain language, stripped of the "avoid the words bet/bookmaker" vocabulary substitution table (there is no reason to euphemize ordinary betting terminology in an internal working document, and doing so adds confusion without adding function).

**Resistance Zone read (Structural/Scoreline Verdict source for football):**

1. Take every entered correct-score cell for the active scope.
2. Bucket each into an odds band: **5.00–6.00** ("high-probability cluster"), **7.00–8.00** ("moderate cluster"), **12.00–13.50** ("remote/structural-ceiling cluster").
3. Identify which band holds the most filled cells — that's the dominant cluster.
4. Read the dominant cluster against the primary candidate:
   - If `0:0` and `1:1` both sit in the 7.00–8.00 band → tight, low-scoring signal → **Agree** with an Under candidate, **Disagree** with an Over candidate.
   - If `1:0`/`0:1` and `2:2` both sit in the 5.00–6.00 band → open, multi-goal signal → **Agree** with Over, **Disagree** with Under.
   - If `2:0`/`3:0`/`3:1`-type cells sit in the 12.00–13.50 band → lopsided-result signal → informational only for goals markets; feeds Profile C/D corroboration instead.
5. Label this explicitly as a **heuristic pattern-read of the odds shape, not a statistically validated signal** — same caveat status as every other threshold in this family (V4 doc Part 10, item 1).

**BTTS-vs-Total consistency check (Cross-Market Consistency source for football, FT scope):**

```
if BTTS Yes normalized ≥ 60% and candidate is Over  → Agree
if BTTS No  normalized ≥ 60% and candidate is Over  → Disagree
if BTTS No  normalized ≥ 60% and candidate is Under → Agree
if BTTS Yes normalized ≥ 60% and candidate is Under → Disagree
otherwise → N/A (too close to 50/50 to be informative)
```
This is a new, small, purely arithmetic addition — it did not exist as a named check in the V4 doc, but it uses only fields the FT scope already collects (`ft_bttsY`, `ft_bttsN`), so it costs nothing to add and gives the ledger a genuine second market to check the O/U 2.5 candidate against.

## 1.3 Football Confluence Ledger — full instantiation

| Ledger row | Football source |
|---|---|
| Primary Scope Verdict | FT Profile A or B tier |
| Cross-Scope Verdict | 2H Profile A/B tier (preferred — closer in time/structure to FT) or 1H if 2H not entered |
| Cross-Market Consistency | BTTS-vs-Total check (1.2 above) |
| Structural/Scoreline Verdict | Resistance Zone read (1.2 above) |
| Ranking Corroboration | Profile D top pick, if it is the *same* goal-line direction as the candidate |

## 1.4 Worked example (using real data already validated in the V4 documentation)

**Scenario 4 from the V4 docs** (FT, hypothetical-but-representative): O/U 2.5 splits almost exactly 50/50 (Under 1.90 / Over 1.90), BTTS Yes 1.80 / No 1.95 (slight lean to Yes → normalized roughly 52% Yes), correct-score cells cluster with `1:1` at 5.50 and `2:1`/`1:2` around 6.00–6.50 (moderate/high-probability cluster, not the tight 7–8 band), AH line at 0.5.

Running the ledger for the candidate **"Match Total — Over 2.5":**
- Primary Scope Verdict: Profile B ≈ 45–50%, Borderline.
- Cross-Scope Verdict: not entered in this example → N/A.
- Cross-Market Consistency (BTTS-vs-Total): BTTS Yes ≈52% — below the 60% bar → N/A, not a strong enough lean to count either way.
- Structural/Scoreline: `1:1`/`2:1`/`1:2` sit in the moderate 6.00-ish band rather than the tight-cluster or open-cluster extremes → N/A (genuinely ambiguous shape).
- Ranking Corroboration: depends what Profile D surfaces from the team-total lines, if entered.

**Result: agreeCount is 0–1 at best → Tier 3, Single-Angle**, regardless of how close to a coinflip the raw market sits. This matches exactly what the V4 documentation itself concluded about this scenario ("the correct output here is 'no standout' ... not a forced recommendation") — the Confluence Ledger formalizes that same conclusion into a repeatable rule instead of leaving it to a punter's individual judgment call each time.

## 1.5 Football-specific caveats

- The Resistance Zone bands (5–6 / 7–8 / 12–13.5) are the same reasoned-not-fitted bands from `SKILL.md`; they have not been backtested any more than the V4 screener's own thresholds have.
- The BTTS-vs-Total check's 60% bar is a new, deliberately conservative threshold chosen so it only fires on a real lean, not on a near-coinflip BTTS price; it can be tightened once real outcome data exists to calibrate against.
- 1H/2H cross-scope comparisons inherit the V4 doc's own caveat (Part 3.2): the two halves have genuinely different scoring baselines by design, so "Agree" here means "both halves' own profile fired the same direction against their own (different) thresholds," not "the halves are statistically identical."

---

# PART 2 — BASKETBALL MASTER MODEL

## 2.1 Existing engine (recap)

`Basketball-Matchday-Screener-V1.html` computes MET per scope (FT/Q1/1H) for Game Total, Team 1 Total, Team 2 Total, runs Team Total Consistency (TTC) and the Cross-Scope Scale Check, and produces Profiles A (Under), B (Over), C (Handicap/Winner ranking), D (best specific line). Nothing here recalculates any of that.

## 2.2 Basketball Confluence Ledger — full instantiation

| Ledger row | Basketball source |
|---|---|
| Primary Scope Verdict | FT Profile A or B tier |
| Cross-Scope Verdict | The existing Scale Check signal (Q1×4 or 1H×2 vs FT MET) — already computed, just read as a ledger vote here rather than only as one of Profile A/B's five internal checks |
| Cross-Market Consistency | Team Total Consistency (TTC) diff classification |
| Structural/Scoreline Verdict | Handicap balance-point width (tight ≤3 pts = defensive/low-scoring signal → Under; wide ≥8 pts = fast/dominant-team signal → Over) — this is Profile A4/B4 read independently as a corroborating market rather than folded silently into the profile tally |
| Ranking Corroboration | Profile D top pick, if the same line/direction as the candidate |

**Important distinction from Part 0.4's generic template:** because the Scale Check and TTC are *already* two of Profile A/B's five internal checks in the base screener, using them again as separate ledger rows would double-count the same arithmetic. This document's rule for basketball (and, by the same logic, for every sport below): **the Confluence Ledger reads these as their own standalone verdicts, counted once, in addition to — not stacked on top of — their contribution to the base Profile A/B percentage.** In other words: Profile A/B's own percentage already reflects TTC and Scale Check internally; the Ledger separately asks "did TTC and Scale Check *specifically* agree with the direction I'm considering," which is a different question (a profile can score 60% overall while its TTC sub-check individually disagreed with the direction, if the other four checks pulled it over the line) and is exactly the kind of internal disagreement worth surfacing rather than burying inside one blended percentage.

## 2.3 Worked example (real data from the Basketball documentation)

East Perth Eagles vs Cockburn Cougars, FT: Game MET 187.6, Team 1 MET ≈90–92, Team 2 MET ≈94–96 (combined ≈184–188, consistent with Game MET → TTC = **consistent**, not overSum/underSum), handicap tightest at roughly ±1.5 (very tight → Under-leaning structural signal), Q1 MET×4 = 194 vs FT 187.6 (**mild fast-pace / Over lean**, but only "slightly fast," not "fast").

For candidate **"Game Total — Over 187.5" (the best value-zone Over line at 185.5 in this match):**
- Primary Scope Verdict: Profile B ≈ Borderline (both A and B score in the 55–65% borderline range per the doc's own conclusion).
- Cross-Scope Verdict: Q1 scale check → mild fast pace → **Agree** with Over.
- Cross-Market Consistency (TTC): **consistent**, not overSum → **N/A** (doesn't support either side specifically).
- Structural (handicap width): very tight ±1.5 → defensive/close-game signal → **Disagree** with Over (tight handicaps lean Under in this family's model).
- Ranking Corroboration: Profile D would show the two value-zone bets (Over 185.5 / Under 189.5) as nearly identical in probability → not a clear corroboration either way → N/A.

**Result: one Disagree present → Tier 3, Conflicted**, specifically flagging: *"the Q1 pace read leans Over, but the handicap tightness leans Under — these two are pulling in opposite directions on the same match."* This is a more useful, more honest output than either the raw 54% Market Probability alone or a naive "Q1 says Over so go Over" read — it tells the punter exactly where the market's internal story stops agreeing with itself, which the source documentation's own worked example independently arrives at in prose ("this is a genuinely close market with very little directional lean") without a formal mechanism to produce that conclusion on the next match automatically.

## 2.4 Basketball-specific caveats

Carried over unchanged from the Basketball documentation Part 10: thresholds (62/56/51%) are reasoned, not fitted; single-line MET is approximate; TTC requires all three markets populated to be reliable; no league/team context exists or is claimed.

---

# PART 3 — TENNIS MASTER MODEL

## 3.1 Existing engine (recap)

`tennis-matchday-screener-v1.html` computes MEG (same algorithm as MET, in games) per scope (Regular Time / 1st Set), the Correct Score Intelligence panel (Decisive%/Competitive%/Tiebreak%/Expected Games/Most Likely Score), Player Game Differential (PGD), the 1st-Set→Match Scale Check, and — uniquely — a **dual, independently-derived tiebreak signal** (CSI-derived vs. direct Tiebreak Yes/No market).

## 3.2 Tennis Confluence Ledger — full instantiation

| Ledger row | Tennis source |
|---|---|
| Primary Scope Verdict | RT Profile A or B tier ("Decisive"/"Under" vs "Competitive"/"Over") |
| Cross-Scope Verdict | S1 Profile A/B tier, or the Scale Check signal (S1 MEG × format factor vs RT MEG) |
| Cross-Market Consistency | PGD signal (over/underSum), **or**, on the 1st Set tab specifically, the dual-tiebreak agreement/disagreement (CSI tiebreak% vs. direct market tiebreak%) |
| Structural/Scoreline Verdict | CSI-vs-MEG cross-check (does Expected Games from the correct-score distribution agree with the totals-derived MEG?) |
| Ranking Corroboration | Profile D top pick agreement |

**Tennis's unique bonus rule:** when *both* the direct Tiebreak market and CSI-derived tiebreak% are entered on the 1st Set tab, and they disagree by more than the screener's own threshold, this is treated as an automatic **Disagree** vote regardless of what the rest of the ledger says — because, per Part 3.4 of the Tennis documentation, this specific discrepancy is "a real, observable market inefficiency" between two markets nominally pricing the exact same underlying fact (does this set reach 6-6). A live contradiction of this specific, well-defined kind should cap the tier the same way any other Disagree does.

## 3.3 Worked example (real data — Bublik vs Halys, ATP Kitzbühel, Clay)

RT Match Total MEG = 24.5 (even-money crossover observed directly at 1.94/1.94). S1 MEG ≈10.2 games, ×2.4 (Bo3) = 24.5 — **essentially perfect** cross-scope consistency (diff ≈0). 1st Set Correct Score, all 14 outcomes entered: Decisive% ≈14.4%, Tiebreak% ≈33.4%, Expected Games computed from the full distribution. A hypothetical direct Tiebreak market at 2.10/1.75 would imply ≈45.5% — an 12-point gap against the CSI-derived 33.4%.

For candidate **"1st Set Total — Over 9.5 games":**
- Primary Scope Verdict: with Tiebreak% at 33.4% (well above the "competitive" bar), Profile B fires strongly.
- Cross-Scope Verdict: S1×2.4 vs RT MEG is near-perfect consistency → this doesn't itself vote Over/Under, but confirms the *scope-to-scope pricing model is coherent*, which the framework treats as a mild **Agree** (a coherent bookmaker model is a precondition for trusting any of its individual signals).
- Cross-Market Consistency (dual tiebreak): CSI 33.4% vs. direct-market 45.5% → a >10-point gap → **Disagree flag**, per the rule above.
- Structural (CSI-vs-MEG): Expected Games from CSI vs. the totals MEG — if within the ±1.5-game tolerance, **Agree**; here the two were built to be close in the source data, so treat as Agree.
- Ranking Corroboration: N/A unless Profile D was separately run.

**Result: the explicit dual-tiebreak Disagree caps this at Tier 3 — Conflicted**, even though the Primary Scope Verdict alone looks strong. The correct instruction to the punter is exactly what the Tennis documentation itself says in Part 3.4: this is "exactly the kind of signal a careful bettor would want flagged automatically" — the Ledger's job is to make sure it's flagged as a *reason to hold back confidence*, not buried underneath an otherwise-impressive-looking Profile B percentage.

## 3.4 Tennis-specific caveats

Carried over from the Tennis documentation Part 11 unchanged: thresholds reasoned not backtested; CSI degrades with partial entry; Bo5 lookup tables are approximations; scale factors (2.4×/4.1×) are reasoned heuristics, not fitted constants.

---

# PART 4 — TABLE TENNIS (RALLY LINE) MASTER MODEL

## 4.1 Existing engine (recap)

`rally-line-tt-totals-screener.html` screens 14 markets across Full Match and 1st Set tabs, normalizes every one, computes bookmaker margin and market-fair EV (explicitly framed as margin-cost, not profit forecast — see the source doc's Part 8, the most direct statement of the Honesty Clause in your whole file set), derives Match Shape Intelligence (Sweep/4-set/5-set probabilities from the Correct Score market) with a Correct-Score-vs-Total-Sets Consistency Flag, and rolls the eight Primary markets into a Final Verdict (Safest Selection + Best Value Selection).

## 4.2 New Layer — 1st-Set-to-Match Projection

The existing tool treats Full Match and 1st Set as separate tabs without a scale check linking them the way basketball (Q1×4/1H×2) and tennis (S1×2.4/4.1) do. This document adds one, using the same reasoning pattern as those two — stated plainly as a reasoned heuristic pending calibration, not a fitted constant:

```
projectedMatchTotal = S1_TotalPoints_MET × 4.3
diff = projectedMatchTotal − FullMatch_TotalPoints_MET
```

`4.3` is derived the same way tennis's 2.4×/4.1× were: a best-of-5 table tennis match that goes the "expected" length plays out to roughly 3.3–3.6 games on average once the win-probability-weighted mix of 3-, 4-, and 5-game matches is considered, and each additional game beyond the first typically runs slightly shorter than the first (server/receiver adjustments, momentum) — 4.3 is the reasoned midpoint of that range, explicitly **not** derived from a fitted historical dataset. Any future maintainer with real completed-match data should replace it with an empirically fitted multiplier before relying on it for anything beyond a rough cross-check.

| Diff | Signal |
|---|---|
| ≤ ±6 points | Consistent |
| > +6 points | 1st Set pace implies a higher-scoring match than the Full Match line → Over-supporting |
| < -6 points | 1st Set pace implies a lower-scoring match → Under-supporting |

## 4.3 Table Tennis Confluence Ledger — full instantiation

| Ledger row | Table Tennis source |
|---|---|
| Primary Scope Verdict | Full Match Total O/U top-pick result strip |
| Cross-Scope Verdict | 1st Set Total O/U top pick, **or** the new 1st-Set-to-Match Projection (4.2) |
| Cross-Market Consistency | Player A + Player B Total picks — do both individually point the same direction as the Full Match Total candidate? |
| Structural/Scoreline Verdict | Match Shape Intelligence Consistency Flag (Correct-Score-implied sweep/4-set/5-set mix vs. the direct Total Sets market) |
| Ranking Corroboration | Final Verdict's "Safest Selection" and "Best Value Selection" — if they converge on the same candidate (the source documentation's Part 5 already calls this "the strongest read the tool is capable of producing"), treat as an automatic Agree |

## 4.4 Worked example (illustrative — no single named real match was documented for this tool; flagged accordingly per this family's honesty norm)

Full Match Total MET-equivalent (best-priced tier) points to Over at 58% normalized, margin 4%. 1st Set Total also leans Over at 61%. Both Player A and Player B individual totals lean Over. Correct Score entries show the 3-0/0-3 (sweep) combination underweighted relative to 3-1/1-3 and 3-2/2-3 — Match Shape leans toward a longer match — and the direct Total Sets market (Under 4.5 vs Over 4.5) is priced consistently with that same long-match lean (no Consistency Flag triggered).

For candidate **"Full Match Total — Over":**
- Primary Scope Verdict: 58%, favourable but not overwhelming.
- Cross-Scope Verdict: 1st Set Total also Over (61%) → **Agree**.
- Cross-Market Consistency: both individual player totals lean Over → **Agree**.
- Structural: Match Shape leans toward more games played, and the direct Total Sets market agrees (no flag) → more games typically means more total points in table tennis → **Agree**.
- Ranking Corroboration: if the Final Verdict's Safest and Best Value selections both land on this same Over candidate → **Agree**.

**Result: agreeCount ≥3, zero Disagree → Tier 1, High Confluence.** This is the shape a genuinely well-supported candidate looks like under this framework: not one big percentage, but several independently-priced markets on the same match — the match total, the set total, both player totals, the correct-score-implied match length, and the tool's own existing Final Verdict logic — all telling a consistent story. The Market Probability shown alongside it is still just 58%, honestly reported; the Tier 1 label is about the *agreement*, not a claim that 58% is secretly higher than it is.

## 4.5 Table Tennis-specific caveats

Every limitation in the source documentation's Part 6 carries forward unchanged (no independent probability source anywhere in the tool; Correct Score normalization degrades with partial entry; Bo5-only assumptions; the 55% Best-Value floor is a human choice, not a statistical one). The new 4.3× multiplier in 4.2 above is this document's own addition and inherits the same "reasoned, not fitted" caveat explicitly.

---

# PART 5 — ICE HOCKEY MASTER MODEL

## 5.1 Existing engine (recap)

`ice-hockey-matchday-screener-v1.html` computes MEG per scope (Regular Time/1st Period), Team Goal Differential (TGD), the Period→Regulation Scale Check (×3, the most structurally justified multiplier in the whole family since periods are exactly 20 minutes by rule), **Overtime Intelligence** (reading the 1X2 draw price as P(OT) and cross-checking it against the Moneyline-incl-OT market under a coinflip-shootout assumption), and **Correct Score Reconciliation** (Odd/Even%, BTTS%, Team xG, Shutout% all independently derived from the same correct-score grid and cross-checked against their direct-market equivalents). Ice hockey is also the only sport in the family with a documented, intentional **Empty-Net Reversal**: a lopsided moneyline is coded as an Over signal here (not an Under signal, as in basketball/tennis), because a decided game raises empty-net-goal risk.

## 5.2 Ice Hockey Confluence Ledger — full instantiation

| Ledger row | Ice Hockey source |
|---|---|
| Primary Scope Verdict | RT Profile A or B tier |
| Cross-Scope Verdict | P1 Profile A/B tier, or the Period Scale Check signal (P1×3 vs RT MEG) |
| Cross-Market Consistency | Team Goal Differential (TGD) signal |
| Structural/Scoreline Verdict | Correct Score Reconciliation — specifically, whichever reconstructed fact (Odd/Even%, BTTS%, Shutout%) has a direct market to cross-check against |
| Ranking Corroboration | Profile D top pick agreement, **and** the moneyline-balance read via the Empty-Net Reversal rule (lopsided moneyline → Agree with Over; tight moneyline → Agree with Under) — this is hockey's sport-specific fifth vote, replacing a generic Profile-D-only corroboration because the Empty-Net effect is this sport's most distinctive, well-justified structural signal |

**OT Intelligence is deliberately kept separate from the Over/Under ledger.** P(OT) and the OT Split Consistency Check answer a *result* question (does this game reach overtime, and is the Moneyline priced consistently with that), not a *goals-total* question. It feeds its own, parallel mini-ledger for **result/Moneyline candidates** (does the Moneyline-incl-OT price look internally consistent with the regulation 1X2 price, given a reasonable OT-is-close-to-coinflip assumption) rather than being forced into the Over/Under goals ledger where it doesn't structurally belong. Keeping these separate avoids exactly the kind of category error this whole document is trying to prevent — mixing "will this be a high/low scoring game" with "will this specific team win" as if they were the same question.

## 5.3 Worked example (illustrative — the source documentation is explicit that no real hockey odds were supplied; this document preserves that same disclosure rather than presenting the numbers as observed)

Illustrative RT data: Game MEG ≈6.0. TGD comes back consistent. Period Scale Check: P1 MEG ≈2.0 ×3 = 6.0 vs RT MEG 6.0 → perfectly consistent. Moneyline 1.35/3.40 (a lopsided favourite, favProb ≈71.6%) → per the Empty-Net Reversal, this **supports Over**. Correct Score Reconciliation on an illustrative grid returns a Shutout% reading; where that reading is elevated (above the 15% `SHUTOUT_HIGH` threshold) it would itself lean Under (a shutout is a low-scoring outcome) — creating a genuine, sport-internal tension worth naming explicitly whenever a lopsided moneyline (Over-supporting under Empty-Net logic) coincides with an elevated Shutout% reading (Under-supporting): that specific combination is common in real hockey (heavy favourites do sometimes win 1-0 or 2-0 shutouts, without ever reaching an empty-net situation) and should be treated as a **Disagree**, capping the tier, rather than averaged away.

For candidate **"Game Total — Over":**
- Primary Scope Verdict: depends on the actual Profile B percentage — treat as Borderline for this illustration.
- Cross-Scope Verdict: Period Scale Check perfectly consistent → confirms model coherence → mild **Agree**.
- Cross-Market Consistency (TGD): consistent → N/A (no lean either way).
- Structural (CS Reconciliation): if Shutout% is elevated → **Disagree** with Over.
- Ranking Corroboration (Empty-Net/Moneyline): lopsided favourite → **Agree** with Over.

**Result: one Agree, one Disagree, rest N/A → Tier 3, Conflicted**, with the explicit flag: *"the lopsided moneyline supports Over via empty-net risk, but the correct-score grid's shutout read supports Under — these are genuinely in tension for this specific type of match and should not be smoothed into a single number."*

## 5.4 Ice Hockey-specific caveats — read this one first among all five sports

This sport's chapter carries the **highest** caution flag in the family. Per the source documentation's own Part 1.1 and Part 10: no real hockey odds screenshots were used to build or calibrate any of this sport's thresholds — every number is a reasoned construction, except the NHL's ~23–25% historical OT rate, which is a real, checkable external anchor used specifically for `HKY.OT_HIGH`/`HKY.OT_MOD`. Treat every Ice Hockey Tier output with correspondingly more caution than the other four sports until this chapter is recalibrated against real entered odds.

---

# PART 6 — BASEBALL (NOT YET BUILT)

No baseball screener, documentation, or HTML tool has been supplied. Per the Prime Directive (0.1), this document will not invent baseball thresholds, run-line structures, or field names without a reference to check them against — doing so would be exactly the kind of assumption this whole framework exists to prohibit.

When the baseball screener and its documentation are ready, this chapter should follow the same template as Parts 1–5:
1. A recap of the existing engine's markets and scopes (likely: Full Game / First 5 Innings, given how MLB books structure lines — Run Line instead of a point/goal spread, Total Runs O/U, Team Total Runs, and a moneyline without a draw).
2. Identification of baseball's own unique structural signal (in the spirit of tennis's CSI or hockey's OT Intelligence) — a genuine baseball-specific example would be something like a starting-pitcher-implied run environment read *if and only if* the screener collects pitcher-specific total lines, but this must wait for the actual tool rather than being guessed at here.
3. A Confluence Ledger instantiation using this document's Part 0.4 template.
4. A worked example using real or clearly-labeled-illustrative data.
5. Baseball-specific caveats.

---

# PART 7 — HOW TO ACTUALLY USE THIS DOCUMENT ALONGSIDE THE SCREENERS

This document is a paper (or, if a maintainer chooses, a future code) SOP layered on top of tools that already work. In practice, for a single match:

1. Open the relevant sport's existing HTML screener and enter every odds field the bookmaker offers, across every scope tab available for that match (not just one tab) — the Ledger cannot vote on a scope that was never filled in.
2. Read off each scope's Profile A/B/C/D outputs exactly as the tool already displays them. Nothing changes here.
3. Using this document's Part 0.4 Ledger template and the sport-specific instantiation in Parts 1–5, build the ledger by hand (or, for a future build, wire it into the tool's own JS as a `buildConfluenceLedger(scope, candidate)` function that simply *reads* the already-computed `_lastState_{scope}` / `_bbkState_{scope}` objects each screener already stores — no new odds-reading logic is required, only a new aggregation pass over outputs the tools already produce).
4. Assign the Tier using the hard-conflict-cap rule. Never skip straight to "highest percentage wins."
5. Report using the Master Verdict Card format (0.6) — both numbers, always, never merged.
6. When ranking multiple candidates across a full match day, sort by Tier first, Market Probability second, margin% third. This is the concrete, mechanical form of "analyse all markets together instead of independently, and don't just pick the highest percentage."

A future engineering note for whoever eventually codes this rather than applying it by hand: because every screener in this family already exposes its computed state on `window['_lastState_'+scope]` (football/hockey/tennis) or `window['_bbkState_'+scope]` (basketball) or an equivalent Final Verdict object (table tennis), the Confluence Ledger can be implemented as a **read-only aggregation layer** with no changes to any existing calculation function — it only needs to run *after* all scopes for a match have been screened and compare their already-produced verdicts to each other. This keeps the "significant check measures" of each screener completely intact, exactly as requested.

---

# PART 8 — GLOBAL DISCLAIMERS & RESPONSIBLE USE

This document, and every Tier or percentage it helps produce, is a decision-support screening aid built entirely from odds and lines a punter chooses to enter. It has no access to team news, injuries, weather, motivation, live in-play data, or any information beyond the specific prices typed into the specific screener fields at the specific moment of screening.

**Market Probability** figures are the bookmaker's own de-vigged prices, not independent predictions. **Confluence Tiers** measure how many separately-priced markets on the same fixture agree with each other — a genuine, checkable fact about the odds as posted — not a forecast of what will happen on the pitch, court, table, or ice. A Tier 1 read means several independent angles of the bookmaker's own pricing are internally consistent with each other. It does not mean, and must never be described as meaning, that the outcome is safe, guaranteed, or certain. Every one of the five source screeners' own disclaimers says this in its own words; this document's job was to keep that honesty intact while adding real analytical depth, not to trade it away for a more impressive-sounding output.

No combination of odds-reading, cross-checking, or confluence-scoring produces guaranteed positive expected value against a bookmaker's built-in margin. The only two mathematically real advantages available from reading odds alone are (1) paying less margin among equally-likely options and (2) noticing when a bookmaker's own markets disagree with each other — both are modest, both require the punter's own judgment to act on, and neither is a promise of profit.

All staking decisions are entirely the user's own responsibility. This document contains no bankroll-management or stake-sizing guidance, and none should be inferred from a Tier label. If betting stops being enjoyable, starts to feel compulsive, or starts to feel out of control, free and confidential support is available in most regions through national gambling-help helplines. Everything described in this document works entirely offline, makes no network calls, and sends no data anywhere.
