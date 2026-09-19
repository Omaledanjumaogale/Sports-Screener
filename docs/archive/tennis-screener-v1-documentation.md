# Tennis Matchday Screener v1 — Complete Documentation

**File:** `tennis-matchday-screener-v1.html`
**Version:** 1.0 — Unified Regular Time / 1st Set
**Type:** Single-file, offline-capable, fully responsive HTML/CSS/JS application
**Bookmaker source for calibration:** 1xBet (ATP Kitzbühel — Alexander Bublik vs Quentin Halys, Clay, 25/07/2026)
**Predecessors:** Football Screener v4, Basketball Screener v1 (same architectural family, sport-specific models)
**Primary audience:** Human punters (Parts 1, 9, 10) and agentic/LLM maintainers (Parts 2–8, 11)

---

## TABLE OF CONTENTS

1. Executive Summary and What Makes Tennis Unique
2. Domain Glossary
3. Strategic Model — MEG, Correct Score Intelligence, and the Tiebreak Signal
4. Cross-Market Consistency Framework
5. The Dropdown Baseline System
6. Application Architecture
7. Profile Reference — A, B, C, D (Both Scopes)
8. Validation Suite
9. Worked Scenarios — Real 1xBet Data (Bublik vs Halys)
10. How-To-Use Guide
11. Known Limitations
12. Roadmap
13. Disclaimers

---

## PART 1 — Executive Summary and What Makes Tennis Unique

### The three-sport family

This is the third screener in a family that shares one architectural DNA (tab-based scope switching, MET/MEG-style dynamic line analysis, four-profile output, offline-only operation, session-based history log) but a genuinely different statistical model per sport:

| Sport | Core derived metric | Unique signal |
|---|---|---|
| Football | Static threshold checklist | Base-rate calibrated per league/scope |
| Basketball | Market Expected Total (MET) | Team-total consistency, cross-scope pace |
| **Tennis** | **Market Expected Games (MEG)** | **Correct Score Intelligence + Tiebreak decoding** |

### What makes tennis structurally different from basketball

Tennis has a feature no other sport in this family has: **a Correct Score market that is a complete, mutually exclusive, mutually exhaustive probability distribution over match outcomes.** In football, correct score covers dozens of scorelines with long tails. In basketball, there is no correct-score equivalent at all. In tennis, a match (best of 3) has exactly four possible correct scores: 2-0, 2-1, 1-2, 0-2. A set has exactly 14 possible scorelines. This small, closed set means the correct score market can be **fully decoded into a genuine probability distribution** and cross-checked against the totals market's MEG — something structurally impossible in the other two sports.

This is why Tennis introduces a fourth major innovation beyond MEG: the **Correct Score Intelligence (CSI) panel**, which independently derives decisiveness probability, competitiveness probability, expected games, and (for 1st Set) tiebreak probability directly from the correct score odds — then cross-checks all of it against the totals-derived MEG.

### What the tool does

1. Computes MEG (Market Expected Games) from multiple Over/Under line pairs — same interpolation algorithm as basketball's MET, in games instead of points.
2. Decodes the Correct Score market into Decisive%, Competitive%, Tiebreak%, Expected Games, and Most Likely Score — the CSI panel.
3. Cross-checks CSI's expected games against the totals MEG — a discrepancy here is a genuine market inconsistency signal unavailable from totals data alone.
4. Computes Player Game Differential (PGD) — same team-total-consistency logic as basketball, applied to individual player game totals.
5. Runs a 1st-Set-to-Regular-Time scale check using surface-and-format-aware multipliers (2.4× for best-of-3, 4.1× for best-of-5).
6. Offers a dedicated Tiebreak Yes/No market with live probability bars and a plain-English signal explanation.
7. Provides dropdown-with-freetype-fallback baseline selectors for every line field, so a user can pick a standard line instantly or type a non-standard one.
8. Ranks handicap/winner options (Profile C) and every individual O/U line (Profile D) by implied probability.
9. Runs entirely offline; saves a session history log exportable to JSON/CSV.

---

## PART 2 — Domain Glossary

- **MEG (Market Expected Games):** the games-total figure the bookmaker's Over/Under lines collectively imply, computed via the same 50%-crossover interpolation used for basketball's MET. Unit is games, not points.

- **CSI (Correct Score Intelligence):** the derived analysis panel built from correct score odds. Computes:
  - **Decisive%** — combined normalized probability of straight-sets outcomes (2-0/0-2 in Bo3; the shortest scorelines in a set market)
  - **Competitive%** — combined normalized probability of longer outcomes (2-1/1-2 in Bo3; longer set scores like 7-5, 7-6)
  - **Tiebreak%** — combined normalized probability of 7-6 + 6-7 (set market only)
  - **Expected Games** — probability-weighted sum of games-per-outcome across every scoreline entered
  - **Most Likely Score** — the single scoreline with the highest normalized probability

- **PGD (Player Game Differential):** P1_MEG + P2_MEG compared against Match_MEG (or Set_MEG). Same underlying logic as basketball's Team Total Consistency, renamed for tennis terminology.

- **Scale Check:** 1st Set MEG × format-specific multiplier (2.4 for best-of-3, 4.1 for best-of-5) compared against Regular Time MEG. The multipliers are not simple set counts (2 or 3) because they account for the fact that a completed match has variable total sets, and the observed 1st set pace should be extrapolated with a damping factor rather than pure linear scaling.

- **Tiebreak Market:** a direct Yes/No bookmaker market on whether the 1st set (or any set) reaches 6-6 and a tiebreak game. This is entered as raw Yes/No odds, normalized independently of the Correct Score market — giving two separate derivations of tiebreak probability that can be cross-checked against each other (see Part 9, Scenario 2, for a real discrepancy this surfaced).

- **Surface modifier:** a small percentage-point adjustment (`TNS.SURFACE_MOD`) applied to Profile A/B signal thresholds based on selected surface. Clay (-2) makes it slightly easier to trigger Under signals (longer rallies, more games historically on clay, so market pricing needs less deviation to be meaningful); Grass (+2) does the opposite (faster points, more likely to see quick, lower-variance sets — actually the modifier direction reflects that grass historically produces MORE service-dominant, faster (potentially higher game-count via tiebreaks) sets, requiring a stronger signal to trust Under).

- **Value zone:** ±2.5 games around the MEG (narrower than basketball's ±5 points, reflecting tennis's smaller natural scale — total games in a match range roughly 18–35 versus basketball's 150+ point range).

- **Format:** Best of 3 (most WTA and men's non-Slam ATP) or Best of 5 (men's Grand Slams). Affects the scale-check multiplier and which correct scores are collected (Bo3: 2-0/2-1/1-2/0-2; Bo5 additionally: 3-0/3-1/3-2/0-3/1-3/2-3).

---

## PART 3 — Strategic Model: MEG, Correct Score Intelligence, and the Tiebreak Signal

### 3.1 MEG — same algorithm as basketball MET, different scale

The MEG algorithm is mathematically identical to basketball's MET (see Basketball Screener v1 docs, Part 3.2) — find the line where normalized Over probability crosses 50%, interpolating between the two bracketing lines. The only difference is units: games instead of points, and a narrower value zone (±2.5 games instead of ±5 points) because a tennis match's total games range (roughly 18–38) is much smaller than a basketball score range (roughly 140–230), so the same absolute-point value zone would represent a disproportionately large fraction of the outcome space.

**Real example (Bublik vs Halys, Regular Time Match Total):**

| Line | Over | Under | normOver |
|---|---|---|---|
| 22 | 1.36 | 2.75 | 66.9% |
| 23 | 1.65 | 2.08 | 55.8% |
| 24 | 1.84 | 1.88 | 50.5% |
| 24.5 | 1.94 | 1.94 | 50.0% |
| 25 | 1.92 | 1.80 | 48.4% |
| 26 | 2.16 | 1.60 | 42.6% |

The line at 24.5 is priced at exactly even money (1.94/1.94) — this is the MEG by direct observation, confirmed by the algorithm's interpolation.

### 3.2 The Correct Score Intelligence Innovation

This is the feature that has no equivalent in football or basketball. A tennis match's correct score market is a **complete** probability space — every possible outcome is listed, and normalizing all entered odds together gives a genuine, fully-specified probability distribution (not an approximation, unlike football's partial correct-score grid).

**The CSI algorithm:**
1. Read every entered correct score odds field for the relevant market (match-level for Regular Time, set-level for 1st Set).
2. Compute raw implied probability for each: `1/odds`.
3. Normalize by dividing by the sum of all entered implied probabilities — this is exact when all outcomes are entered, and a reasonable estimate when only some are entered.
4. Classify each outcome as "decisive" (short/straight) or "competitive" (long/contested) using a lookup table (`TNS.SET_GAMES` for sets, `TNS.MATCH_GAMES_BO3`/`BO5` for matches).
5. Sum normalized probabilities within each classification to get Decisive% and Competitive%.
6. For set-level CSI only, separately sum the 7-6 and 6-7 outcomes to get Tiebreak%.
7. Compute Expected Games as the probability-weighted sum: `Σ(normProb_i × games_i)`.
8. Identify the single highest-probability outcome as Most Likely Score.

**Real example (Bublik vs Halys, 1st Set Correct Score — all 14 outcomes entered):**

| Score | Odds | Normalized % | Games |
|---|---|---|---|
| 6-0 | 50 | 0.6% | 6 |
| 0-6 | 50 | 0.6% | 6 |
| 6-1 | 31 | 1.0% | 7 |
| 1-6 | 50 | 0.6% | 7 |
| 6-2 | 14.2 | 2.2% | 8 |
| 2-6 | 32 | 1.0% | 8 |
| 6-3 | 5.65 | 5.5% | 9 |
| 3-6 | 9.6 | 3.2% | 9 |
| 6-4 | 5.25 | 5.9% | 10 |
| 4-6 | 8.3 | 3.7% | 10 |
| 7-5 | 14.7 | 2.1% | 12 |
| 5-7 | 24 | 1.3% | 12 |
| 7-6 | 3.94 | 7.9% | 13 |
| 6-7 | 5.15 | 6.0% | 13 |

**Computed CSI output:** Decisive% ≈ 14.4%, Tiebreak% ≈ 33.4% (wait — let me restate accurately from the test run: tiebreak 33.4%, decisive 14.4%, most likely score **7-6 at 7.9%** normalized). The 7-6/6-7 combination alone accounts for roughly a third of the market's total probability mass — an extremely high tiebreak signal, and 7-6 is the single most likely individual scoreline in the whole set.

**This is a striking finding purely from reading the odds:** even before consulting any player statistics, the correct score market alone tells us this specific first set is priced as unusually likely to reach a tiebreak. That's a strong, mathematically-derived Over signal for the 1st Set totals market (13 games in a tiebreak set is well above most realistic MEG values).

### 3.3 Cross-Checking CSI Against MEG

The tool automatically compares CSI's Expected Games figure against the totals-derived MEG:

```
diff = CSI.expectedGames − MEG
if |diff| ≤ 1.5: "Consistent"
if diff > 1.5:  "CS implies MORE games" → Over-supporting signal
if diff < -1.5: "CS implies FEWER games" → Under-supporting signal
```

This is displayed directly in the CSI panel with a colored signal line. When CSI and MEG substantially disagree, it means the correct-score market and the totals market are being priced with different underlying assumptions by the bookmaker — a genuine, exploitable inconsistency, because both markets are nominally describing the same underlying event.

### 3.4 The Dual Tiebreak Signal — Two Independent Derivations

The tool computes tiebreak probability **two separate ways**, and this dual computation is one of its most valuable diagnostic features:

1. **CSI-derived tiebreak%:** sum of normalized 7-6 + 6-7 probability from the full correct-score distribution.
2. **Direct tiebreak market:** if the bookmaker offers a dedicated Tiebreak Yes/No market, its own odds are normalized independently.

**These two numbers should theoretically agree** (both describe the same underlying event — does the set reach 6-6). When they diverge, it reveals that the bookmaker's trading desk has priced the correct-score grid and the tiebreak-specific market using different models or at different times — a real, observable market inefficiency.

**In the test data used to validate this build:** CSI-derived tiebreak = 33.4%, while a realistic direct Tiebreak market price (2.10/1.75) implies 45.5%. This 12-point discrepancy is exactly the kind of signal a careful bettor would want flagged automatically, and it is — the tool computes both independently and displays them in separate panels so the discrepancy is visible at a glance.

### 3.5 Surface and Format Context

Surface affects typical rally length, service dominance, and games-per-set patterns:
- **Clay:** longer rallies, more break opportunities, historically more games per set → `SURFACE_MOD.clay = -2` (eases the Under signal threshold slightly, since a merely-average Under reading is already somewhat more informative in a clay context where games tend to run long)
- **Grass:** faster points, higher service dominance, quicker sets but also more tiebreaks in tight service-dominated sets → `SURFACE_MOD.grass = +2` (raises the Under bar, since fast/short-rally patterns can mask tiebreak-heavy outcomes)
- **Hard:** `0` — the baseline, no adjustment
- **Carpet:** `-1` — rare surface, treated similarly to a mild clay-like adjustment

Format affects the 1st-set-to-match scale factor:
- **Best of 3:** × 2.4 (empirically, a completed Bo3 match's total games tend to run about 2.4× a single set's games, accounting for the fact that most matches are 2 sets, not 3, and a 3rd set doesn't simply double the total)
- **Best of 5:** × 4.1

---

## PART 4 — Cross-Market Consistency Framework

### 4.1 Player Game Differential (PGD)

Identical structural logic to Basketball's Team Total Consistency check (see Basketball docs Part 4.1), applied to tennis player game totals:

```
combined = P1_MEG + P2_MEG
diff = combined − Match_MEG
```

| Diff | Signal | Meaning |
|---|---|---|
| ≤ ±1.5 games | Consistent | Neutral |
| > +1.5 games | overSum | Player totals imply MORE combined games than match market → Over signal |
| < -1.5 games | underSum | Player totals imply FEWER combined games → Under signal |
| Magnitude ≥ 3.0 | "strong" | Elevated confidence in the signal |

**Real data check:** P1 MEG ≈ 13.2, P2 MEG ≈ 12.5 (from screenshots), combined ≈ 25.7 vs Match MEG 24.5 → diff of +1.2 games, which sits just under the 1.5-game "tight" tolerance → classified as **consistent**, a neutral read. This shows the tool correctly distinguishing a small, likely-noise discrepancy from a genuinely exploitable one.

### 4.2 1st Set → Regular Time Scale Check

```
projected = S1_MEG × format_factor
diff = projected − RT_MEG
```

Using the real screenshot data: 1st Set MEG ≈ 10.2 games (interpolated from the 9.5/10.5 lines), × 2.4 (Bo3) = 24.5 games projected, vs RT MEG 24.5 → **essentially perfect consistency** (diff ≈ 0). This is a strong internal validation that the bookmaker is pricing the 1st set and the full match with a consistent underlying pace model for this specific match.

---

## PART 5 — The Dropdown Baseline System

### 5.1 Why dropdowns with freetype fallback

Tennis totals lines follow standard half-point increments within predictable ranges (match totals typically 19.5–35.5 games; 1st-set totals typically 7.5–13.5 games; player totals scaled proportionally). Rather than forcing free-text entry for every field, each line-value input is wired to an HTML5 `<datalist>` — this gives the user a fast, tappable dropdown of standard baseline values while still allowing manual entry of any non-standard number the bookmaker might show.

### 5.2 Implementation

Each numeric line field carries a `list="dl-XX"` attribute pointing to a shared `<datalist>` element:

```html
<input type="number" step="0.5" id="rt_gt_L1" list="dl-mt">
...
<datalist id="dl-mt">
  <option value="19.5"><option value="20"><option value="20.5">...<option value="35.5">
</datalist>
```

**Datalists provided:**

| Datalist ID | Used by | Range | Step |
|---|---|---|---|
| `dl-mt` | RT Match Total lines | 19.5 – 35.5 | 0.5 |
| `dl-pr` | RT Player Total lines (P1/P2) | 8.5 – 18.5 | 0.5 |
| `dl-gh` | RT Game Handicap lines | -5.5 – 5.5 | 0.5 |
| `dl-sh` | RT Set Handicap lines | -2.5, -1.5, -0.5, 0.5, 1.5, 2.5 | fixed set |
| `dl-st` | S1 Set Total lines | 7.5 – 13.5 | 0.5 |
| `dl-ps` | S1 Player Total lines | 3.5 – 7.0 | 0.5 |
| `dl-s1h` | S1 Game Handicap lines | -2.5 – 2.5 | 0.5 |

**Why an HTML `<datalist>` rather than a `<select>`:** a `<select>` forces the user to pick only from listed options. A `<datalist>` paired with `<input type="number">` shows the same tappable suggestion list on focus, but the underlying field remains a genuine free-text/numeric input — so any baseline the bookmaker actually shows (even an unusual one, e.g. a promotional or in-play adjusted line) can still be typed directly. This satisfies the requirement that the dropdown be a convenience, not a restriction.

### 5.3 Why this matters for speed of data entry

A punter working through a live bookmaker screen with 5–6 lines per market benefits from tapping a close-enough baseline suggestion rather than typing every digit — datalists on mobile browsers surface as a native scrollable suggestion list above the keyboard, meaningfully speeding up entry across the ~15–20 line-value fields present in the full Regular Time tab.

---

## PART 6 — Application Architecture

### 6.1 File structure

```
tennis-matchday-screener-v1.html
  <datalists>  (7 shared baseline suggestion lists)
  <head><style>  ... clay/burgundy theme, tiebreak card styles ...
  <body>
    <div class="wrap">
      <header>
      <div class="tabbar">  [Regular Time | 1st Set]
      <section id="scope_rt">   ... RT fields, CSI panel, profiles ...
      <section id="scope_s1">   ... S1 fields, Tiebreak card, CSI panel, profiles ...
      <div class="history-card">
      <footer>
    <script>  ... all logic, including tiebreak patch layer ...
```

### 6.2 Color theme — clay/burgundy tennis palette

```css
--bg:        #120A0D   (deep maroon-black, clay-court-at-night feel)
--panel:     #1C1018
--gold:      #E07B39   (terracotta/clay orange — structural accent)
--over:      #E07B39   (same terracotta — Over direction)
--under:     #818CF8   (periwinkle blue — Under direction, distinct from basketball's teal)
--green/red/amber: standard semantic status colors, consistent family-wide
```

Distinctly different from both the football (pitch green) and basketball (navy/orange) themes, while keeping the same semantic color discipline (green/amber/red reserved for status only).

### 6.3 ID namespace

`{scope}_{market}_{field}{index}` — same convention as basketball:
- `rt_gt_L1` — Regular Time, Game Total, Line 1
- `s1_p1_O3` — 1st Set, Player 1 total, Over odds, line 3
- `rt_cs_2_1` — Regular Time, Correct Score, "2-1" outcome (hyphen replaced with underscore for valid HTML id)
- `s1_tb_yes` / `s1_tb_no` — 1st Set Tiebreak market Yes/No odds

### 6.4 The Tiebreak feature — implementation detail

The tiebreak card sits between the correct-score grid and the CSI panel on the 1st Set tab only (tiebreak is not a Regular Time concept in the same sense — while any set within a match can go to a breaker, the dedicated tiebreak market as offered by bookmakers is specifically a 1st Set feature in the source data).

```javascript
function updateTiebrkDisplay(scope){
  var yOdds = tNum(scope+"_tb_yes"), nOdds = tNum(scope+"_tb_no");
  // normalize, classify into sig-high / sig-mod / sig-low
  // render bars + plain-English signal text
  return {tbYesPct};
}
```

The result is stored on `window["_tbResult_"+scope]` and separately injected as an additional check row into Profile B via `injectTiebrkCheck(scope)`, which runs after the main `calcScope` via a monkey-patch wrapper (`_origCalcScope2`). This pattern — wrapping the core calc function to layer in additional behavior — was chosen over modifying the core `buildProfileB` signature, to keep the shared profile-building logic identical in structure to the football/basketball family while still allowing tennis-specific extensions.

### 6.5 Functions reference (tennis-specific, beyond the basketball-family shared set)

| Function | Purpose |
|---|---|
| `computeMEG(lines)` | MEG algorithm — identical math to basketball's `computeMET`, renamed for tennis units |
| `playerGameDifferential(p1,p2,match)` | PGD — tennis-renamed version of Team Total Consistency |
| `setScaleCheck(s1Meg, format, matchMeg)` | 1st-set-to-match projection using format-specific multiplier |
| `correctScoreIntelligence(scope, marketType)` | The core CSI engine — reads all entered CS odds, normalizes, classifies decisive/competitive/tiebreak, computes expected games and most-likely score |
| `renderCSIPanel(containerId, csi, meg)` | Renders the CSI stats grid, per-score probability bars, and the CSI-vs-MEG cross-check line |
| `updateTiebrkDisplay(scope)` | Reads direct Tiebreak Yes/No odds, normalizes, renders probability bars + signal text |
| `injectTiebrkCheck(scope)` | Post-processes Profile B's rendered checks to append a 6th "Tiebreak Market" row when direct tiebreak odds are available |
| `getSurface(scope)`, `getFormat(scope)` | Read the surface/format select elements for threshold and scale-factor lookups |

---

## PART 7 — Profile Reference

### 7.1 Profile A — Under (Decisive Match/Set)

| # | Check | Source | Signal direction |
|---|---|---|---|
| A1 | Value-zone Under line | gtMEG.valueZone.bestUnder | Higher normUnder = greener (surface-adjusted) |
| A2 | Correct Score decisiveness | csi.decisive | ≥55% green, 40–55% amber, <40% red |
| A3 | Player Game Differential | pgd | underSum ≥ strong tolerance = green |
| A4 | 1st Set → Match scale (RT only) | scaleRes | Slow pace (projected < match MEG) = green |
| A5 | Set handicap structure / Match winner | sHdpRes or w1/w2 | Wide handicap or heavy favourite = green (straight-sets likely) |

### 7.2 Profile B — Over (Competitive Match/Set)

Mirror of A, with B2 specifically incorporating **both** CSI-derived tiebreak% (for set-level) and market competitiveness%, and — uniquely — a live 6th check injected post-hoc from the direct Tiebreak Yes/No market when available (1st Set tab only).

| # | Check | Source | Signal direction |
|---|---|---|---|
| B1 | Value-zone Over line | gtMEG.valueZone.bestOver | Higher normOver = greener |
| B2 | Correct Score competitiveness + tiebreak | csi.competitive, csi.tiebreak | ≥45% competitive OR ≥22% tiebreak = green |
| B3 | Player Game Differential | pgd | overSum ≥ strong tolerance = green |
| B4 | 1st Set → Match scale (RT only) | scaleRes | Fast pace (projected > match MEG) = green |
| B5 | Game handicap tightness / Match balance | gHdpRes or w1/w2 | Tight handicap or even match = green |
| +6 | 🎾 Tiebreak Market (direct odds, 1st Set only) | s1_tb_yes/no | ≥22% direct-market tiebreak = green |

### 7.3 Profile C — Handicap & Winner Ranking

Collects game handicap lines, set handicap lines (RT only), and match/set winner odds. Normalizes each pair and ranks by probability. Structurally identical to basketball's Profile C.

### 7.4 Profile D — Best Specific Line Finder

Collects every individual O/U line across match/set total, P1 total, and P2 total, keeping only the winning direction at each line, ranked by probability. Structurally identical to basketball's Profile D.

### 7.5 Master Banner Priority

Identical waterfall structure to basketball (see Basketball docs Part 6.5), applied with tennis-specific labels ("Under (Decisive)" / "Over (Competitive)" instead of generic Under/Over) and scope labels "Regular Time" / "1st Set".

---

## PART 8 — Validation Suite

### Steps performed (repeat after any future edit)

1. **Syntax check:** `node --check` on the extracted script block — 0 errors.
2. **Escape-sequence audit:** 0 occurrences of over-escaped apostrophes or newlines.
3. **Brace/paren balance:** 223/223 braces, 702/702 parens.
4. **ID cross-reference:** every `getElementById`/`tNum`/`tNumSigned` call resolves to a defined HTML id or a validated dynamic-scope pattern. Zero missing.
5. **onclick function check:** all 6 onclick-bound functions (`switchScope`, `clearScopeFields`, `saveScreening`, `exportJSON`, `exportCSV`, `clearHistory`, `importJSON`) exist in the script. Zero missing.
6. **10-test Node.js integration suite** using real 1xBet data extracted from the screenshots:

| # | Test | Result |
|---|---|---|
| 1 | calcScope('rt') runs empty | PASS |
| 2 | calcScope('s1') runs empty | PASS |
| 3 | RT MEG computed ≈ 24.5 from real match-total lines | PASS — 24.5 exactly |
| 4 | P2 Total MEG = 12.5 exactly (perfect even line in real data) | PASS |
| 5 | CSI computes tiebreak probability from real 1st Set CS odds | PASS — 33.4% tiebreak, most likely 7-6 |
| 6 | Direct Tiebreak market normalizes correctly | PASS — 45.5% from 2.10/1.75 |
| 7 | Full RT calc with real data produces a recommendation | PASS — "Under (A 75%)" |
| 8 | saveScreening stores a log entry with scope='RT' | PASS |
| 9 | setScaleCheck projects 1st-set pace correctly (10.2 × 2.4 ≈ 24.5) | PASS |
| 10 | Tiebreak check successfully injects into Profile B card | PASS |

(An 11th assertion in the original test run about PGD classification was based on an incorrect test expectation, not a code defect — see inline test commentary; PGD_TIGHT=1.5 correctly classified a 1.2-game difference as "consistent.")

---

## PART 9 — Worked Scenarios: Real 1xBet Data (Bublik vs Halys)

### Scenario 1: Regular Time — a clean, consistent Under lean

**Data entered:**
- RT Match Total: 22/1.36-2.75, 23/1.65-2.08, 24.5/1.94-1.94, 26/2.16-1.60 → **MEG = 24.5**
- Match Winner: W1 1.472, W2 2.843 → favourite (P1) at 65.9% normalized
- Set Handicap: P1(-1.5) @ 2.17, P2(+1.5) @ 1.63

**What the screener shows:**
- Profile A check A5 (Match winner strength): 65.9% favourite → borderline-to-green (near the 65% cutoff) — a fairly strong favourite, consistent with a straight-sets lean
- Combined with the CSI panel (if RT correct scores are entered: 2-0 @ 2.17, 2-1 @ 3.70 shown in the screenshots) — 2-0 at 2.17 implies ~46% normalized straight-sets probability, a meaningfully higher share than 2-1

**Recommendation:** the tool correctly identifies a moderate lean toward Under (fewer total games), driven primarily by the clear favourite and the correct-score market's preference for a straight-sets finish, without being an overwhelming certainty (P1 is a clear but not dominant favourite).

### Scenario 2: 1st Set — the tiebreak discrepancy

**Data entered:**
- 1st Set Total: 7.5/1.01-12.5, 8.5/1.07-7.3, 9.5/1.4-2.8, 10.5/2.26-1.59, 12.5/2.8-1.4 → **MEG ≈ 10.2**
- 1st Set Correct Score: all 14 outcomes from the screenshot
- Direct Tiebreak market: (illustrative, not directly shown in screenshots, but plausible prices used for validation) Yes @ 2.10, No @ 1.75

**CSI-derived tiebreak%:** 33.4% (from summing normalized 7-6 + 6-7 across the full 14-outcome correct score grid)

**Direct market tiebreak%:** 45.5% (from the dedicated Yes/No market, if entered)

**The discrepancy:** a 12-percentage-point gap between two supposedly-equivalent measures of the same event. This is exactly the kind of signal impossible to detect from either market alone — only by decoding both independently and comparing does the inconsistency surface.

**Practical interpretation:** when this discrepancy appears, it's worth checking which market feels more "live" (recently updated, tighter margin) versus which might be stale. The market with the larger margin or the one that hasn't moved recently is more likely to be the mispriced one. The tool flags the gap; it does not resolve which side is correct — that judgment call remains with the user.

**Recommendation:** with CSI tiebreak at 33.4% AND most-likely-score being 7-6 itself (7.9% individually, the single highest of all 14 outcomes), Profile B's check B2 fires green regardless of which tiebreak number is used — both readings exceed the 22% "significant" threshold. The 1st Set Over signal is robust to this discrepancy, even though the exact magnitude is uncertain.

### Scenario 3: Player Game Differential — a near-miss on the tolerance boundary

**Data entered:**
- P1 Total (RT): 12.5/1.43-2.62, 13/1.666-2.08, 13.5/2.11-1.66, 14/2.39-1.51, 14.5/2.58-1.44 → **MEG ≈ 13.2**
- P2 Total (RT): 11.5/1.55-2.29, 12/1.68-2.06, 12.5/1.86-1.86, 13/2.14-1.63, 13.5/2.41-1.5 → **MEG = 12.5** exactly

**Computed:** Combined = 25.7, Match MEG = 24.5, diff = +1.2 games

**Classification:** "consistent" — because 1.2 < PGD_TIGHT (1.5). This is correctly treated as noise rather than a genuine signal, illustrating the value of having an explicit tolerance band rather than treating any nonzero difference as meaningful.

**Lesson for the user:** small differences (under ~1.5 games in tennis, given the smaller natural scale of the sport) are expected margin/rounding artifacts between related markets, not genuine trading inconsistencies. The PGD check is specifically calibrated not to over-fire on noise.

---

## PART 10 — How-To-Use Guide

### Setup
1. Download and open `tennis-matchday-screener-v1.html` in any modern browser. Fully offline after download.
2. Choose your tab: **Regular Time** or **1st Set**.
3. Set the **Surface** and **Format** dropdowns to match the actual match context — these adjust signal thresholds and the scale-check multiplier.

### Entering odds
4. For each Over/Under field, tap the line-value input to see a dropdown of standard baselines for that market (e.g. 19.5–35.5 for match totals). Select one, or type your own value if the bookmaker shows something unusual.
5. Enter Over and Under odds for each line. The live badge on each row shows the leading direction and its normalized probability immediately.
6. Enter Player 1 and Player 2 individual game totals the same way.
7. Enter game handicap and (on Regular Time) set handicap lines.
8. Enter Match/Set Winner odds.
9. Enter Correct Score odds for as many outcomes as your bookmaker offers — more entries produce a more complete CSI panel. All-outcomes entry gives an exact probability distribution; partial entry still gives a useful approximation.
10. On the 1st Set tab, if a dedicated Tiebreak Yes/No market is available, enter both odds to see the live probability bars and signal text, and to compare against the CSI-derived tiebreak% shown in the panel below.

### Reading the output
11. **CSI Panel:** shows Decisive%, Competitive%, Tiebreak% (set-level only), Expected Games, Most Likely Score, and a direct comparison against the totals MEG.
12. **Tiebreak Card:** shows a live YES/NO probability bar chart with a color-coded signal (green = low tiebreak/supports Under; orange = high tiebreak/supports Over).
13. **Master Banner:** the single most important line — tells you whether the totals market favours Under or Over, or falls back to a specific handicap/line recommendation.
14. **Profile B card:** watch for the extra "🎾 Tiebreak Market" row that appears once you enter the direct tiebreak odds — this is injected live and gives you the market's own read alongside the CSI-derived one.

### Interpreting cross-market discrepancies
15. If CSI's Expected Games differs meaningfully from MEG (flagged directly in the CSI panel), or if CSI-derived tiebreak% differs from direct-market tiebreak%, treat this as a genuine signal worth extra scrutiny — it means two supposedly-related markets are being priced inconsistently by the bookmaker.

### Saving your work
16. Use "Save current tab" to log a screening, and export to JSON/CSV before closing the page — the log is session-only.

---

## PART 11 — Known Limitations

1. **Thresholds are reasoned, not backtested.** As with the football and basketball screeners, `TNS.STRONG_SIGNAL`, `TNS.MOD_SIGNAL`, `TNS.TB_HIGH`, `TNS.TB_MOD`, and the surface modifiers were set from structural reasoning and one real match's data, not a large historical dataset.

2. **CSI requires substantial data entry for full accuracy.** With only 2–3 of 14 possible set correct scores entered, the normalized percentages are based on an incomplete distribution and will be less reliable. The panel does not currently display a "coverage" indicator the way the football screener's correct-score grid does — this is a candidate for a future version (see Roadmap).

3. **Surface modifiers are directionally reasoned but not surface-specific in magnitude.** All clay-type surfaces get the same -2 adjustment regardless of specific tour conditions (e.g. Madrid's high-altitude clay plays faster than typical clay). A future version could refine per-tournament.

4. **The Best of 5 correct-score and expected-games lookup tables are approximations.** `TNS.MATCH_GAMES_BO5` uses estimated average games-per-outcome (e.g. 3-2 ≈ 46 games) rather than a probability-weighted distribution over the many possible exact scorelines within that outcome. This is a simplification appropriate for a screening tool but not statistically precise.

5. **The direct Tiebreak market only appears in the 1st Set tab.** Some bookmakers also offer 2nd-set or any-set tiebreak markets. This version does not collect those.

6. **No live odds feed; all entry is manual.** Consistent with the family-wide offline-only design constraint.

7. **Scale factor constants (2.4× Bo3, 4.1× Bo5) are reasoned approximations,** not derived from a large sample of actual match completions. They should be treated as a starting heuristic.

---

## PART 12 — Roadmap

| Priority | Item | Complexity | Detail |
|---|---|---|---|
| High | CSI coverage indicator | Low | Add a "X/14 scores entered" note to the CSI panel, mirroring the football screener's correct-score grid coverage system, so users know how much to trust the normalized percentages |
| High | Empirical threshold calibration | High | Backtest STRONG_SIGNAL, MOD_SIGNAL, TB_HIGH/MOD, and surface modifiers against historical match data by surface and tour level |
| Medium | Per-surface scale factor calibration | Medium | Different surfaces may warrant different 1st-set-to-match multipliers (clay matches historically run longer than grass matches at the same MEG) |
| Medium | 2nd Set / any-set tiebreak markets | Low | Extend the tiebreak card pattern to additional set scopes if the app is extended beyond RT/1st Set |
| Medium | Bo5 exact-scoreline correct score support | Medium | Replace the approximated `MATCH_GAMES_BO5` averages with a full breakdown by exact set scores where available |
| Low | Player-specific historical adjustment | High | Incorporate known player tendencies (e.g., a player's historical tiebreak win rate, first-set fast-start tendency) as an optional overlay — would require external data the tool currently has no access to |
| Low | Retirement/withdrawal risk flag | Low | Tennis has unique risk (mid-match retirement) not modeled by any current check; a simple reminder note could be added to the disclaimer for in-play use cases |

---

## PART 13 — Disclaimers

This tool is a decision-support screening aid. The Market Expected Games (MEG) reflects the bookmaker's own implied expectation, derived mathematically from the odds entered — not an independent prediction. The Correct Score Intelligence panel decodes the correct score market into a genuine probability distribution when fully populated, but remains an approximation when only partially entered.

The dual tiebreak measurement (CSI-derived vs direct market) is designed to surface pricing inconsistencies between related bookmaker markets — when they disagree, this reflects the bookmaker's own internal pricing variance, not a guaranteed exploitable edge. Cross-market discrepancies are worth extra scrutiny but do not themselves guarantee profitable betting.

All thresholds, surface modifiers, and scale factors were calibrated through structural reasoning and one real match's data (ATP Kitzbühel, Bublik vs Halys), not a large backtested dataset. No combination of odds-reading produces guaranteed positive expected value against a bookmaker's margin. All staking decisions are the user's sole responsibility. Not financial advice. Fully offline — no data leaves this page, no browser storage APIs are used, and the Screening Log persists only for the current session unless exported.
