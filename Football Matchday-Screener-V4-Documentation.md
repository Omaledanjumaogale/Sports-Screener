# Matchday Screener v4 — Complete Documentation

**File this document describes:** `matchday-screener-v4.html`
**Version:** 4.0 — Unified 1H / 2H / Full Time
**Type:** Single-file, offline-capable HTML/CSS/JS application
**Primary audience:** Human punters (Parts 1, 8, 9) and agentic/LLM maintainers (Parts 2–7)
**Predecessor documents:** `matchday-screener-documentation.md` (v2 base) and `matchday-screener-v3-changelog.md` — read those first for foundational concepts; this document supersedes both but cross-references where relevant.

---

## TABLE OF CONTENTS

1. Executive Summary
2. Domain Glossary
3. Strategic Model — Why Each Decision Was Made
4. Configuration System — SCOPE_BASE × LEAGUE_DELTA
5. Application Architecture — File Structure, CSS Design System, Data Flow
6. Engine Reference — All Three Scope Engines In Full Detail
7. Validation Suite — Tests Run Before Shipping
8. Worked Scenarios — Real Match Data From This Session
9. How-To-Use Guide (Human Punters)
10. Known Limitations
11. Roadmap — Suggested Upgrade Paths
12. Disclaimers

---

## PART 1 — Executive Summary

v4 is the first version of this tool to screen three distinct match segments — 1st Half (1H), 2nd Half (2H), and Full Time (FT) — inside a single HTML file. Each segment has its own calibrated screening engine, its own field set, and its own output. Switching between segments via the tab bar never clears or resets data — a punter can enter odds for all three segments of the same match and compare recommendations across tabs.

The three engines share the same core mathematical primitives (`implied`, `tier3`, `gridSnapshot`, `updateBoard`, `renderChecks`, `renderRanking`) and the same configuration architecture (`SCOPE_BASE` × `LEAGUE_DELTA`), but apply different baseline thresholds suited to the structural goal-scoring patterns of each segment. The full-time engine additionally introduces a fourth profile (Profile D) not present in the half-time engines, because the full-time market space is wider and contains goal-line and team-total markets that have no direct equivalent in 45-minute markets.

**What the tool does:** for any market odds a user types in from a bookmaker's interface, the tool immediately (on every keystroke) computes implied probability, passes it through the relevant profile's checklist, fires a colour-coded pass/borderline/fail signal per check, scores the profile's overall confidence, and updates a master recommendation banner. No data leaves the page, no network call is ever made, and no browser storage API is used.

**What the tool does not do:** it does not predict outcomes, guarantee results, or create statistical edge beyond what the bookmaker's own pricing already reflects. See Part 12.

---

## PART 2 — Domain Glossary

All terms as used specifically in this codebase. Readers familiar with v2/v3 documentation may skip terms already defined there; new v4-specific terms are marked **[v4 new]**.

- **Implied probability:** `1 / decimal_odds`. A price of 2.00 implies 50%. The raw output of a single market cell.
- **Overround / margin / vig:** the sum of all implied probabilities across all outcomes in a market exceeds 100%. The excess percentage is the bookmaker's built-in edge. Typical range: 5–12% on liquid two-way markets, up to 20%+ on correct-score markets.
- **Normalization / de-vigging:** dividing each outcome's raw implied probability by the sum of all outcomes' implied probabilities in that market, to produce a "fair" probability estimate summing to 100%. Used wherever the tool collects both sides of a market.
- **Scope** **[v4 new]:** which match segment a given field, profile, or threshold set applies to. Three scopes: `h1` (1st half), `h2` (2nd half), `ft` (full time).
- **SCOPE_BASE** **[v4 new]:** a JS object keyed by scope (`h1`, `h2`, `ft`), each holding a complete set of numeric thresholds for every check in that scope's profiles. The single source of truth for baseline calibration.
- **LEAGUE_DELTA** **[v4 new]:** a JS object keyed by league-preset name (`balanced`, `lowScoring`, `highScoring`, `cup`), each holding signed adjustments that are *added to* (or subtracted from) the relevant SCOPE_BASE threshold. Produces 12 total threshold combinations (3 scopes × 4 presets) from a compact, non-duplicated structure.
- **Profile A:** the "under/low-goal" profile. In 1H and 2H scopes, targets Under 1.5 goals. In FT scope, targets Under 2.5 goals. Fits cagey, even, low-tempo matches.
- **Profile B:** the "over/goal-heavy" profile. In 1H and 2H scopes, targets Over 0.5 goals. In FT scope, targets Over 2.5 goals. Fits mismatches, high-energy, or open matches.
- **Profile C:** the result/handicap ranking profile. Ranks every 1X2, Double Chance, and Asian Handicap option entered by normalized implied probability. Present in all three scopes. Used when neither A nor B fits cleanly.
- **Profile D** **[v4 new]:** the goal-line and BTTS ranking profile. FT scope only. Ranks every match-total Over/Under (0.5, 1.5, 2.5, 3.5), team-total Over/Under (Home/Away × 0.5/1.5/2.5), and BTTS (Yes/No) option entered by implied probability. Fallback used when A/B misfire on an FT market but a specific goal-line or BTTS bet stands out.
- **BTTS / GG / NG:** Both Teams To Score. Yes (GG — "goal-goal") means both teams score at least once. No (NG) means at least one team fails to score. Full-time market only.
- **Match total goals:** the combined goal count across both teams for the full 90 minutes. Over/Under 2.5 is the most liquid line and the primary anchor for FT Profiles A and B.
- **Team total goals** **[v4 new]:** goals scored by a single named team (Home or Away) in the full match. Over/Under 0.5 / 1.5 / 2.5. Available in the FT scope as a Profile D input.
- **Coverage:** the count of the 10 correct-score grid cells actually filled in. When coverage ≥ 5 (the `GRID_TRUST_THRESHOLD`), normalized probabilities are used for score-based checks; below 5, a raw (unnormalized) approximation is used and labeled as such in the UI.
- **EV (Expected Value):** `(your_probability / 100 × odds) − 1`. Positive EV means the price is better than your own estimated true probability; negative means it is worse. The tool computes EV only when the user supplies their own probability estimate — it never generates an independent "true probability" on its own.
- **Base rate:** the long-run historical frequency of an event across football generally, independent of any specific match. The tool's thresholds are anchored to approximate base rates from general football knowledge, not to a fitted statistical model. See Part 10, Limitation 1.
- **Strong candidate / Borderline / Poor fit:** the three verdict tiers output by `updateBoard()`. "Strong candidate" means the profile's score/completed ratio meets or exceeds `cfg.strong` (default 0.75 in most scopes/presets). "Borderline" means ratio ≥ `cfg.borderline` (default 0.45). "Poor fit" means below both.

---

## PART 3 — Strategic Model

### 3.1 Why three separate segments rather than one universal screener

Every version up to v3 covered only first-half markets. The extension to 2H and FT was requested specifically because:

1. A punter reading three tabs of a bookmaker app (1H markets, 2H markets, FT markets) cannot use a single-scope tool for two-thirds of what they're looking at.
2. 2H and FT have meaningfully different goal-scoring distributions from 1H — the same threshold numbers used for a 1H Under 1.5 check would produce systematically wrong signals if reused verbatim for 2H Under 1.5 or FT Under 2.5.
3. The three segments cover different bet types: 1H and 2H anchor on half-goal lines (0.5 / 1.5), while FT anchors on 2.5 and additionally introduces BTTS and team-total markets that have no half-time equivalent.

### 3.2 Why 2H thresholds start differently from 1H

The structural argument: second halves produce more goals than first halves across most professional football leagues. Three causal mechanisms are well-established in football analysis:

- **Fatigue** — defensive organization degrades after ~60 minutes; attackers find more space.
- **Substitutions** — managers introduce fresh legs and often more offensive intent in the second half.
- **Scoreline pressure** — a team trailing at half-time is forced to open up, creating more space for both sides.

The quantitative implication: if a typical first half has a certain probability of seeing 0 or 1 goal, the second half of the same match has a meaningfully lower probability of staying under that count. Therefore, the Under 1.5 threshold for 2H must be set *stricter* than for 1H — the market needs to show a stronger-than-usual signal to call a 2H Under 1.5 a "green" check, because the structural baseline is against it.

v4 implements this by setting `SCOPE_BASE.h2.a1.green = 74` (versus `SCOPE_BASE.h1.a1.green = 69`) — the 2H normalized Under 1.5 probability must clear a 74% bar to be called green, vs 69% for 1H. Symmetrically, `SCOPE_BASE.h2.b1.green = 70` for Over 0.5 (vs 75% for 1H) — a weaker signal suffices to call a 2H Over 0.5 check green, since the structural environment already favors goals.

These specific numbers were calibrated to approximately match what the v3 documentation called the "high-scoring league" adjustment applied on top of the balanced 1H base — because that adjustment was originally designed to make the tool behave correctly in a higher-goal-than-average context, which is precisely what a second half is.

### 3.3 Why FT anchors on Over/Under 2.5, not 1.5

The average professional football match produces approximately 2.5–3.0 total goals across 90 minutes. Over/Under 2.5 sits very close to the mathematical coinflip line across most leagues and is by far the most liquid FT total-goals market. Using Under 1.5 for a 90-minute scope would put the tool's primary focus on a sub-event (≤1 goals in 90 minutes) that is statistically unlikely enough to produce very short Under prices and therefore narrow, low-value selections most of the time.

Using 2.5 as the primary anchor means Profile A (Under 2.5) and Profile B (Over 2.5) start from near-equal prior probability, which in turn means both profiles can genuinely compete for the recommendation in most matches — unlike a 1H Under 1.5 vs Over 0.5 split where the prior heavily favors the Under side.

### 3.4 Why Profile D was added for FT but not for halves

The FT market space is significantly wider than a half-time market space. A typical FT betting screen on SportyBet-style platforms offers:

- Four match-total Over/Under lines (0.5, 1.5, 2.5, 3.5)
- Three team-total lines per team × 2 teams = six additional Over/Under pairs
- BTTS (Yes/No)
- Plus the 1X2, Double Chance, and Asian Handicap markets shared with half-time screens

In v3, Profile C (ranking) handled the 1X2 / DC / handicap category, which is the "win market" category. But the goal-line and BTTS options are qualitatively different from win markets — they're asking "how many goals" rather than "who wins." Mixing them into Profile C (which is designed to compare win/handicap options against each other) would conflate two different question types in one ranked list, making the output harder to interpret.

Profile D gives goal-line and BTTS options their own dedicated ranked list, cleanly separated from win-market comparisons in Profile C. The master banner checks Profile D before Profile C in the FT fallback path, because a goal-line or BTTS bet is typically a more natural "safety" alternative when the 2.5 line is inconclusive than a result market would be.

### 3.5 The master banner's priority order

The master banner follows a strict priority waterfall:

```
1. If Profile A or B is a "strong candidate" (ratio ≥ cfg.strong):
      → Recommend the stronger of A or B (goals market wins)

2. Else if Profile D is populated and top pick ≥ cfg.cGreen (FT only):
      → Recommend the top Profile D goal-line/BTTS option (goal-line safety)

3. Else if Profile C top pick ≥ cfg.cGreen:
      → Recommend the top Profile C win/handicap option (result safety)

4. Else:
      → "No standout selection — consider skipping"
```

The priority of D over C in FT scope reflects the design intent: this is a *goals* screener first. If the primary goals profiles don't produce a strong signal, the next most relevant fallback is still a goal-related bet (a specific Over/Under line or BTTS), not a win market. Win markets are the last resort, not the primary recommendation.

---

## PART 4 — Configuration System (SCOPE_BASE × LEAGUE_DELTA)

### 4.1 The SCOPE_BASE object

Three complete threshold sets, one per scope. Each set defines numeric thresholds for every check in every profile for that scope. No threshold from one scope is ever reused in another — there is no inheritance or defaulting between scopes.

**Structure of each scope entry (h1 shown as reference):**

```javascript
h1: {
  a1: {green: 69, amber: 60},   // O/U 1.5 Under normalized %
  a2: {green: 55, amber: 45},   // 0:0+1:0+0:1 combined %
  a3: {green: 0.75, amber: 1.5}, // AH line — threshold is the line value itself
  a4: {green: 2.20, amber: 2.60}, // Draw odds — threshold is the odds value
  a5: {green: 3.00, amber: 3.50}, // None odds — threshold is the odds value
  b1: {green: 75, amber: 65},   // O/U 0.5 Over normalized %
  b3: {green: 26, amber: 33},   // 0:0 normalized % (note: lower % = more likely = bad for Over)
  b4: {gLow: 1, gHigh: 2, aLow: 0.5, aHigh: 2.5}, // AH line band for Profile B
  b5: {green: 12, amber: 8},    // 1:1 implied % (h1/h2 only)
  strong: 0.75,                 // Ratio threshold for "Strong candidate" verdict
  borderline: 0.45,             // Ratio threshold for "Borderline" verdict
  cGreen: 80,                   // Profile C/D top-pick % for master banner trigger
  cAmber: 65                    // Profile C/D coloring
}
```

**Key differences across scopes:**

| Check | h1 green | h2 green | ft green | Rationale |
|---|---|---|---|---|
| a1 (Under norm%) | 69% | 74% | 58% | 2H harder to go under; FT anchored at 2.5 not 1.5 |
| a2 (low-goal CS%) | 55% | 60% | 50% | 2H fewer low-goal scorelines expected; FT counts 6 scorelines not 3 |
| a3 (AH line) | ≤0.75 | ≤0.75 | ≤1.0 | Full match allows slightly bigger handicap for a "tight" result |
| a4 (Draw odds) | ≤2.20 | ≤2.05 | ≤3.00 | FT draw is less likely than a half-time draw |
| a5 (None/NG odds) | ≤3.00 | ≤3.20 | ≤1.90 | FT "no goal" is very rare (NG refers to BTTS No in FT) |
| b1 (Over norm%) | 75% | 70% | 58% | 2H structurally more likely to have a goal; FT coinflip at 2.5 |
| b3 (0:0%) | ≤26% | ≤32% | ≤12% | FT 0:0 is much rarer; a higher normalized % would be alarming |

### 4.2 The LEAGUE_DELTA object

Four entries, one per preset. Each entry contains:
- `note`: the text displayed in the preset-note row below the dropdown (used for user education, not calculation)
- Named check deltas: `a1:{g:-5,a:-5}` means "subtract 5 from both the green and amber thresholds of check a1 for this preset, regardless of which scope is active"

**buildCFG(scope, presetKey)** — the single function that applies the delta:

```javascript
function buildCFG(scope, presetKey) {
  const cfg = deepCopy(SCOPE_BASE[scope]);      // start with the scope's own base
  const delta = LEAGUE_DELTA[presetKey] || {};  // find the delta (empty for 'balanced')
  ['a1','a2','a4','a5','b1','b2','b3','b5'].forEach(function(k) {
    if (delta[k] && cfg[k]) {
      cfg[k].green = round2(cfg[k].green + delta[k].g);
      cfg[k].amber = round2(cfg[k].amber + delta[k].a);
    }
  });
  if (typeof delta.strong === 'number')  cfg.strong  = Math.min(0.95, cfg.strong  + delta.strong);
  if (typeof delta.cGreen === 'number')  cfg.cGreen  = Math.min(95,   cfg.cGreen  + delta.cGreen);
  cfg.note = delta.note || '';
  return cfg;
}
```

**What each preset does and why:**

| Preset | Change from balanced | Rationale |
|---|---|---|
| `balanced` | No change — base values as-is | Default; calibrated from general football knowledge and sample matches |
| `lowScoring` | Under-side check thresholds eased (green bar lowered); Over-side check thresholds raised | In a league where 0/1-goal halves are the norm, a merely-average Under signal is already more informative than in a balanced league |
| `highScoring` | Under-side check thresholds raised; Over-side check thresholds eased | In a league where 3+ goals per match is common, a stronger-than-average Under signal is required to trust it |
| `cup` | Individual check thresholds unchanged; `strong` raised from 0.75 to 0.85, `cGreen` raised from 80 to 85 | Knockout/dead-rubber motivation variance cannot be detected from market odds alone — the tool requires higher aggregate confidence before recommending anything in this context |

**Result: 12 threshold combinations from one compact config:**

```
h1 × balanced,  h1 × lowScoring,  h1 × highScoring,  h1 × cup
h2 × balanced,  h2 × lowScoring,  h2 × highScoring,  h2 × cup
ft × balanced,  ft × lowScoring,  ft × highScoring,  ft × cup
```

Any future maintainer adding a 5th preset (e.g. `international`, `u21`) adds one entry to `LEAGUE_DELTA` — nothing else changes.

---

## PART 5 — Application Architecture

### 5.1 File structure

```
matchday-screener-v4.html
  <head>
    <style>  ... all CSS — no external stylesheet ...
  <body>
    <div class="wrap">
      <header>
      <div class="tabbar">       ... three tab buttons ...
      <div class="global-actions">
      <section id="scope_h1">   ... 1H fields and output ...
      <section id="scope_h2">   ... 2H fields and output ...
      <section id="scope_ft">   ... FT fields and output ...
      <div class="history-card"> ... shared log across all tabs ...
      <footer>
    </div>
    <script>  ... all JS — no external script ...
```

**Critical constraint, unchanged from v2/v3:** no CDN links, no external fonts, no localStorage, no network calls of any kind. The file must work by double-clicking it on a phone or desktop, with zero connectivity.

### 5.2 Tab switching mechanism

```javascript
let currentScope = 'h1';

function switchScope(scope) {
  currentScope = scope;
  ['h1','h2','ft'].forEach(function(s) {
    document.getElementById('scope_'+s).classList.toggle('active', s===scope);
    document.getElementById('tabBtn_'+s).classList.toggle('active', s===scope);
  });
}
```

CSS controls visibility:
```css
.scope-section { display: none; }
.scope-section.active { display: block; }
```

Only the active section is rendered in the visual flow. All three sections exist in the DOM at all times — this is what allows input values to persist when switching tabs (the inputs are not destroyed and recreated on tab switch).

### 5.3 CSS design system

All semantic colors defined once as CSS custom properties:

```css
--green / --green-bg    /* Positive signal */
--amber / --amber-bg    /* Borderline signal (same hex as --gold) */
--red   / --red-bg      /* Negative signal */
--gold                  /* Structural UI accent — section headers, focus rings, top-pick border */
--empty / --empty-bg    /* No data entered */
```

**Design rule, unchanged from v3:** green/amber/red are used ONLY for semantic status signals, never decoratively. Gold is used ONLY for structural UI elements, never for semantic signals. This separation means a user's eye can reliably use color as a status signal without competing decorative uses.

Typography: system font stack for all UI text, monospace stack for all odds/probability numeric values. `font-variant-numeric: tabular-nums` on all number inputs ensures digits align in fixed-width columns — a deliberate "scoreboard" visual cue.

### 5.4 ID namespace convention

All element IDs follow the pattern `{scope}_{fieldName}`:
- `h1_ou15u` — 1st Half, Over/Under 1.5, Under price
- `h2_cs00` — 2nd Half, Correct Score, 0:0 cell
- `ft_bttsY` — Full Time, BTTS Yes price
- `ft_d_evBadge` — Full Time, Profile D EV badge element

This namespacing allows all three scopes to coexist in the same DOM without ID collisions, and allows the two shared engines (calcHalfScope and the shared profile C/D builders) to address any scope's elements by simply prefixing the scope string.

### 5.5 Data flow — reactive single-pass model

The reactive architecture is identical to v3: every input fires `input` and `change` events, each bound to the relevant scope's calc function. Events are wired at `initApp()` time (called on DOMContentLoaded or immediately if the DOM is already ready):

```javascript
document.querySelectorAll('#scope_h1 input, #scope_h1 select')
  .forEach(function(el) {
    el.addEventListener('input', function() { calcHalfScope('h1'); });
    el.addEventListener('change', function() { calcHalfScope('h1'); });
  });
// ... same for h2 → calcHalfScope('h2'), ft → calcFT()
```

Each scope's calc function runs top to bottom on every event, recomputing every check, every profile, and the master banner from scratch. No incremental diffing, no debouncing. This is intentional at this file's scale — fewer than 50 inputs per scope, sub-millisecond computation.

---

## PART 6 — Engine Reference

### 6.1 Shared primitives (scope-agnostic)

| Function | Signature | Purpose |
|---|---|---|
| `num(id)` | `String → Number\|null` | Reads a numeric input; returns null on empty or NaN |
| `sel(id)` | `String → Number\|null` | Reads a select element's value as float; null if unselected |
| `implied(o)` | `Number → Number` | `1/o`, or 0 if falsy — central probability primitive |
| `tier3(v,g,a,lowIsGreen)` | `(Number,Number,Number,Boolean) → String` | Maps a value to 'green'/'amber'/'red' with direction flag |
| `percentToOdds(pct)` | `Number → Number` | Converts a percentage threshold to an equivalent odds value, keeping fallback raw-odds checks in sync with cfg percentage thresholds |
| `round2(n)` | `Number → Number` | Rounds to 2 decimal places — used in buildCFG to prevent floating-point drift in threshold values |
| `gridSnapshot(prefix)` | `String → {vals, denom, coverage}` | Reads all 10 correct-score cells for a given scope prefix, computing implied-probability sum (denom) and filled-cell count (coverage) |
| `renderChecks(containerId, checks)` | `(String, Array) → void` | Renders a list of `{title, detail, status, pillText}` objects as check rows in a profile card |
| `updateBoard(lampsId, scoreTextId, verdictId, results, cfg)` | `(..., cfg) → {score, completed, ratio}` | Tallies green/amber/red, updates lamp row and verdict label, returns the ratio for the master banner |
| `tierPct(p, cfg)` | `(Number, cfg) → String` | Maps a probability % to 'green'/'amber'/'red' using cfg.cGreen and cfg.cAmber |
| `buildResultRanking(prefix, cfg)` | `(String, cfg) → {topLabel, topOdds, topProb}` | Collects 1X2/DC/AH options, calls renderRanking, returns top result for the master banner |
| `renderRanking(topId, listId, options, cfg)` | `(...) → {topLabel, topOdds, topProb}` | Sorts options by prob, renders the top-pick callout and ranked list |
| `renderEV(userProbId, badgeId, topLabel, topOdds)` | `(...) → void` | Computes and renders the EV badge for the active top pick |

### 6.2 calcHalfScope(scope) — 1H and 2H engine

One function handles both halves. The `scope` parameter (`'h1'` or `'h2'`) drives the element ID prefix and the `buildCFG` call — everything else is identical.

**Profile A checks (Under 1.5):**

| # | Check | Elements | Formula | Direction |
|---|---|---|---|---|
| A1 | O/U 1.5 Under normalized | `{scope}_ou15u`, `{scope}_ou15o` | `n = implied(u)/(implied(u)+implied(o)) × 100` | Higher % = greener |
| A2 | 0:0+1:0+0:1 combined | `{scope}_cs00/10/01` (+rest of grid) | If coverage ≥ 5: `(imp(00)+imp(10)+imp(01))/denom × 100`; else raw sum × 100 | Higher % = greener |
| A3 | AH line | `{scope}_ahLine` | Direct comparison of the line value | Smaller line = greener |
| A4 | Draw odds | `{scope}_drawOdds` | Direct comparison of the odds value | Shorter odds = greener |
| A5 | First Goal "None" odds | `{scope}_noneOdds` | Direct comparison of the odds value | Shorter odds = greener |

**Profile B checks (Over 0.5):**

| # | Check | Elements | Formula | Direction |
|---|---|---|---|---|
| B1 | O/U 0.5 Over normalized | `{scope}_ou05u`, `{scope}_ou05o` | `n = implied(o)/(implied(u)+implied(o)) × 100` | Higher % = greener |
| B2 | First Goal "None" odds (inverted) | `{scope}_noneOdds` | Same element as A5, inverted interpretation | Longer odds = greener |
| B3 | Correct Score 0:0 | `{scope}_cs00` | If coverage ≥ 5: `implied(00)/denom × 100` (lower % = greener); else raw odds comparison | Lower % (or higher odds) = greener |
| B4 | AH line (band-shaped) | `{scope}_ahLine` | Green if `gLow ≤ line ≤ gHigh`; amber if in outer bands; red otherwise | Mid-range = greener |
| B5 | Correct Score 1:1 | `{scope}_cs11` | `implied(cs11) × 100` | Higher % = greener |

**Profile C:** calls `buildResultRanking(scope, cfg)` which handles 1X2/DC/AH ranking. Identical across h1, h2, ft.

**_lastState storage:** after the master banner is written, the computed summary is stored as `window['_lastState_'+scope]` — a snapshot used by `saveScreening()` without rerunning calculations.

### 6.3 calcFT() — Full Time engine

The FT engine follows the same structural pattern as `calcHalfScope` but with scope-specific market names and four profiles instead of three.

**Profile A checks (Under 2.5):**

| # | Check | Elements | Formula | Direction |
|---|---|---|---|---|
| A1 | O/U 2.5 Under normalized | `ft_mt25u`, `ft_mt25o` | `implied(u)/(implied(u)+implied(o)) × 100` | Higher % = greener |
| A2 | ≤2-goal scorelines combined | `ft_cs00/10/01/11/20/02` | If coverage ≥ 5: sum of 6 scoreline implied probs / denom × 100; else raw sum | Higher % = greener |
| A3 | AH line | `ft_ahLine` | Direct comparison | Smaller = greener (threshold ≤ 1.0 green, ≤ 2.0 amber) |
| A4 | Draw odds | `ft_drawOdds` | Direct comparison | Shorter = greener |
| A5 | BTTS "No" (NG) odds | `ft_bttsN` | Direct comparison | Shorter NG odds = greener for Under |

**Profile B checks (Over 2.5):**

| # | Check | Elements | Formula | Direction |
|---|---|---|---|---|
| B1 | O/U 2.5 Over normalized | `ft_mt25u`, `ft_mt25o` | `implied(o)/(implied(u)+implied(o)) × 100` | Higher % = greener |
| B2 | BTTS "Yes" (GG) odds | `ft_bttsY` | Direct comparison | Shorter GG odds = greener for Over |
| B3 | Correct Score 0:0 | `ft_cs00` | If coverage ≥ 5: `implied(00)/denom × 100`; else raw odds | Lower % (higher odds) = greener for Over |
| B4 | AH line (band-shaped) | `ft_ahLine` | Band: green if 1.0 ≤ line ≤ 2.5; amber in outer bands | Mid/larger range = greener |
| B5 | 2:1 + 1:2 combined | `ft_cs21`, `ft_cs12` | If coverage ≥ 5: sum/denom × 100; else raw sum × 100 | Higher % = greener (signals open game) |

**Profile C (FT):** identical to H1/H2 — calls `buildResultRanking('ft', cfg)`.

**Profile D (FT only):**

Builds a variable-length `dOptions` array:
1. Match-total lines: for each of `[0.5, 1.5, 2.5, 3.5]`, if Under entered push `{label: 'Match Under X', odds, prob: implied(u)×100}`; if Over entered push Over equivalent.
2. Team-total lines: for Home and Away, each of `[0.5, 1.5, 2.5]`, push Under and/or Over if entered.
3. BTTS: if both Yes and No are entered, normalize the two-way market before pushing; if only one is entered, push raw implied probability.

Sorted descending by probability; top entry rendered as the highlighted callout; all entries rendered as a ranked list with probability bars. EV computed against `ft_d_userProb` field.

### 6.4 writeMasterBanner(scope, cfg, aResult, bResult, cResult, dResult)

Takes the results of all profiles for a scope and writes the master headline and chip row. `dResult` is null for h1 and h2 (no Profile D).

Priority waterfall (see Part 3.5 for rationale):

```
if no data entered at all → placeholder prompt
if (Profile A or B) has completed ≥ 3 checks AND ratio ≥ cfg.strong:
    pick the stronger of A vs B → goals-market recommendation
else if dResult is non-null AND top prob ≥ cfg.cGreen:
    → Profile D goal-line recommendation
else if top Profile C prob ≥ cfg.cGreen:
    → Profile C result recommendation
else any data at all:
    → "no standout selection — consider skipping"
```

### 6.5 Screening log functions

| Function | Description |
|---|---|
| `saveScreening(scope)` | Pushes a snapshot from `window['_lastState_'+scope]` to `historyLog[]`; calls `renderHistory()` |
| `renderHistory()` | Rebuilds the history table from `historyLog[]` |
| `removeHistory(i)` | Splices index i from `historyLog[]`; re-renders |
| `clearHistory()` | After confirm dialog, empties `historyLog[]`; re-renders |
| `exportJSON()` | Serializes `historyLog[]` to JSON, downloads via Blob URL |
| `exportCSV()` | Serializes `historyLog[]` to CSV, downloads via Blob URL. Uses `String.fromCharCode(10)` for newline (not `\n` literal) to avoid multi-file escape-sequence corruption |
| `importJSON(evt)` | Reads a JSON file via FileReader, parses as array, concatenates into `historyLog[]` |

`historyLog` is declared as `var` (not `let`) so it attaches to the global/window object in both browser and Node.js test contexts, making it directly accessible in automated tests and in `saveScreening()` without closure-scope issues.

---

## PART 7 — Validation Suite

All tests were run before the final file was assembled. Future maintainers should repeat these steps after any edit.

### 7.1 Step 1: JS syntax check

```bash
node --check logic.js
# Expected: no output (exit code 0)
```

Repeat on the extracted script after assembly:
```bash
# Extract script block and check
python3 -c "
import re
with open('matchday-screener-v4.html') as f: c = f.read()
m = re.search(r'<script>(.*)</script>', c, re.S)
open('extracted.js','w').write(m.group(1))
"
node --check extracted.js
```

### 7.2 Step 2: Escape-sequence audit

```python
bad_patterns = [("\\\\'", "over-escaped apostrophe"),
                ("\\\\n",  "over-escaped newline"),
                ("\\\\\\\\", "quad backslash")]
for pat, name in bad_patterns:
    count = script.count(pat)
    # Expected: 0 for all
```

This check exists because a previous version (v3 during build) introduced broken apostrophes that silently invalidated the entire script with no browser console error — the script simply stopped updating when odds were typed. The check must be run on the raw file bytes via Python, not via shell `grep`, to avoid shell escaping adding its own layer of confusion.

### 7.3 Step 3: ID cross-reference

```python
defined_ids    = set(re.findall(r'id="([^"]+)"', html_part))
referenced_ids = set(re.findall(r"getElementById\('([^']+)'\)", script_part))
referenced_ids |= set(re.findall(r"num\('([^']+)'\)", script_part))
referenced_ids |= set(re.findall(r"sel\('([^']+)'\)", script_part))
missing = referenced_ids - defined_ids - expected_dynamic
# Expected: empty set
```

Dynamic IDs (those built via `scope+'_fieldName'` or `prefix+'_fieldName'` concatenation) are resolved manually — 32 unique suffixes × 3 scopes = 96 expected dynamic IDs.

### 7.4 Step 4: onclick function reference check

```python
onclick_fns  = set(re.findall(r'onclick="([a-zA-Z_][a-zA-Z0-9_]*)\(', html))
defined_fns  = set(re.findall(r'function ([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', script))
missing_fns  = onclick_fns - defined_fns
# Expected: empty set
```

### 7.5 Step 5: Brace and parenthesis balance

```python
opens  = script.count('{'); closes = script.count('}')
p_open = script.count('('); p_close = script.count(')')
# Expected: opens == closes, p_open == p_close
```

### 7.6 Step 6: Integration test suite (14 tests, Node.js/vm)

Runs via a Node.js script that:
1. Builds a minimal DOM stub satisfying all `getElementById`, `querySelectorAll('#id .lamp')`, `createElement`, and `body.appendChild` calls
2. Loads the logic via `vm.runInNewContext`
3. Runs 14 specific assertions

**Test cases:**

| # | Test | Expected |
|---|---|---|
| 1 | `calcHalfScope('h1')` runs without throwing | Pass |
| 2 | `calcHalfScope('h2')` runs without throwing | Pass |
| 3 | `calcFT()` runs without throwing | Pass |
| 4 | KF Malisheva vs Hibernian H1 produces a non-empty recommendation string | Pass |
| 5 | H1 Profile A scores ≥ 60% of checks green/amber with full data set | Pass |
| 6 | h1 and h2 a1.green thresholds differ | Pass |
| 7 | ft a1.green is 58 (scope-specific, not inherited from h1) | Pass |
| 8 | lowScoring preset eases h1 a1.green below balanced baseline | Pass |
| 9 | cup preset raises strong bar above balanced baseline | Pass |
| 10 | `implied(4.0)` returns 0.25 | Pass |
| 11 | `gridSnapshot('h1')` returns coverage=10 when all 10 cells filled | Pass |
| 12 | `historyLog` is a real Array (accessible as `ctx.historyLog`) | Pass |
| 13 | `saveScreening('h1')` increments log and sets scope='H1' | Pass |
| 14 | FT with balanced scoring data produces a non-empty recommendation | Pass |

**Test result: 14 passed, 0 failed.**

Note on test 4: with the full 10-cell correct-score grid entered, KF Malisheva vs Hibernian correctly routes to "Double Chance: Draw or Away" via Profile C (87.7% @ 1.14), not Profile A — because the full normalized grid shows Profile A at ~70% (borderline, below the 75% strong threshold), which is the same result the v2 manual analysis found. The test verifies a string recommendation is produced, not which profile fires — the outcome matches the historical analysis from this session.

---

## PART 8 — Worked Scenarios

### Scenario 1: KF Malisheva vs Hibernian FC — 1H (from session data)

**Odds entered (from SportyBet screenshots):**
- O/U 1.5: Under 1.52 / Over 2.45
- O/U 0.5: Under 3.25 / Over 1.31
- 0:0 @ 3.10, 1:0 @ 7.60, 0:1 @ 3.40, 1:1 @ 8.30, 2:0 @ 38, 0:2 @ 7.25, 2:1 @ 41, 1:2 @ 18, 2:2 @ 91, Other @ 11
- Draw @ 2.45, None (first goal) @ 3.30
- AH line ±0.5, Home @ 5.80, Away @ 2.00
- DC: Home/Draw @ 1.70, Draw/Away @ 1.14

**v4 output:**
- Profile A (Under 1.5): 70% — Borderline (just below 75% strong threshold)
- Profile B (Over 0.5): 60% — Poor fit
- Profile C top: Draw or Away @ 87.7% (normalized from DC), 1.14
- Master banner: "No clean goals-market fit — Double Chance: Draw or Away at 87.7% @ 1.14 stands out as a safety pick"

**Why this is correct:** Hibernian FC (Scottish Premiership) vs KF Malisheva (Kosovo) is a heavy mismatch — the market correctly prices a dominant Hibernian half but doesn't strongly support the Under 1.5 (normalized correct-score cluster for low-goal outcomes is reasonable but not overwhelming). Profile C correctly identifies the near-certain "Hibernian don't lose the half" outcome at 87.7%, which is the clearest available bet. The EV field lets the user verify whether they think the true probability is above or below that 87.7%.

### Scenario 2: Paide Linnameeskond vs Zira FK — 1H (from session data)

**Odds entered (from SportyBet screenshot):**
- 1H 1X2: Home @ 8.40, Draw @ 2.45, Away @ 1.82
- 1H Draw No Bet: Away @ 1.16
- 1H First Goal: Home @ 5.50, None @ 3.00, Away @ 1.71
- DC: Draw/Away @ 1.09

**Profile C top:** Double Chance: Draw or Away @ ~92% (raw implied from 1.09)

**Why this is the correct recommendation:** The UEFA Conference League context plus the odds shape (Away @ 1.82 in the 1X2, None @ 3.00 meaning the market expects a first-half goal) means Profile A (Under 1.5) is unlikely to fire strongly — the None odds at exactly 3.00 sit right on the amber/green boundary, not firmly in Under territory. Profile C's Draw/Away at 1.09 is the genuine standout — the market is effectively pricing Zira FK not losing the first half at over 90%. Worth noting: a price of 1.09 means approximately 1% theoretical return per unit staked, which is why the EV field exists — the user should enter their own probability to check whether even 92% implied probability offers value at that price.

### Scenario 3: A genuinely even, cagey match — Profile A fires cleanly (illustrative)

**Hypothetical input set designed to fit Profile A:**
- O/U 1.5: Under 1.38 / Over 2.80 → normalized Under = 67% ✅ (above h1 balanced green=69? No — 67% is amber. For clean green, need ~1.30 Under)
- O/U 1.5: Under 1.28 / Over 3.40 → normalized Under = 73% ✅ green
- 0:0 @ 2.80, 1:0 @ 5.50, 0:1 @ 5.80 (balanced, slight home edge) → combined ~54% ✅ borderline
- AH line: 0 (pick'em) ✅ green
- Draw @ 2.10 ✅ green
- None @ 2.80 ✅ green

Expected output: Profile A at ~80% (strong candidate), Profile B at ~30% (poor fit). Master banner: "Goals market favours Profile A — Under 1.5 FH (80% of checks support it)."

This scenario illustrates why the AH line and Draw price together are the quickest double-check for a genuine "even, cagey match" — when both are in the green zone (pick'em handicap, draw under 2.20), the Under side of the half has structural support independent of the goal-count markets.

### Scenario 4: Full Time — Under 2.5 vs Over 2.5 split decision

**Hypothetical FT input:**
- O/U 2.5: Under 1.90 / Over 1.90 → normalized exactly 50/50
- BTTS Yes @ 1.80 / No @ 1.95 → slight favor to GG
- 0:0 @ 9.00, 1:1 @ 5.50, 2:1 @ 6.00, 1:2 @ 6.50, 2:0 @ 7.00, 0:2 @ 7.50
- AH line: 0.5 (slight away edge)
- Draw @ 3.30

**Expected output:** Profile A (Under 2.5): ~45-50% borderline. Profile B (Over 2.5): ~45-50% borderline. Profile D top: could be BTTS Yes @ 56% or Match Under 1.5 @ 72% depending on what's entered. Master banner: falls through to Profile D recommendation if it clears 80%, otherwise "no standout selection."

This scenario is the hardest case for the tool — genuine uncertainty at the 2.5 line, the most common real-world scenario. The correct output here is "no standout" or a specific lower-volatility goal-line bet via Profile D — not a forced recommendation on A or B.

---

## PART 9 — How-To-Use Guide (Human Punters)

**Setting up:**
1. Download `matchday-screener-v4.html` to your phone or computer. Open it directly in Chrome, Safari, or any modern browser. No internet needed after download.
2. Select your match segment tab: **1st Half**, **2nd Half**, or **Full Time**.
3. Select the league/competition profile from the dropdown. "Balanced" works for most leagues; use Low-scoring for tight defensive leagues, High-scoring for attacking leagues, Cup for knockouts or dead-rubbers.

**Entering odds:**
4. Open the bookmaker app (e.g. SportyBet) and navigate to the match's Half or Goals market tab.
5. Enter each odd directly into the matching field as you read it off the screen. The recommendation updates on every keystroke — you don't need to enter everything before you start seeing output.
6. Enter the correct-score grid cells as many as are available. The label "(normalized read)" appears once 5 or more cells are filled, meaning the score-based checks are now using properly de-vigged probabilities rather than raw approximations.

**Reading the output:**
7. Look at the **master banner** first — this is the single most important output. It tells you which profile (if any) the match fits and what the recommended selection is.
8. Check the **chip row** for a side-by-side comparison: Profile A %, Profile B %, Profile C pick + %.
9. Scroll to the relevant **profile card** to see which individual checks are green/amber/red and why.
10. For Profile C and D, look at the **probability bar list** and note the odds next to each item — a 90% probability at 1.05 odds has almost no return; a 78% probability at 1.30 odds is a more interesting risk/reward.
11. Use the **EV field** in Profile C or D: enter your own personal probability estimate for the top pick. If your estimate is above the market's implied probability (e.g. you think 80% but the market prices 72%), EV will show positive — that's when you might consider staking. If your estimate matches or is below, EV is flat or negative — the price doesn't reflect an edge.

**Saving and tracking:**
12. Press **Save current tab's screening** after entering a match. Each saved entry records: scope, match name, league profile, all profile percentages, and the final recommendation.
13. Press **Export JSON** or **Export CSV** to save the log to a file on your device. This is the only form of persistence — **closing or reloading the page without exporting loses the log**.
14. To continue a previous session, press **Import JSON** and load your previously exported file.
15. Switch between tabs freely — odds entered on one tab are never cleared by switching to another.

**When to skip a match:**
- Master banner shows "no standout selection" after entering odds from 3+ market types.
- Profile A and B both show Poor fit or borderline.
- Profile C/D top pick is below 80% implied.
- The odds you'd need to reach the relevant profile's green zone are clearly not what the bookmaker is offering.
- One of the contextual red flags applies: heavily mismatched teams (Profile A only works if the match is structurally close), very high-tempo rivals derby (chaotic starts invalidate early-minute base rates), or a team known to score fast (check their recent first-goal timing, not just whether they score).

---

## PART 10 — Known Limitations

1. **Thresholds are human-calibrated, not backtested.** The green/amber/red boundaries came from general football knowledge and a small number of real SportyBet matches from one session. They have not been fitted to a historical dataset. A future maintainer with access to historical 1H/2H/FT goals data by league should replace these numbers with statistically computed equivalents.

2. **Correct-score grid is partially normalized below coverage 5.** If fewer than 5 of the 10 cells are filled, the correct-score checks fall back to raw implied probability sums that are not properly de-vigged. The UI labels this explicitly ("raw" vs "normalized") but users may not always notice the distinction.

3. **No live odds feed.** All data entry is manual. The tool has no scraping, API integration, or auto-refresh of any kind. This is a deliberate design constraint (offline-first), not a gap. Changing this would require network access and would break the offline guarantee.

4. **2H and FT thresholds are calibrated by reasoning, not observation.** The 2H base was set to match the v3 "high-scoring league" adjustment applied on top of the h1 balanced base. The FT base was set around the behavioral properties of the 2.5 line as a coinflip anchor. Neither has been independently validated against a dataset of actual 2H or FT results.

5. **Profile D uses raw implied probability for single-side entries.** When only one side of a team-total or match-total line is entered (e.g. "Match Under 0.5" but no corresponding Over 0.5), Profile D pushes the raw `1/odds` probability without normalizing, since no denominator exists. This is labeled clearly in Part 6.3 but not flagged in the UI for the user.

6. **Double Chance and 1X2 market overlap is not reconciled** in Profile C. Both are sourced if entered, but no cross-check verifies consistency between them. Minor pricing discrepancies between the two markets (which exist due to different margins) are absorbed silently.

7. **No league-specific base rates for team-total or BTTS markets.** Profile D's thresholds are set symmetrically (no green/amber distinction for individual Over/Under lines other than the ranking position itself). A future version could apply league-specific BTTS base rates (e.g. Spanish La Liga historically has higher BTTS Yes rates than Italian Serie A).

---

## PART 11 — Roadmap / Suggested Upgrade Paths

**Maintainer note:** all items below are *suggestions*, not commitments. Any item involving live data or external APIs fundamentally changes the "works offline, single file" guarantee — treat those as a different product, not an upgrade to this one.

| Priority | Item | Complexity | Notes |
|---|---|---|---|
| High | Replace SCOPE_BASE thresholds with fitted values from a real historical dataset | High | Requires ~1,000+ matches per scope per league tier at minimum; would transform the tool from "calibrated by reasoning" to "statistically validated" |
| High | Per-check amber/green notes showing the threshold the user needs to clear | Low | Display `cfg.a1.green` next to the check's pill so a user knows exactly what number they need to see |
| Medium | League-specific BTTS base rates in Profile D | Medium | Requires per-league historical BTTS frequency; keep as a separate BTTS_BASE object keyed by league |
| Medium | Per-row EV in Profile C and D | Medium | Requires migrating renderRanking from innerHTML replacement to keyed DOM diffing to prevent input focus loss on recompute; see v3 changelog rationale |
| Medium | Second-half correct-score market separation | Low | 2H correct scores reflect in-match state (current scoreline) — the fields currently treat them as pre-match independent outcomes. A future version could add a "current half-time score" field that adjusts which 2H scorelines are still reachable |
| Low | Match history persistence (server-side or cloud) | High | Requires a backend; breaks the single-file offline guarantee; treat as a separate hosted product rather than an upgrade to this file |
| Low | Automatic line consistency checker | Medium | Cross-validate: if DC Home/Draw odds are entered alongside 1X2 Home and Draw, verify they're mathematically consistent within market-margin tolerance; flag discrepancies to the user |
| Low | Mobile app packaging (PWA or Cordova wrapper) | Low-Medium | The file already works offline and on mobile; wrapping it as a PWA (adding a manifest.json and service worker) would allow "Add to Home Screen" installation with a proper icon |

---

## PART 12 — Disclaimers

This tool is a decision-support screening aid built from general football knowledge and a small number of real match samples from one bookmaker platform (SportyBet) during one session. The thresholds have not been backtested, validated against historical results, or independently verified.

**The phrase "beating the bookmaker" used during this project's development describes a goal of the framework, not a guaranteed outcome of using the tool.** Bookmakers set prices using professional analysts, large datasets, and real-time information that this tool cannot access. The tool helps a user identify which matches most closely resemble pre-defined structural profiles and skip the ones that don't — this is a filtering discipline, not a predictive model.

Bookmaker odds already price in the bookmaker's margin. No amount of odds-reading produces positive expected value over the long run if the inputs to the calculation are the odds themselves — EV can only be positive if you have an independent probability estimate that genuinely exceeds the market's, and this tool cannot generate that estimate for you.

All staking decisions are entirely the user's own responsibility. If betting stops being enjoyable or feels out of control, free, confidential support is available through national gambling helplines in most regions.

This file uses no browser storage APIs and makes no network calls. Nothing you enter is transmitted anywhere.
