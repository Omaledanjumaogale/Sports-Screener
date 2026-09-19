# Ice Hockey Matchday Screener v1 — Complete Documentation

**File:** `ice-hockey-matchday-screener-v1.html`
**Version:** 1.0 — Unified Regular Time / 1st Period
**Type:** Single-file, offline-capable, fully responsive HTML/CSS/JS application
**Data source for this build:** No screenshots were uploaded for this sport. All illustrative odds used for validation testing (Carolina Hurricanes vs Florida Panthers-style NHL figures) were constructed from general knowledge of realistic hockey market structures and odds shapes — see Part 1.1 for full disclosure.
**Predecessors:** Football Screener v4, Basketball Screener v1, Tennis Screener v1 (same architectural family; this document explains what's reused vs newly invented)
**Primary audience:** Human punters (Parts 1, 9, 10) and agentic/LLM maintainers (Parts 2–8, 11)

---

## TABLE OF CONTENTS

1. Executive Summary and Honest Data Disclosure
2. Domain Glossary
3. Strategic Model — Two Innovations Unique to Hockey
4. Cross-Market Consistency Framework (Reused Patterns)
5. Application Architecture
6. Profile Reference — A, B, C, D (Both Scopes)
7. Validation Suite
8. Worked Scenarios — Illustrative Data with Hand-Verified Math
9. How-To-Use Guide
10. Known Limitations
11. Roadmap
12. Disclaimers

---

## PART 1 — Executive Summary and Honest Data Disclosure

### 1.1 About the data used in this build

Unlike the football, basketball, and tennis screeners in this family — each built and validated against real screenshots you uploaded — **no hockey screenshots were provided in this conversation.** Every specific odds figure referenced in this document (the illustrative "Carolina Hurricanes vs Florida Panthers" and "Ak Bars Kazan vs Sibir Novosibirsk" style numbers) was constructed from general knowledge of how hockey betting markets are actually structured and typically priced, for the purpose of validating that the engine's mathematics work correctly. This is stated plainly here so nothing in this document is mistaken for a claim about real, verified market data. The market *structures* (which fields exist, how puck lines are typically quoted, how correct-score grids are shaped) reflect genuine hockey betting conventions; the specific *odds numbers* are illustrative test fixtures, not observations.

If you have real hockey odds screenshots, the tool is ready to use with them exactly as built — nothing about the engine depends on the illustrative numbers used during development.

### 1.2 What makes hockey structurally unique among the four sports in this family

| Sport | Can regulation end in a draw? | Correct score shape | Cross-scope multiplier reliability |
|---|---|---|---|
| Football | Yes, and it's a normal final result | Open-ended, long tail | 1H×2≈FT (moderate) |
| Basketball | No | No CS market | Q1×4 or 1H×2≈FT (moderate) |
| Tennis | No | Small, closed, exhaustive | Set×2.4/4.1≈Match (moderate) |
| **Ice Hockey** | **Yes in regulation, but always resolved by OT/SO for standings** | **Open-ended with additive (home,away) structure** | **Period×3≈Regulation (highest reliability — periods are exactly equal length by rule)** |

Hockey is the only sport in this family where **the same match** produces two structurally different result markets: a 3-way regulation-time 1X2 (Win/Draw/Win) that genuinely allows a tied outcome, and a 2-way Moneyline that forces a winner via overtime/shootout. No other sport here has this duality, and it turns out to be exploitable.

### 1.3 What the tool does

1. Computes Market Expected Goals (MEG) from multiple Over/Under goal-total lines — the same interpolation algorithm used for basketball's MET and tennis's MEG, applied to hockey's smaller goal-scale.
2. **Overtime Intelligence (new):** reads the 1X2 draw price directly as the market's implied P(this game reaches overtime/shootout), then cross-checks that figure against the separate Moneyline-incl-OT market using the real hockey-betting assumption that shootouts are close to a coinflip.
3. **Correct Score Reconciliation (new):** decodes the correct-score grid into four independently reconstructed facts — Odd/Even%, BTTS%, Team 1/Team 2 expected goals, and Shutout% — and cross-checks each against its own direct market when available.
4. Computes Team Goal Differential (TGD) — team-total-consistency logic reused from basketball/tennis, applied to goals.
5. Runs a Period 1 → Regulation scale check using a fixed ×3 multiplier (the most mathematically justified multiplier of any sport here, since NHL/IIHF periods are exactly 20 minutes each by rule).
6. Offers dropdown-with-freetype-fallback baseline selectors for every line field, applying the tennis screener's proven UX pattern from the start (per the "latest version" instruction) rather than retrofitting it.
7. Ranks handicap/result options (Profile C, including the puck line, 1X2, Moneyline-incl-OT, and Double Chance together) and every individual O/U line (Profile D) by implied probability.
8. Runs entirely offline; saves a session history log exportable to JSON/CSV, including a dedicated OT probability column.

---

## PART 2 — Domain Glossary

- **MEG (Market Expected Goals):** the goals-total figure the bookmaker's Over/Under lines collectively imply. Same 50%-crossover interpolation algorithm as basketball's MET / tennis's MEG, unit = goals.

- **1X2 (Regulation):** the three-way result market for the 60-minute regulation period — Win/Draw/Win. The draw outcome is real and final for this specific market's settlement purposes, even though the match itself continues to overtime/shootout to determine the standings winner.

- **Moneyline (incl. OT/SO):** the two-way market on who wins the match once overtime and shootout are included. No draw is possible here.

- **OT Probability (P(OT)):** the normalized implied probability of the draw outcome in the 1X2 market — directly the market's own estimate of P(this game reaches overtime/shootout).

- **OT Split Consistency Check:** a cross-market validation testing whether the Moneyline-incl-OT market is priced consistently with the regulation 1X2 market, under the assumption that OT/shootout outcomes are close to a coinflip. Compares an "expected" Moneyline split against the actual posted odds.

- **TGD (Team Goal Differential):** T1_MEG + T2_MEG compared against Game_MEG — hockey's version of basketball's Team Total Consistency / tennis's Player Game Differential.

- **Period Scale Check:** 1st Period MEG × 3 compared against Regulation MEG.

- **Correct Score Reconciliation:** decoding a correct-score grid (which decomposes into (home_goals, away_goals) pairs) into Odd/Even%, BTTS%, Team 1/Team 2 expected goals, and Shutout% — a structural superset of tennis's CSI.

- **Shutout Risk:** the market-implied probability at least one team fails to score (the "No" side of BTTS/GG-NG). Injected as a live 6th check into Profile A.

- **Empty-Net Goal:** a trailing team pulls its goaltender late in a decided game, raising the chance of the leading team scoring into an empty net — justification for treating a lopsided moneyline as an Over signal (see Part 3.4).

- **Puck Line:** hockey's conventional handicap market, traditionally ±1.5 goals, modeled here with a fuller range of lines using the same MEG-style interpolation.

- **League context:** a config preset nudging Profile A/B thresholds using the base+delta pattern from football v4.

---

## PART 3 — Strategic Model: Two Innovations Unique to Hockey

### 3.1 Overtime Intelligence — the headline innovation

**The core insight:** hockey's regulation 1X2 market prices in a draw as a genuine possible outcome, even though the match's overall winner is always eventually decided. This means the draw price in the 1X2 market answers exactly one question: what does the market think is the probability this game reaches overtime? No derivation needed beyond normalizing the three-way market.

**Why this matters:** no other sport in this family exposes this so cleanly. Football's draw can be a genuinely final result, so its draw price answers a different question. Basketball and tennis have no draw at all. Hockey's regulation-draw-but-forced-resolution structure is unique.

**The algorithm:**
```
normalize(W1, X, W2) → P(T1 reg win), P(OT), P(T2 reg win)
```

**Calibration anchor:** the NHL's actual historical rate of games reaching overtime/shootout sits at roughly 23–25% across recent seasons — a real, checkable number used directly as `HKY.OT_HIGH` (24%) and `HKY.OT_MOD` (18%), giving the panel's tier classification genuine external grounding rather than an arbitrary round figure.

### 3.2 The OT Split Consistency Check

Once P(OT) is known, a second cross-market test becomes possible if the bookmaker also offers a Moneyline-incl-OT market: does the Moneyline pricing behave the way you'd expect if overtime outcomes were close to a coinflip?

**The algorithm:**
```
Expected_ML1 = P(T1_reg_win) + P(OT)/2
Expected_ML2 = P(T2_reg_win) + P(OT)/2
Deviation = Actual_ML1_normalized − Expected_ML1
```

**Interpretation:**
- **< 3 points:** markets consistent with the coinflip-OT assumption
- **3–6 points:** worth a second look — could reflect a real shootout-skill differential
- **≥ 6 points:** significant. Either a genuine OT/shootout edge for one team, or the two markets were priced inconsistently. The tool flags this; distinguishing the two explanations is left to the user's judgment.

This mirrors tennis's dual-tiebreak-derivation pattern (two independent readings of a related fact, compared) but is grounded in a genuinely hockey-specific structural feature.

### 3.3 Correct Score Reconciliation — the second innovation

Hockey scorelines are pairs `(home_goals, away_goals)`. Unlike tennis or football's correct-score handling, this additive structure lets a correct-score grid yield **four separate reconstructed facts simultaneously**:

1. **Odd/Even%** — classify `(home+away)` parity per cell, sum normalized probability
2. **BTTS%** — sum normalized probability where both `home > 0` and `away > 0`
3. **Team 1 / Team 2 expected goals** — `Σ(normProb_i × home_i)` and `Σ(normProb_i × away_i)`, a *third* independent estimate of each team's scoring (beyond the Team Total O/U MEG)
4. **Shutout%** — sum normalized probability where `home = 0` or `away = 0`

Each is cross-checked against its own direct market when available: reconstructed Odd/Even% vs the direct market, reconstructed BTTS% vs GG/NG, reconstructed Team xG vs the Team Total-derived MEG.

**Why this matters practically:** filling in a handful of correct-score cells gives a second, independently-derived number for the same fact a direct market already prices. When the two disagree meaningfully, that's a genuine signal worth attention.

### 3.4 The Empty-Net Reversal — an intentional, justified break from the basketball/tennis pattern

Basketball and tennis both treat a dominant favourite as Under-supporting evidence (the strong side "closes out" the contest efficiently). **Hockey intentionally reverses this.** A large moneyline gap is coded as supporting **Over**, and a tight moneyline supports **Under** — the opposite mapping.

**The justification is structural:**
- **Empty-net goals:** once a game is clearly decided, the trailing team frequently pulls its goaltender late, materially raising the expected total independent of how the game got there.
- **A tight, closely-matched game** tends to be cautious and low-event specifically because neither team can afford a mistake protecting a slim margin — a genuine, recognized hockey pattern.

This reversal is documented explicitly rather than left as a silent inconsistency with the other sports' pattern, because getting this direction backwards would have been a real modeling error — hockey blowouts and basketball blowouts behave differently with respect to total scoring.

### 3.5 League Context Presets

Reusing the exact base+delta architecture from football v4 (`HKY_BASE` × `HKY_LEAGUE_DELTA`):

| Preset | Effect | Rationale |
|---|---|---|
| `balanced` | No change | Default calibration |
| `nhl` | Same as balanced | Standard ~6-combined-goal NHL baseline, the calibration anchor throughout |
| `highScoring` | Eases Over bar, raises Under bar | Weak goaltending matchup, back-to-back fatigue |
| `lowScoring` | Eases Under bar, raises Over bar | Elite goaltending matchup, defensive systems |
| `international` | Eases Under further, raises aggregate confidence bar | Bigger ice surface + larger talent gaps → lower totals, but more uncertainty (mirrors football's cup/knockout logic) |

---

## PART 4 — Cross-Market Consistency Framework (Reused Patterns)

### 4.1 Team Goal Differential (TGD)

```
combined = T1_MEG + T2_MEG
diff = combined − Game_MEG
```

| Diff | Signal |
|---|---|
| ≤ ±1.0 goals | Consistent |
| > +1.0 | overSum → Over |
| < -1.0 | underSum → Under |
| Magnitude ≥ 2.5 | "strong" |

Tighter tolerances than basketball (±1.0 goals vs ±3 points) because hockey's total-goals scale (typically 4–9) is far smaller than basketball's (typically 150–230).

### 4.2 Period 1 → Regulation Scale Check

```
projected = P1_MEG × 3
diff = projected − RT_MEG
```

**The most reliable scale check in the family:** hockey's three periods are exactly 20 minutes each, always — no equivalent structural variability to basketball's rotation-dependent quarters or tennis's variable-length sets. The ×3 multiplier is the closest thing to a "true" scale factor of any check across all four sports, though period-to-period pace can still vary due to game-state effects.

---

## PART 5 — Application Architecture

### 5.1 File structure

```
ice-hockey-matchday-screener-v1.html
  <datalists>  (3 shared baseline suggestion lists)
  <head><style>  ... ice-rink blue/coral theme ...
  <body>
    <div class="wrap">
      <header>
      <div class="tabbar">  [Regular Time | 1st Period]
      <section id="scope_rt">   ... RT fields, OT Intelligence panel, CS Reconciliation panel, profiles ...
      <section id="scope_p1">   ... P1 fields, CS Reconciliation panel, profiles ...
      <div class="history-card">
      <footer>
    <script>  ... all logic ...
```

### 5.2 Color theme — ice-rink blue/coral palette

```css
--bg:        #081418   (deep ice-rink navy-black)
--gold:      #3FC7E0   (ice blue — structural accent)
--over:      #F97362   (coral-red — Over direction)
--under:     #3FC7E0   (ice blue — Under direction, doubling as a "cold/defensive" visual metaphor)
```

The fourth distinct palette in the family (football green, basketball navy/orange, tennis clay/burgundy, hockey ice-blue/coral), preserving the semantic-color discipline: green/amber/red reserved exclusively for status, never decorative.

### 5.3 ID namespace and datalist wiring

`{scope}_{market}_{field}{index}`. Three shared datalists populated programmatically and wired via `list=` attributes at build time, not retrofitted:

| Datalist | Used by | Range |
|---|---|---|
| `dl-gt` | Game Total lines | 3.5–9.5 in 0.25 steps — fine-grained enough to suggest both standard and Asian quarter-lines |
| `dl-tt` | Team Total lines | 0.5–5.5 in 0.5 steps |
| `dl-hdp` | Puck Line / Period Handicap | -3.5–3.5 in 0.5 steps |

### 5.4 The OT Intelligence panel — implementation

```javascript
function hkOTIntelligence(w1, x, w2, ml1, ml2) {
  // normalize 1X2 three-way → pT1Reg, pOT, pT2Reg
  // if ml1/ml2 present: compute expected split under coinflip-OT
  //   assumption, compare against actual normalized ML split
}
```

Regular Time tab only — a tied 1st period simply continues into the 2nd period; it has no special resolution mechanism the way a tied Regulation Time does.

### 5.5 The CS Reconciliation panel — implementation

```javascript
function hkCSReconcile(scope, cellList, t1Meg, t2Meg) {
  // parse entered CS cells, normalize
  // classify odd/even, BTTS, shutout per cell (excluding "Other")
  // accumulate probability-weighted home/away goal sums
  // cross-check against t1Meg/t2Meg when provided
}
```

**Correct-score cell sets:**

| Scope | Cells |
|---|---|
| Regular Time (12) | 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1, 1-2, 2-2, 3-0, 0-3, Other |
| 1st Period (10) | 0-0, 1-0, 0-1, 1-1, 2-0, 0-2, 2-1, 1-2, 2-2, Other |

Follows the football screener's "core grid + Other catch-all" pattern rather than tennis's fully-exhaustive small set, since hockey's score space (like football's) is open-ended with a long tail.

### 5.6 The Shutout Risk injection — implementation

Mirrors tennis's tiebreak-injection pattern: computed after the main five-check `hkBuildProfileA` has already run and scored, appended as an extra DOM row. **Informational only — does not alter the 5-check tally**, keeping "N/5 checked" mechanically accurate. Identical design to tennis's tiebreak injection, documented here as intentional.

---

## PART 6 — Profile Reference

### 6.1 Profile A — Under

| # | Check | Source | Green signal |
|---|---|---|---|
| A1 | Value-zone Under line | gtMEG.valueZone.bestUnder | Normalized Under ≥ cfg.a1.green |
| A2 | Low-scoring correct-score cluster | csRes (total ≤3) | Combined % ≥ cfg.a2.green |
| A3 | Team Goal Differential | tgd | underSum ≥ TGD_STRONG |
| A4 | Period → Regulation scale (RT only) | scaleRes | Slow pace |
| A5 | Moneyline balance (defensive-game signal) | w1/w2 | Favourite ≤ cfg.a4.green (tight matchup) |
| +6 | 🏒 Shutout Risk (informational) | bttsY/bttsN | NG% ≥ 15% |

### 6.2 Profile B — Over

| # | Check | Source | Green signal |
|---|---|---|---|
| B1 | Value-zone Over line | gtMEG.valueZone.bestOver | Normalized Over ≥ cfg.b1.green |
| B2 | High-scoring correct-score cluster | csRes (total ≥6) | Combined % ≥ cfg.b2.green |
| B3 | Team Goal Differential | tgd | overSum ≥ TGD_STRONG |
| B4 | Period → Regulation scale (RT only) | scaleRes | Fast pace |
| B5 | Moneyline balance (empty-net risk signal) | w1/w2 | Favourite ≥ cfg.b4.green (lopsided — see Part 3.4) |

### 6.3 Profile C — Handicap & Result Ranking

Ranks: Puck Line handicap (all entered lines, both sides), 1X2 (3-way, regulation), Moneyline-incl-OT (2-way), Double Chance (raw implied).

### 6.4 Profile D — Best Specific Line Finder

Ranks every individual O/U option across Game Total, Team 1 Total, Team 2 Total by winning-direction probability.

### 6.5 Master Banner Priority Waterfall

Same structure as basketball/tennis, with an additional OT probability chip shown whenever 1X2 data is entered on the Regular Time tab.

---

## PART 7 — Validation Suite

### Static checks (all passed)
1. `node --check` — 0 syntax errors
2. Escape-sequence audit — 0 issues
3. Brace/paren balance — 229/229 braces, 739/739 parens
4. ID cross-reference — 0 missing
5. onclick function check — all 7 bound functions defined
6. Datalist wiring — 46 `list=` attributes correctly wired

### Integration test suite (13 tests, all passed)

| # | Test | Result |
|---|---|---|
| 1–2 | Both scopes run empty without error | PASS |
| 3 | MEG computed ≈6.0 from illustrative 4-line data | PASS |
| 4 | TGD correctly classifies consistent sum | PASS |
| 5 | Period scale: 2.0×3=6.0 vs RT MEG 6.0 → "consistent" | PASS |
| 6 | **OT Intelligence** computes P(OT)=22.5%, three-way sum ≈100% | PASS |
| 7 | **OT Split Consistency Check** computes 4.2-point deviation, "moderate" | PASS |
| 8 | **CS Reconciliation** decodes Odd/Even, BTTS, Team xG — hand-verified exact match | PASS |
| 9 | Full RT calc → "Under (A 83.3%)" — hand-verified exact match | PASS |
| 10 | saveScreening stores entry with OT probability column | PASS |
| 11 | Shutout Risk injects into Profile A DOM card | PASS |
| 12–13 | League presets shift thresholds correctly | PASS |

Tests 8 and 9 were hand-verified against independent manual arithmetic, not just checked for "did it run" — both matched exactly, giving high confidence in the two novel algorithms.

---

## PART 8 — Worked Scenarios (Illustrative Data, Math Hand-Verified)

### Scenario 1: Overtime Intelligence in action

**Illustrative 1X2:** W1=2.357, X=4.315, W2=2.667 → P(T1 reg)=41.2%, P(OT)=22.5%, P(T2 reg)=36.4%

22.5% sits just below the ~24% NHL historical average — classified "moderate," an ordinary overtime probability for this matchup.

**With Moneyline (ML1=1.65, ML2=2.15):** Expected ML1=52.4%, Actual=56.6%, Deviation=+4.2 points, "moderate — worth a second look." Team 1 is priced slightly stronger in the OT/shootout scenario than a pure coinflip assumption predicts — worth checking for a known shootout specialist before treating this as signal vs noise.

### Scenario 2: Correct Score Reconciliation catching a shutout signal

Using an illustrative 11-cell grid, the engine computed Shutout probability at 70.3% — this specific figure is an artifact of the test odds chosen to exercise the math across cell types, not a realistic hockey rate (real shutout rates typically run 8–12%). Included to demonstrate: when real data shows an elevated reading (18–20%, above the 15% `SHUTOUT_HIGH` threshold), the panel flags it clearly and the injected Profile A check fires green.

### Scenario 3: The Empty-Net Reversal in a lopsided matchup (illustrative)

Team 1 at 1.35 to win vs Team 2 at 3.40 (favProb ≈71.6%). Profile B check 5 fires green (≥66% threshold) via the empty-net justification. Profile A check 5 scores this same figure red (well above its 58% tight-matchup threshold) — correctly treating a lopsided matchup as working against the Under pattern. Both directions consistent with the single justified reversal from Part 3.4.

---

## PART 9 — How-To-Use Guide

### Setup
1. Download and open the file in any modern browser. Fully offline after download, fully responsive.
2. Choose **Regular Time** or **1st Period**.
3. Set the **League context** dropdown if applicable.

### Entering odds
4. Tap line-value inputs for a dropdown of standard baselines, or type any custom line.
5. Enter Game Total, Team 1 Total, Team 2 Total lines.
6. Enter Puck Line handicap odds.
7. Enter **1X2 (regulation)** — unlocks the Overtime Intelligence panel directly.
8. Enter **Moneyline incl. OT/SO** if available — unlocks the OT Split Consistency Check.
9. Enter Double Chance, BTTS, and Odd/Even odds.
10. Enter correct score odds for as many scorelines as available — unlocks cross-checks automatically.

### Reading the output
11. **Overtime Intelligence panel:** headline P(OT), plus the Split Consistency Check if Moneyline entered.
12. **Correct Score Reconciliation panel:** Odd/Even%, BTTS%, Team xG, Shutout%, Most Likely Score, plus automatic cross-checks.
13. **Master Banner:** now includes a dedicated OT% chip.
14. **Profile A card:** watch for the extra "🏒 Shutout Risk" row — informational, not counted in the score.

### Interpreting cross-checks
15. A "strong" OT deviation (≥6 points) or a flagged Odd/Even/BTTS discrepancy both mean two markets nominally describing the same fact are priced inconsistently — worth real scrutiny.

### Saving your work
16. "Save current tab" logs a screening including OT probability. Export to JSON/CSV before closing — the log is session-only.

---

## PART 10 — Known Limitations

1. **No real hockey odds were used to calibrate this build.** All thresholds were set from general hockey knowledge and the NHL's ~23–25% historical OT rate as the single external anchor — not from a backtested dataset or real screenshots. This is a more significant caveat than for the other three screeners in this family.

2. **The coinflip-OT assumption is a simplification.** Shootout outcomes aren't perfectly 50/50 in reality — specialists and exceptional goaltenders carry a real, if modest, edge. The check flags deviation without distinguishing "real skill edge" from "market inconsistency."

3. **The "Other" bucket in CS Reconciliation contributes no home/away split.** Low-coverage grids with a large "Other" price produce less reliable reconstructed statistics. A coverage note displays but there's no hard minimum-coverage gate (unlike football v4's `GRID_TRUST_THRESHOLD` pattern).

4. **Period Scale Check ignores game-state effects** (e.g., a team protecting a lead plays more conservatively in the 3rd period) — the fixed ×3 multiplier assumes uniform pace.

5. **No live odds feed; all entry is manual,** consistent with the family-wide offline-only constraint.

6. **The Empty-Net Reversal is directional, not magnitude-quantified.** It correctly identifies the direction of the effect but doesn't estimate how many additional expected goals a given moneyline gap implies.

---

## PART 11 — Roadmap

| Priority | Item | Complexity | Detail |
|---|---|---|---|
| High | Calibrate against real hockey odds | High | This build's biggest gap relative to the other three sports — needs real screenshots or historical data |
| High | Minimum-coverage gate for CS Reconciliation | Low | Add a `CS_TRUST_THRESHOLD` mirroring football v4's grid-trust pattern |
| Medium | Empty-net magnitude estimation | Medium | Quantify the expected additional-goals effect from a given moneyline gap, if historical data becomes available |
| Medium | 3rd-period-specific game-state modeling | Medium | Distinguish lead-protection pace effects from genuine team-strength pace |
| Low | Shootout-specialist adjustment | High | Requires external player/team shootout data the tool has no access to |
| Low | Extend OT Intelligence to a live in-play variant | Medium | Same panel logic mid-game once regulation is underway, if extended toward in-play use |

---

## PART 12 — Disclaimers

This tool is a decision-support screening aid. Market Expected Goals (MEG), the Overtime Intelligence panel, and the Correct Score Reconciliation panel are all derived mathematically from odds you enter — they reveal what the bookmaker's own pricing already implies, not what will actually happen on the ice.

**This build's thresholds were not calibrated against real hockey odds data**, unlike the football, basketball, and tennis screeners in this family. The NHL's ~23–25% historical overtime rate is a real, checkable anchor used specifically for the Overtime Intelligence panel; the remaining thresholds are reasoned estimates. Treat this build's recommendations with correspondingly higher caution until refined against real market data.

The OT Split Consistency Check's coinflip assumption is a simplification; the Empty-Net Reversal is a directional heuristic, not a precisely quantified effect. No combination of odds-reading produces guaranteed positive expected value against a bookmaker's margin. All staking decisions are the user's sole responsibility. Not financial advice. Fully offline — no data leaves this page, no browser storage APIs are used, and the Screening Log persists only for the current session unless exported.
