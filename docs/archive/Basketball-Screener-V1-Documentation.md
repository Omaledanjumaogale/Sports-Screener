# Basketball Matchday Screener v1 — Complete Documentation

**File:** `basketball-matchday-screener-v1.html`
**Version:** 1.0 — Unified Full Time / 1st Quarter / 1st Half
**Type:** Single-file, offline-capable HTML/CSS/JS application
**Bookmaker source for calibration:** 1xBet (NBL1 Australia — East Perth Eagles vs Cockburn Cougars, 24/07/2026)
**Predecessor:** Football Matchday Screener v4 (different sport, different model — this document is self-contained)
**Primary audience:** Human punters (Parts 1, 8, 9) and agentic/LLM maintainers (Parts 2–7, 10, 11)

---

## TABLE OF CONTENTS

1. Executive Summary and Fundamental Difference from Football
2. Domain Glossary — Basketball Betting Terms
3. Strategic Model — The Market Expected Total (MET)
4. Cross-Market Consistency Framework
5. Application Architecture
6. Profile Reference — A, B, C, D (All Three Scopes)
7. Validation Suite
8. Worked Scenarios — Real 1xBet Data
9. How-To-Use Guide (Human Punters)
10. Known Limitations
11. Roadmap — Upgrade Paths
12. Disclaimers

---

## PART 1 — Executive Summary and Fundamental Difference from Football

### What this tool does

The Basketball Matchday Screener takes bookmaker odds for multiple Over/Under lines in the same market (a uniquely basketball feature — a single market might have 7–10 different line options at once), computes the **Market Expected Total (MET)** from those lines algorithmically, identifies where value sits relative to that expectation, checks cross-market consistency, and ranks every entered option by implied probability. Everything updates live on each keystroke with no network calls.

### The fundamental architectural difference from the football screener

The football screener v4 compares entered odds against pre-set static thresholds (e.g. "Under 1.5 normalized probability ≥ 69% = green"). This works for football because a typical first-half market offers only one or two Over/Under lines.

Basketball is structurally different. A typical 1xBet basketball market for a single team total might offer:

```
Over 88.5 @ 1.857 / Under 88.5 @ 1.943
Over 89.5 @ 1.9   / Under 89.5 @ 1.9
Over 90.5 @ 1.94  / Under 90.5 @ 1.857
Over 91.5 @ 2.01  / Under 91.5 @ 1.78
```

These four line pairs contain enough information to mathematically derive the market's expected total without any external calibration data. The line where Over ≈ Under (in normalized probability after removing margin) IS the market's best estimate of how many points will be scored. This tool extracts that estimate algorithmically — it does not need to know the teams, the league, or any historical data.

**This is the core innovation:** instead of checking "is this probability above our threshold?", basketball asks "what does the full collection of odds imply the market expects, and where does each bet sit relative to that expectation?"

---

## PART 2 — Domain Glossary

- **MET (Market Expected Total):** the total points figure the bookmaker's odds collectively imply as the expected outcome. Computed by finding the line where the normalized Over probability = 50% (i.e., where Over and Under are equally priced after removing margin). This is the single most important derived quantity in the model. See Part 3.

- **Normalized probability:** `implied(over) / (implied(over) + implied(under))` for the Over side, where `implied(odds) = 1/odds`. Removes the bookmaker's margin from each side so the two sides sum to 100%, giving a genuine probability estimate rather than a raw implied probability that overstates certainty.

- **Overround / margin / vig:** the bookmaker's built-in edge. At a balanced 50/50 bet with 10% margin, both sides might be priced at 1.83 (≈54.6% raw implied each = 109.2% total). After normalization, each side is correctly 50%. Basketball markets typically carry 8–12% overround on two-way totals markets.

- **Value zone:** the window of ±5 points around the MET where bets are close enough to 50/50 to have good win probability, but far enough from the MET to carry better-than-even-money odds. Specifically: Over lines 1–5 pts below MET (you're betting a line the market thinks will be exceeded) and Under lines 1–5 pts above MET (you're betting a line the market thinks will not be reached). These are the highest expected-value bets relative to the market's own pricing.

- **Team Total Consistency (TTC):** the comparison between T1\_MET + T2\_MET (what the individual team markets imply) and the Game MET (what the combined total market implies). If the sum of team METs differs significantly from the game MET, it signals a potential pricing inconsistency worth exploiting. See Part 4.1.

- **Cross-scope scale check:** comparing a smaller segment's MET multiplied up to full-game scale (Q1 MET × 4, or 1H MET × 2) against the Full Time MET. A significant discrepancy suggests the markets for different segments are pricing different pace expectations, which informs whether Over or Under the full-game total is better positioned. See Part 4.2.

- **Profile A:** the Under evidence profile. Uses five auto-generated checks derived from computed MET values to assess whether the game total is likely to fall below the MET.

- **Profile B:** the Over evidence profile. Mirror of Profile A with inverted signal interpretations.

- **Profile C:** the Handicap/Spread ranking profile. Ranks every entered handicap line and outright winner option by normalized implied probability.

- **Profile D:** the Best Specific Line Finder. Ranks every individual Over/Under option entered across game total, team 1 total, and team 2 total by the strength of its directional probability signal (distance from 50%). Answers the question: "of every specific O/U bet I can place right now, which one has the highest probability of winning?"

- **Handicap / Spread:** a two-way market where a point adjustment is applied to one team's score. In the format used by 1xBet, a positive spread (e.g. +3.5) means Team 1 receives 3.5 points added to their score; a negative spread (e.g. -3.5) means Team 1 must win by more than 3.5 points. The balance point of the spread (where both sides are equally priced) indicates the market's expected margin of victory.

- **EV (Expected Value):** `(your_probability / 100 × decimal_odds) − 1`. Positive EV means the price is better than your own estimated true probability. The tool computes EV only when the user supplies their own probability estimate — it never generates its own "true probability" to feed into this calculation.

- **Scope:** which match segment is being screened. Three scopes: `ft` (Full Time), `q1` (1st Quarter), `h1` (1st Half). Each scope has independent field sets and profile outputs.

---

## PART 3 — Strategic Model: The Market Expected Total (MET)

### 3.1 Why the MET is the central concept

When a bookmaker posts multiple O/U lines for the same market, they are pricing each line relative to their own model of expected scoring. The pricing is internally consistent — if the bookmaker believes this game will total 187 points, they will price:
- Over 183 at a short price (market expects this to be exceeded easily → high Over probability)
- Over 187 at near-even money (genuinely 50/50 in the market's view)
- Over 191 at a long price (market thinks this is unlikely to be reached → low Over probability)

The MET is precisely the line at which the market offers even money (after removing margin). It is the bookmaker's own published best estimate of the game total.

**Crucially, this estimate costs nothing to extract — it is implicit in the odds themselves.** No independent research, team statistics, or historical data is required to compute it. The bookmaker has already done that work; the MET calculation simply reveals what they believe.

### 3.2 The MET Algorithm

Given an array of Over/Under line pairs `[{line, overOdds, underOdds}, ...]`:

**Step 1:** For each line pair, compute normalized probabilities:
```
io = 1 / overOdds
iu = 1 / underOdds
sum = io + iu
normOver = io / sum      (Over probability, margin removed)
normUnder = iu / sum     (Under probability, margin removed)
```

**Step 2:** Sort all line pairs ascending by line value.

**Step 3:** Find where `normOver` crosses 0.50 going from above (lower lines = higher Over probability) to below (higher lines = lower Over probability). Interpolate between the two bracketing line pairs:
```
span = nextLine - prevLine
ratio = (prevNormOver - 0.50) / (prevNormOver - nextNormOver)
MET = prevLine + ratio × span
```

**Step 4:** If all lines are on the same side of 50% (all Over > 50%, or all Under > 50%), use the closest-to-even line as an approximate MET and flag it as `approx: true`.

**Example from real 1xBet data (East Perth Eagles vs Cockburn Cougars, FT game total):**

| Line | Over odds | Under odds | normOver | normUnder |
|---|---|---|---|---|
| 185.5 | 1.612 | 1.908 | 54.2% | 45.8% |
| 187.5 | 1.830 | 1.840 | 50.1% | 49.9% |
| 189.5 | 1.900 | 1.618 | 45.9% | 54.1% |

Interpolating between 187.5 (50.1%) and 189.5 (45.9%): ratio = (0.501-0.50)/(0.501-0.459) = 0.024, MET = 187.5 + 0.024 × 2.0 = **187.55 ≈ 187.6**

The market expects this game to total approximately 187–188 points.

### 3.3 The Value Zone Principle

Once the MET is known, every other line in the market can be classified:

| Line position relative to MET | Bet | Status |
|---|---|---|
| Line >> MET (5+ pts above) | Under | "With market" — high probability but short odds, most margin already priced in |
| Line just above MET (1–5 pts) | Under | **Value zone** — still good probability, better odds than the safest Under |
| Line ≈ MET | Either | Near-coinflip — genuine 50/50, highest uncertainty |
| Line just below MET (1–5 pts) | Over | **Value zone** — good probability with better odds than the safest Over |
| Line << MET (5+ pts below) | Over | "With market" — high probability but short odds |

**The strategic implication:** the highest expected-value bets in basketball totals markets are typically found 2–4 points away from the MET on either side, not at the extreme ends of the market. These lines carry meaningful directional probability (55–65%) while still offering odds of 1.65–1.85 rather than 1.25–1.45.

Profile D's ranking explicitly surfaces these value-zone options ranked by probability, so the user can immediately identify which specific bet represents the best combination of winning probability and odds return.

### 3.4 Why static thresholds would be wrong for basketball

In football, a normalized Under 1.5 probability of 69% consistently means approximately the same thing across most matches — it's near the historical base rate for first-half goalless or one-goal patterns, calibrated against real match data. Using 69% as a "green" threshold is appropriate because the signal is being compared to a known base rate.

In basketball, the equivalent comparison is meaningless without the MET as the reference point. A normalized Under 192 probability of 69% could mean:
- (a) The game MET is 187 and you're betting a line 5 pts above it → very safe Under
- (b) The game MET is 194 and you're betting a line 2 pts below it → you're betting the Over would have been the obvious play, and 69% Under on a line below the MET is suspicious

The MET-relative positioning is the signal, not the absolute probability. This is why the basketball screener computes MET first and evaluates everything else relative to it.

---

## PART 4 — Cross-Market Consistency Framework

### 4.1 Team Total Consistency (TTC)

The game total market and the two individual team total markets are priced by the same bookmaker but sometimes with slight internal inconsistencies. The TTC check exploits this.

**Formula:**
```
Combined MET = T1_MET + T2_MET
Diff = Combined MET − Game MET
```

**Interpretation:**

| Diff | Signal | Under implication | Over implication |
|---|---|---|---|
| ≤ ±3 pts | Consistent | Neutral | Neutral |
| +3 to +7 pts | Moderate Over Sum | Both teams expected to outscore their combined market share — mild Over lean | Supports Over |
| > +7 pts | Strong Over Sum | Market pricing suggests a higher-paced game than game total implies | Strong Over support |
| -3 to -7 pts | Moderate Under Sum | Both teams expected to under-score | Supports Under |
| < -7 pts | Strong Under Sum | Market pricing suggests a lower-paced game | Strong Under support |

**Worked example (East Perth vs Cockburn):**
- From screenshots: T1 market METs cluster around 91–93, T2 around 94–96
- Approximate combined: 185–189
- Game MET: 187.6
- Diff: approximately 0 to +1 → Consistent → neutral signal (neither Under nor Over supported)

**Why this matters:** a significant TTC discrepancy often arises because different trading teams price game totals and team totals with slightly different models or timings. When the inconsistency is large, the team total markets may be more accurate (they incorporate team-specific offensive projections) than the game total market (which is priced more aggressively from a balanced-book perspective).

### 4.2 Cross-Scope Scale Check

Basketball is played in four quarters. A full game total can be estimated from any smaller segment:
- Q1 MET × 4 = implied full game (rough, extrapolates early pace)
- 1H MET × 2 = implied full game (more reliable, covers 2 quarters of real data)

**Formula:**
```
Projected Full Game = Part_MET × multiplier (4 for Q1, 2 for 1H)
Diff = Projected − FT_MET
```

**Interpretation:**

| Diff | Signal | Meaning |
|---|---|---|
| ≤ ±5 pts | Consistent | Q1/1H pace tracks with full-game expectation — neutral |
| +5 to +10 pts | Slightly Fast | Early markets price faster pace than FT market → mild Over FT lean |
| > +10 pts | Fast Pace | Significant early pace signal → supports Over FT |
| -5 to -10 pts | Slightly Slow | Early markets price slower start than FT projects → mild Under FT lean |
| < -10 pts | Slow Pace | Significant slow pace signal → supports Under FT |

**Worked example (East Perth vs Cockburn):**
- Q1 MET from screenshots: approximately 48–49 pts
- Q1 MET × 4 = 192–196
- FT MET: 187.6
- Diff: +4 to +8 pts → Slightly Fast to Fast pace in Q1 → mild Over FT support
- 1H MET from screenshots: approximately 93–96 pts (from the team total half lines)
- 1H MET × 2 = 186–192 → broadly consistent with FT MET

The 1H-based scale check (×2) is given priority over Q1 (×4) in the code because extrapolating from half a game is more reliable than extrapolating from a quarter, and the tool uses this when 1H data is available.

---

## PART 5 — Application Architecture

### 5.1 File structure

```
basketball-matchday-screener-v1.html
  <head>
    <style>  ... all CSS, navy/orange basketball theme ...
  <body>
    <div class="wrap">
      <header>
      <div class="tabbar">       [Full Time | 1st Quarter | 1st Half]
      <div class="global-actions">
      <section id="scope_ft">   ... FT fields and profile outputs ...
      <section id="scope_q1">   ... Q1 fields and profile outputs ...
      <section id="scope_h1">   ... 1H fields and profile outputs ...
      <div class="history-card"> ... shared log ...
      <footer>
    </div>
    <script>  ... all logic ...
```

Zero external dependencies. No CDN, no fonts, no network calls. Works by opening the file directly.

### 5.2 Color theme — navy/orange basketball palette

```css
--bg:        #0B1120   (deep navy background)
--panel:     #111827   (card surface)
--panel-alt: #1C2535   (inner surfaces)
--gold:      #F5A623   (orange — structural accent, section titles, focus rings)
--green:     #00C48C   (teal — positive/supporting signals)
--red:       #FF4757   (negative/against signals)
--amber:     #FF8C00   (borderline signals)
--over:      #F5A623   (orange — Over direction marker)
--under:     #00C48C   (teal — Under direction marker)
```

The Over/Under directional colors (orange and teal) are distinct from the semantic status colors (green/amber/red) by design — a user can quickly distinguish "this check supports Under" (teal badge on the line entry) from "this check passed the profile threshold" (green pill in the profile card) without conflating the two.

### 5.3 ID namespace

All element IDs follow `{scope}_{market}_{field}{index}`:
- `ft_gt_L1` — Full Time, Game Total, Line value, entry 1
- `ft_gt_O1` — Full Time, Game Total, Over odds, entry 1
- `ft_gt_U1` — Full Time, Game Total, Under odds, entry 1
- `ft_gt_P1` — Full Time, Game Total, Probability badge, entry 1 (output element)
- `ft_t1_L1` — Full Time, Team 1 total, Line value, entry 1
- `ft_HL1`   — Full Time, Handicap, Line value, entry 1
- `ft_HT1_1` — Full Time, Handicap, Team 1 odds, entry 1
- `ft_HT2_1` — Full Time, Handicap, Team 2 odds, entry 1
- `ft_w1`    — Full Time, Match Winner, Team 1 odds
- `ft_gt_met` — Full Time, Game Total, MET display element

### 5.4 Reactive data flow

Every input in every scope section fires `input` and `change` events, both wired to `calcScope(scope)` via `initBBK()`. The calc function runs entirely on each event — no debouncing, no diffing. Sub-millisecond at this field count.

`calcScope` is wrapped by the badge updater: before running the main calculation, it calls `updateLineBadges(scope, market, count)` for each of the three O/U markets, which paints the per-row directional probability badges (orange "Over 54.2%" or teal "Under 53.7%") live as odds are typed. This is the most visually immediate feedback the user sees.

### 5.5 Functions reference

| Function | Parameters | Returns | Purpose |
|---|---|---|---|
| `bNum(id)` | element id | Number or null | Reads a positive numeric input |
| `bNumSigned(id)` | element id | Number or null | Reads a signed numeric input (for handicap lines that can be negative) |
| `bImplied(o)` | decimal odds | Float | `1/o`, 0 if falsy |
| `bRound(n,dp)` | number, decimal places | Float | Round to dp decimal places |
| `bTier(ratio)` | 0–1 ratio | 'green'/'amber'/'red' | Profile A/B verdict tier |
| `bTierPct(p)` | percentage 0–100 | 'green'/'amber'/'red' | Profile C/D ranking tier |
| `bSignalTier(normProb)` | 0–1 | 'green'/'amber'/'red' | Per-check signal tier based on BBK.STRONG_SIGNAL etc. |
| `parseOULines(prefix,count)` | scope+market prefix, line count | Array of analyzed line objects | Reads, validates, and normalizes all O/U line pairs for a market |
| `parseHDPLines(prefix,count)` | scope prefix, count | Array of HDP line objects | Reads and normalizes handicap line pairs |
| `computeMET(lines)` | sorted analyzed lines array | {met, approx, analyzed, valueZone} | Core MET algorithm — interpolates the 50% crossover point |
| `teamTotalConsistency(t1,t2,game)` | three MET values | {combined, diff, signal, strength} | Computes TTC difference and classifies signal |
| `scaleCheck(partMet,mult,fullMet)` | partial MET, multiplier, FT MET | {projected, fullMet, diff, signal} | Cross-scope scale projection and classification |
| `analyzeHDP(lines)` | array of HDP line objects | {balanceLine, favoredTeam, bestLine, all} | Finds the handicap balance point (spread MET equivalent) |
| `buildProfileA(...)` | computed values from scope | Array of check objects | Constructs 5 auto-generated Under evidence checks |
| `buildProfileB(...)` | computed values from scope | Array of check objects | Constructs 5 auto-generated Over evidence checks |
| `buildProfileC(hdpResult, w1, w2)` | HDP analysis + win odds | Array of ranking options | Builds the handicap/winner ranking array |
| `buildProfileD(gtLines, t1Lines, t2Lines)` | three analyzed line arrays | Array of ranking options | Builds the best-specific-line ranking from all O/U entries |
| `renderChecks(containerId, checks)` | container id, check array | void | Renders profile check rows into DOM |
| `updateBoard(...)` | lamp/score/verdict ids + checks | {score, completed, ratio} | Tallies checks, paints lamps, sets verdict |
| `renderMETDisplay(elId, metResult)` | display element id, MET object | void | Renders MET value + value-zone tags |
| `renderRanking(topId, listId, options)` | element ids, sorted options | {topLabel, topOdds, topProb} | Renders top-pick callout + full ranked list |
| `renderEV(...)` | user prob input id, badge id, top pick | void | Computes and renders EV badge |
| `updateLineBadges(scope, market, count)` | scope, market prefix, count | void | Paints per-row directional probability badges |
| `calcScope(scope)` | 'ft' / 'q1' / 'h1' | void | Master orchestrator — reads all inputs, runs all computations, renders all outputs |
| `writeMasterBanner(...)` | scope + all profile results | void | Writes recommendation headline + chip row, stores `_bbkState_{scope}` |
| `switchScope(scope)` | 'ft' / 'q1' / 'h1' | void | Toggles tab visibility and active states |
| `clearScopeFields(scope)` | scope | void | Clears all numeric inputs in a section, re-runs calc |
| `saveScreening(scope)` | scope | void | Pushes `_bbkState_{scope}` snapshot to `bbkHistory[]` |
| `renderHistory()` | — | void | Rebuilds the log table from `bbkHistory[]` |
| `exportJSON()`, `exportCSV()` | — | void | Download `bbkHistory[]` via Blob URL |
| `importJSON(evt)` | file input change event | void | Read and merge a previously exported JSON log |
| `initBBK()` | — | void | Wires all event listeners, runs initial calc for all scopes |

---

## PART 6 — Profile Reference: All Three Scopes

### 6.1 Profile A — Under Evidence (all scopes)

Five auto-generated checks, each derived from computed values not static inputs.

| # | Check name | Source data | Green signal | Amber signal | Red signal |
|---|---|---|---|---|---|
| A1 | Best Under line in value zone | gtResult.valueZone.bestUnder | normUnder ≥ 62% | normUnder 56–62% | normUnder < 56% |
| A2 | Team total sum vs game MET | ttCons.diff | T1+T2 sum is ≥7 pts below game MET (underSum, strong) | T1+T2 is 3–7 pts below game MET (underSum, moderate) | T1+T2 equals or exceeds game MET |
| A3 | Cross-scope scale consistency | scaleResult.signal | Smaller scope projects ≤5 pts below FT MET (slowPace/consistent lean) | Slightly slow (+5 to +10 pts low) | Smaller scope projects higher than FT MET (fast pace) |
| A4 | Handicap spread width | hdpResult.balanceLine | Absolute spread ≤ 3 pts (tight = defensive/even game) | Absolute spread 4–7 pts | Absolute spread ≥ 8 pts (large = pace-driving dominant team) |
| A5 | Win probability balance | winW1, winW2 | Favourite at ≤ 58% normalized (near-even match) | Favourite 58–68% | Favourite > 68% (heavy favourite = fast pace likely) |

**Note on check A3:** this check only fires on the Full Time tab when Q1 or 1H data is also entered. On Q1 and H1 tabs, it shows "N/A for this scope." This is correct behavior — cross-scope scaling is only meaningful when projecting a shorter segment to full game length.

### 6.2 Profile B — Over Evidence (all scopes)

Exact mirror of Profile A with inverted signal directions.

| # | Check name | Green signal | Red signal (vs A) |
|---|---|---|---|
| B1 | Best Over line in value zone | normOver ≥ 62% on a line ≤5 pts below MET | normOver < 56% |
| B2 | Team total sum vs game MET | T1+T2 ≥7 pts above game MET (overSum, strong) | T1+T2 equals or falls below game MET |
| B3 | Cross-scope scale consistency | Smaller scope projects ≥10 pts above FT MET (fastPace) | Smaller scope projects lower than FT MET |
| B4 | Handicap spread width | Absolute spread ≥ 8 pts (dominant team sets fast pace) | Absolute spread ≤ 3 pts (tight/defensive game) |
| B5 | Win probability balance | Favourite ≥ 68% (heavy favourite drives pace) | Favourite ≤ 58% (even match tends to be lower-paced) |

### 6.3 Profile C — Handicap and Winner Ranking

Collects all entered handicap lines (T1 and T2 odds at each spread) plus outright winner (W1/W2) and normalizes each:

- **Handicap lines:** each entered spread becomes two entries (Team 1 at that spread, Team 2 at that spread), normalized against each other: `normT1 = implied(T1) / (implied(T1) + implied(T2))`
- **Winner odds:** normalized three-way if a draw is possible, two-way for basketball (no draw in regulation for FT; draw possible in Q1/1H in rare cases but the tool treats W1/W2 as the primary market)

All options are sorted descending by probability and rendered as a ranked list with probability bars.

**How to use Profile C:** when neither Profile A nor B fires strongly (the totals markets are genuinely inconclusive), Profile C identifies the highest-probability result/spread bet. This is particularly useful when:
- The game MET is near an exact line value (near-coinflip O/U)
- Only one or two O/U lines were entered (insufficient for reliable MET interpolation)
- The user wants to cover a bet across result AND totals markets

### 6.4 Profile D — Best Specific Line Finder

Collects every individual Over and Under option from all three O/U markets (game total, team 1, team 2). For each line pair, determines whether Over or Under has higher normalized probability and adds the winning direction as an option. All options are sorted descending by probability.

**The directional rule:** 
- If normOver > normUnder for a given line → add the Over at that line with prob = normOver × 100
- If normUnder > normOver → add the Under at that line with prob = normUnder × 100

This means Profile D will never show a 40% option — every entry is the winning direction at its line, always >50%.

**Strategic purpose:** Profile D answers the specific question "of all the bets I could actually place right now, which single one has the highest probability?" It does not add new information beyond what Profiles A and B analyze in aggregate — rather, it disaggregates them to find the single strongest individual option when the user wants to place exactly one bet.

### 6.5 The Master Banner Priority Waterfall (all scopes)

```
if (Profile A ratio ≥ 0.72 AND completed ≥ 2 checks)
  OR (Profile B ratio ≥ 0.72 AND completed ≥ 2 checks):
    → Recommend the stronger of A (Under) or B (Over)

else if Profile D top pick probability ≥ 78%:
    → Recommend the specific line from Profile D

else if Profile C top pick probability ≥ 78%:
    → Recommend the spread/winner from Profile C

else any data entered:
    → "No standout selection — add more odds or consider skipping"

else:
    → "Enter odds below — a recommendation will build here"
```

Note that the minimum `completed ≥ 2` threshold (vs football's 3) is set lower because basketball profiles can fire meaningfully with fewer checks — a confirmed MET plus one additional supporting check (e.g. spread width) already gives a clearer directional signal than two out of five football checks would. If more checks are added in a future version, this threshold should be reconsidered.

---

## PART 7 — Validation Suite

All steps run before shipping. Future maintainers must repeat steps 1–3 after any edit.

### Step 1: JS syntax check
```bash
node --check bbk_logic.js
# Expected: exit code 0, no output
```

### Step 2: Escape-sequence and balance audit
```python
# Check for over-escaped characters and brace/paren balance
# Expected: 0 occurrences of "\\'", "\\n", "{" count == "}" count
```

### Step 3: ID cross-reference and onclick validation
```python
# All getElementById/bNum/bNumSigned refs must exist as HTML ids or resolve via dynamic construction
# All onclick functions must be defined in JS
# Expected: "Static refs missing: none", "Missing onclick fns: none"
```

### Step 4: Integration test suite (13 tests, all passed)

| # | Test | Result |
|---|---|---|
| 1 | calcScope('ft') runs empty | PASS |
| 2 | calcScope('q1') runs empty | PASS |
| 3 | calcScope('h1') runs empty | PASS |
| 4 | MET computed ≈ 187.5–188 from real 1xBet lines (185.5/187.5/189.5) | PASS — 187.6 |
| 5 | Value zone bestOver exists (line below MET) | PASS |
| 6 | Value zone bestUnder exists (line above MET) | PASS |
| 7 | Team total consistency signal = consistent when T1+T2 ≈ game MET | PASS — diff -0.5 |
| 8 | Scale check: Q1 MET 48.5 × 4 = 194 vs FT 187.5 → slightlyFast/fastPace | PASS |
| 9 | Full calc with real data produces a recommendation string | PASS |
| 10 | saveScreening stores a log entry with scope='FT' | PASS |
| 11 | bImplied(0) returns 0 (edge case — no division by zero) | PASS |
| 12 | bImplied(2.0) returns 0.5 | PASS |
| 13 | analyzeHDP returns a numeric balance line from lopsided handicap data | PASS — 2.5 |

---

## PART 8 — Worked Scenarios: Real 1xBet Data

### Scenario 1: East Perth Eagles vs Cockburn Cougars (NBL1 Australia, 24/07/2026) — Full Time

**Game Total Lines entered (from screenshots):**

| Line | Over | Under | normOver | normUnder |
|---|---|---|---|---|
| 185.5 | 1.612 | 1.908 | 54.2% | 45.8% |
| 187.5 | 1.830 | 1.840 | 50.1% | 49.9% |
| 189.5 | 1.900 | 1.618 | 45.9% | 54.1% |

**MET computed:** 187.6

**Value zone:**
- Best Over: Line 185.5 @ 1.612 (54.2% normalized) — 2.1 pts below MET
- Best Under: Line 189.5 @ 1.618 (54.1% normalized) — 1.9 pts above MET

**Both value-zone bets are very similar:** approximately 54% probability at ~1.61–1.62 odds. This is a genuinely close market with very little directional lean in the game total alone.

**Team Totals from screenshots:**
- Team 1 (East Perth): markets cluster around 88.5–96.5 range → MET approximately 90–92
- Team 2 (Cockburn): markets cluster around 91.5–99.5 range → MET approximately 94–96
- Combined Team MET: approximately 184–188 → consistent with game MET of 187.6

**Handicap from screenshots:** -1.5 to +1.5 at near-even prices (1.381–2.48 range for different spreads), with the tightest line at approximately ±1.5. This is a very small spread — the market sees this as essentially an even contest.

**Cross-scope:**
- Q1 total lines from screenshots: 48.0/48.5/49.0
- Q1 MET ≈ 48.5, × 4 = 194 — faster than FT MET 187.6 by ~6 pts → mild fast-pace signal → slight Over lean

**What the screener would recommend:**
Profile A (Under) and Profile B (Over) both score in the Borderline range (55–65%) because the game total market is nearly exactly balanced. The cross-scope check (Q1×4 = 194 vs FT 187.6) gives Profile B a mild edge. Profile D would surface the two value-zone bets as the specific options with the clearest signal.

**The practical takeaway:** this match is a genuine near-toss-up on game total. The screener correctly identifies that no strong totals selection is available and falls back to Profile C, where the handicap market (near-even between the teams at a tiny spread) suggests neither team has a strong advantage to cover. A punter seeing this output should consider skipping or placing a very small stake only on the value-zone bet in the direction of the mild cross-scope lean (Over, given Q1 pricing suggests faster early pace).

### Scenario 2: Applying the TTC inconsistency model (illustrative)

Hypothetical match where:
- Game Total MET: 210 (bookmaker's posted game total market)
- Team 1 MET: 112 (team 1 individual scoring market)
- Team 2 MET: 106 (team 2 individual scoring market)
- Combined T1+T2: 218 — 8 pts above game MET

**Interpretation:** the individual team markets imply both teams will score more than their share of the game total. This suggests the team-total markets may be priced with more information (team-specific offensive projections) than the game total market. The +8 pt inconsistency exceeds the TEAM_SUM_STRONG threshold of 7 — Profile B check 2 fires green, providing a strong supporting signal for the Over.

**What to check next:** Profile D would show specific Over lines below 210 (the MET) with their normalized probabilities. The best Over line at, say, 207 might carry 57% normalized probability at 1.73 odds. The EV field lets the user check whether their own estimate (say, 62%) implies positive EV: (0.62 × 1.73) − 1 = +7.3% EV.

### Scenario 3: Scale check catching a pace discrepancy (illustrative)

Hypothetical:
- Q1 MET: 52 pts → Q1 × 4 = 208 projected
- 1H MET: 97 pts → 1H × 2 = 194 projected
- FT MET: 188

**Analysis:** Q1 projects a very fast game (208 vs 188 FT = +20 pts, strong fast-pace signal). But the 1H projection (194) is much closer to FT MET (194 vs 188 = +6, only slightly fast). This suggests the Q1 market is pricing an unusually fast start that the market itself thinks will not be sustained through the half. The screener uses 1H × 2 over Q1 × 4 (it prioritizes the 1H projection when available). Net result: mild fast-pace lean (Profile B check 3 = amber rather than green), which is the correct, more conservative read.

---

## PART 9 — How-To-Use Guide (Human Punters)

### Setup
1. Download `basketball-matchday-screener-v1.html` and open it in any modern mobile or desktop browser. No internet connection needed after the initial download.
2. Select your market tab: **Full Time**, **1st Quarter**, or **1st Half**.
3. Open your bookmaker app (1xBet, SportyBet, or similar) and navigate to the basketball match's totals markets.

### Entering odds
4. For the Game Total, enter 3–5 lines. You do not need all lines — even 2 lines produce a MET estimate (though flagged as approximate). The MET display at the top of each section updates as you type.
5. For Team 1 and Team 2 totals, enter 2–4 lines each. These feed the Team Total Consistency check and Profile D's line ranking.
6. For the Handicap, enter the spread value (positive if Team 1 gives points, negative if Team 1 gets points) and the odds for each side. Enter 2–4 lines at different spreads.
7. Enter the outright winner odds (W1, W2) if available.
8. You do not need to fill every field — partial data still produces useful output, with unfilled checks showing "—" rather than contributing to the profile score.

### Reading the output
9. The live probability badges on each line entry row (orange "Over X%" or teal "Under X%") update as you type and tell you immediately which direction is favoured at that specific line. These are normalized — you can trust them as genuine probability estimates.
10. The **MET display** below the section title shows the computed balance point and highlights the best value-zone Over and Under options with their odds and probabilities.
11. The **master banner** at the top gives the single most important output: the recommended direction and the specific line or market option, or a "no standout" verdict if the market is too balanced.
12. The **chip row** shows all four profile scores at a glance.
13. Scroll to **Profile A and B cards** for the detailed check-by-check breakdown. Read the detail text — it explains exactly why each check is green/amber/red, including the actual computed numbers.
14. **Profile D** is the specific line finder — use this when you want to know exactly which bet to place, not just which direction to lean.
15. The **EV field** in Profile C and D lets you enter your own probability estimate. If the tool computes 54% normalized probability on a specific Over bet but you independently estimate 60%, the EV calculation shows whether the odds compensate you sufficiently for your perceived edge.

### When to bet and when to skip
- **Bet:** master banner shows Profile A or B with a strong candidate verdict (both profiles need at least 2 completed checks for this).
- **Consider a specific line bet:** Profile D surfaces a single option at ≥78% — this is your highest-probability available bet.
- **Consider a spread bet:** Profile C top pick ≥78% — use when the totals market is balanced but one team covering is clearly more likely.
- **Skip:** master banner shows "no standout selection." This is common in genuinely balanced games where the MET is near the main betting lines and no cross-market inconsistency exists. Skipping a match that doesn't fit any profile is a discipline advantage, not a loss.

### Using multiple tabs together
- Enter Full Time data first (it enables the cross-scope scale check for FT Profile A and B)
- Then enter Q1 or 1H data — the FT tab automatically uses this for scale projection once entered
- Save each tab's screening before switching using the "Save current tab" button
- Export the log at the end of the session — the log clears when the page is reloaded

---

## PART 10 — Known Limitations

1. **MET is the bookmaker's model, not the true probability.** The MET tells you what the bookmaker believes — but bookmakers can be wrong, especially for lower-profile leagues where they rely on formulaic models rather than detailed intelligence. The MET is a starting point for analysis, not a ground truth.

2. **Single-line MET is approximate.** When only one O/U line pair is entered per market, the MET is set equal to that line value (flagged as `approx: true`). This is the best available estimate but cannot be interpolated. Always try to enter at least 2–3 lines per market for a meaningful MET.

3. **Team total consistency check requires METs from all three markets.** TTC is blank until game total, team 1 total, AND team 2 total all have at least one line entered. With only one line each, the METs are approximate, making TTC less reliable.

4. **Cross-scope check only runs on the Full Time tab.** Q1 and 1H tabs do not check scale consistency against each other (Q1 checking against 1H, for example) — only FT checks against Q1 and 1H. This is a scope decision that could be extended in a future version.

5. **Profile thresholds (BBK.STRONG_SIGNAL, BBK.MOD_SIGNAL, BBK.WEAK_SIGNAL) are set by reasoning, not fitted to historical data.** The 62%/56%/51% tiers were set based on the structural logic of the MET model and the real 1xBet data from one match. A future version with access to historical backtesting data should replace these with empirically fitted values.

6. **No league or team context.** The tool cannot account for pace tendencies of specific teams, recent form, rest days, home-court advantage, or key player availability. These factors can move true probabilities significantly from the market's MET estimate. The tool treats every match identically.

7. **Handicap balance point is always a linear interpolation.** The `analyzeHDP` function uses the same crossover-interpolation approach as `computeMET`. For handicap markets where all entered lines are on one side (e.g., all T1 odds are > 2.00), the function uses the closest-to-even line as an approximation, which may not accurately represent the true balance point.

8. **No live odds feed.** All data entry is manual. There is no scraping, API integration, or auto-refresh of any kind.

---

## PART 11 — Roadmap: Upgrade Paths

| Priority | Item | Complexity | Detail |
|---|---|---|---|
| High | Empirical threshold calibration | High | Collect results for 500+ basketball matches where odds were entered; fit BBK.STRONG_SIGNAL, MOD_SIGNAL, and profile verdict thresholds to maximize correct signal rate on historical outcomes |
| High | Asian Total support | Medium | 1xBet basketball screens also show "Asian Total" lines (e.g. 186.25, 186.75 — fractional lines that eliminate the push). These currently cannot be entered separately. Adding a dedicated Asian Total market group would enable a more precise MET when Asian lines are available |
| Medium | Cross-tab Q1↔1H scale check | Low | Add a Q1 × 2 vs 1H MET check on the 1H tab (Q1 scoring rate vs full-half expectation) and a Q1 × 4 vs FT check on the FT tab when 1H data is missing but Q1 data is available. Currently only FT tab reads Q1/1H data |
| Medium | Automatic Asian margin neutralization | Medium | Asian Total lines have zero-push (no refund on exact total), which slightly alters the implied probability calculation compared to standard O/U. Add a toggle for "Asian line" that adjusts normalization accordingly |
| Medium | Per-line EV in Profile D | Medium | Show EV next to each ranked line in Profile D (requires per-row EV input field without DOM focus-loss issue — same challenge as football v4 roadmap) |
| Low | League preset adjustments | Medium | Some leagues (e.g. NBA vs European leagues vs Australian NBL) have systematically different pace and scoring levels. Add a league preset dropdown that nudges Profile A/B thresholds similarly to the football screener's LEAGUE_DELTA architecture |
| Low | Overtime market handling | Low | Some FT markets include overtime. Add a toggle that warns the user when the selected total market includes OT (often labeled "Including OT" or "Regular Time" on the bookmaker interface) |
| Low | Match history tracking for self-calibration | Medium | Allow the user to record actual game totals after matches and compare against the MET — over time this would reveal whether the MET systematically over- or under-predicts for specific leagues |

---

## PART 12 — Disclaimers

This tool is a decision-support screening aid. The Market Expected Total (MET) is derived mathematically from the odds you enter — it reflects the bookmaker's own implied expectation, not an independent prediction of what will happen. The bookmaker may be wrong, and even a correctly computed MET does not guarantee that any bet at any line will win.

The profiles, thresholds, and cross-market consistency checks were calibrated using one real match (East Perth Eagles vs Cockburn Cougars, 1xBet, 24/07/2026) plus general basketball betting analysis. They have not been backtested against a large historical dataset. The model is structurally sound (the MET algorithm is mathematically exact given the odds inputs), but the thresholds for what constitutes a "strong" signal versus "borderline" remain human-calibrated estimates.

No combination of odds-reading, screening, or model output produces guaranteed positive expected value against a bookmaker. The bookmaker's margin ensures that any bet placed at the exact offered odds has negative EV in aggregate. Value can only exist if you have an independent probability estimate that genuinely exceeds the market's — and this tool cannot generate that estimate for you, only help you structure your own analysis and compare it against what the market prices.

All staking decisions are entirely the user's responsibility. Not financial advice. Works fully offline — no data leaves this page.
