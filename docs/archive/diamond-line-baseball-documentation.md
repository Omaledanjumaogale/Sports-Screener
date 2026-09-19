# Diamond Line — Baseball Enterprise Multi-Market Screener — Documentation v1

**File this document describes:** `diamond-line-baseball-screener.html`
**Sibling project:** this tool follows the same architecture and documentation conventions as `rally-line-tt-totals-screener.html` (table tennis) — config-driven market definitions, dropdown-plus-custom baseline entry, per-market normalized probability and margin, a Match Shape Intelligence layer, and a Final Verdict panel. Where this document says "as in the table tennis tool," it means the underlying mechanism is identical; only the sport-specific markets and cross-checks differ.
**Type:** single-file, offline-capable HTML/CSS/JS application, config-driven
**Purpose:** screen pre-match baseball odds across Regular Time, 1st-5-Innings, and 1st-Inning tabs; score each market's own best selection with a normalized probability, bookmaker-margin, and market-fair-EV read; cross-check baseball-specific correlated markets against each other; and roll everything into one Final Verdict

---

## PART 1 — Executive Summary

Baseball has a structural feature no other sport in this project so far has had: **a game can end in a tie at its natural endpoint (9 innings) and get extended**. Bookmakers price this in two distinct ways — a 3-way "Regulation" market (Home / Draw / Away, settled on the 9-inning score) and a 2-way "true" moneyline (Home / Away, settled on the actual final result including any extra innings). That single structural fact is the seed of this tool's central unique feature: **the Regulation market's own Draw price is a direct, market-derived estimate of how likely the game is to need extra innings** — a number most bettors never explicitly extract, even though it's sitting in plain sight inside a 3-way price they may not even be betting. Part 4 builds this into a full cross-check.

The same honesty commitment carried over from the table tennis build applies here without exception: every probability shown is the bookmaker's own price with margin removed, not an independent forecast. What this tool adds beyond organizing odds is three genuine, sport-specific consistency checks (Part 4) that flag when a bookmaker's own correlated markets disagree with each other — the most legitimate signal an odds-only tool can produce.

---

## PART 2 — Market Inventory

Baseball odds pages are organized by **time window** (Regular Time / 1-5 Innings / 1st Inning) rather than by set or game the way table tennis was — the tool's three top-level sections mirror that.

| # | Market | Window | Kind | Priority |
|---|---|---|---|---|
| 1 | Regulation Result (1X2) | Regular Time | 3-way | **Primary** |
| 2 | Winner (Incl. Extra Innings) | Regular Time | Winner | **Primary** |
| 3 | Full Game — Total Runs | Regular Time | O/U, 3 tiers | **Primary** |
| 4 | Full Game — Home Team Total Runs | Regular Time | O/U, 3 tiers | **Primary** |
| 5 | Full Game — Away Team Total Runs | Regular Time | O/U, 3 tiers | **Primary** |
| 6 | Full Game — Run Line (Handicap) | Regular Time | Handicap, 3 tiers | Context |
| 7 | Full Game — Total Runs Odd/Even | Regular Time | Yes/No | Context |
| 8 | Full Game — Winning Margin | Regular Time | 6-way | Context |
| 9 | Full Game — Total Hits | Regular Time | O/U, 2 tiers | Context |
| 10 | Will There Be An Extra Inning | Regular Time | Yes/No | Context |
| 11 | Most Runs In A Single Inning | Regular Time | 3-way | Context |
| 12 | Race To N Runs (3/5/7) | Regular Time | 3×Home/Away | Context |
| 13 | 1-5 Innings — Result (1X2) | 1st 5 Innings | 3-way | **Primary** |
| 14 | 1-5 Innings — Total Runs | 1st 5 Innings | O/U, 3 tiers | **Primary** |
| 15 | 1-5 Innings — Home Team Total Runs | 1st 5 Innings | O/U, 2 tiers | Context |
| 16 | 1-5 Innings — Away Team Total Runs | 1st 5 Innings | O/U, 2 tiers | Context |
| 17 | 1-5 Innings — Handicap | 1st 5 Innings | Handicap, 2 tiers | Context |
| 18 | 1st Inning — Total Runs | 1st Inning | O/U, 2 tiers | **Primary** |
| 19 | 1st Inning — Home Team Total Runs | 1st Inning | O/U, 1 tier | Context |
| 20 | 1st Inning — Away Team Total Runs | 1st Inning | O/U, 1 tier | Context |
| 21 | 1st Inning — Handicap | 1st Inning | Handicap, 2 tiers | Context |

**Priority vs. Context**, same principle as the table tennis tool: the eight rows tagged Primary are the standard, most heavily-traded baseball markets — moneyline/result, game total, team totals, and their 1-5-innings equivalents — and are the only candidates eligible for the Final Verdict's headline pick. The thirteen Context markets still screen themselves fully and feed the Match Shape Intelligence panel, but don't become the headline recommendation on their own.

**Deliberately excluded / simplified:**
- **"Result + Total" combo markets** (e.g. "W1 and Total Over 9.5 — Yes/No") and **"Winner & Total" combos** — same reasoning as the table tennis tool's excluded "Set/Match" and "Result + Total" markets: these are correlated parlay-style prices whose fair value depends on the joint distribution of two markets this tool already prices separately. Accepting their raw odds without modeling that correlation would look precise without being grounded in anything this tool calculates.
- **"To Win By" (exact-margin) markets were consolidated into a simpler 6-outcome "Winning Margin" field** (Home/Away × by 1 / by 2 / by 3+) rather than the more granular ~10-outcome version some books offer (by exactly 1/2/3/4 runs, separately from 3-or-more). The 6-outcome version captures the same close-game-vs-blowout signal with far less data entry.
- **"First Inning / Match" combo and "Total (over-exact-under)" three-way total** were left out for the same correlated/duplicate-information reasons.

---

## PART 3 — Baseline Dropdown + Custom Line Design

Identical mechanism to the table tennis tool (see its documentation Part 3 for the full rationale): every Over/Under and Handicap market renders as one or more tier rows, each with a line dropdown pre-populated from the realistic range seen in the sample odds for that specific market, plus a **Custom…** option that reveals a free-entry field for any line the dropdown doesn't cover. Markets with three real price points in the sample data (Full Game Total, both Team Totals, 1-5 Innings Total) get three tier rows; markets with fewer realistic gradations (1st Inning markets, Race-To props) get one or two.

---

## PART 4 — The Baseball-Specific Model: Three Cross-Market Checks

This is the section that makes the tool genuinely specific to baseball rather than a relabeled copy of the table tennis build. All three checks live in the Match Shape Intelligence panel and update live as you fill in odds.

### 4.1 Extra-Innings Consistency Check

**The core insight:** the Regulation Result (1X2) market's Draw price, once de-vigged, *is* the market's own estimate of P(extra innings needed) — because a "Draw" in a 9-inning regulation-result market is, by definition, exactly the scenario where the score is tied at the end of 9 and the game moves on. Most bettors look at a 1X2 price for the Home/Away split and ignore the Draw number entirely; this tool extracts it on purpose.

When both the Regulation Result market **and** a direct "Will There Be An Extra Inning" market are filled in, the tool compares the two independently-derived probabilities. A gap under 8 percentage points is flagged as consistent; 8 or more is flagged as a divergence worth double-checking. The 8-point threshold (versus the table tennis tool's 15-point threshold for its sweep-probability check) is deliberately tighter, because extra-innings probability in baseball is typically a small number (historically roughly 8–10% of MLB games) — an 8-point gap on a base rate that small is proportionally a much bigger disagreement than an 8-point gap would be on a coin-flip-range probability.

### 4.2 Team Totals vs. Combined Total Consistency Check

**The technique:** rather than reading a single posted line at face value, the tool uses **every line you enter for a given market** to interpolate the exact point where that market's own Over probability crosses 50% — call this the market's "fair number." With two lines bracketing 50% (e.g. Over 8.5 at 54% and Over 9.5 at 46%), linear interpolation between them gives a more precise fair-number estimate than either single line alone; with only one line entered, the tool nudges that line up or down slightly based on which side of 50/50 its own Over price sits on. This is a standard, legitimate technique ("finding the market's true number from multiple posted lines") — it uses only information the bookmaker already published, just extracts more precision from it than a single line would give.

The tool applies this to the Home Team Total, Away Team Total, and the combined Full Game Total independently, then checks: **does (fair Home total) + (fair Away total) roughly equal the fair combined Total?** In principle, a combined total market and the sum of two team-total markets are pricing the same underlying quantity, so a well-calibrated book should show these numbers agreeing closely. A gap of a full run (1.0) or more is flagged. When they diverge, it doesn't tell you which one is "right" — but it tells you the book is pricing these two views of the same game slightly differently, which is exactly the kind of detail worth a second look before committing to either market.

### 4.3 First-5-Innings Pace Ratio Check

Using the same fair-number interpolation from 4.2, the tool computes the ratio of the fair 1-5 Innings Total to the fair Full Game Total. A typical, evenly-paced game should show this ratio somewhere in the neighborhood of 50–62% (starters worked through five-plus innings on average will have allowed a meaningfully large share, but not the majority, of the game's eventual scoring). The tool flags any ratio outside a 45–68% band as "unusual pace" — not necessarily wrong, but worth a look at what the book might be pricing in (a shaky bullpen, an unusually short-leash starter, a park factor, etc.) that would justify scoring being concentrated more heavily in the first five innings or the last four than typical.

**Honesty note on all three checks:** none of them tell you who will win or how many runs will be scored. They tell you whether the bookmaker's own correlated prices agree with each other. Agreement is mildly reassuring (the book is internally consistent); disagreement is a flag to look closer, not a signal to bet against the book — see Part 7.

---

## PART 5 — The Calculation Model (shared mechanics)

### 5.1 Normalization

Two-way markets (Over/Under, Home/Away, Yes/No) are de-vigged exactly as in the table tennis tool: `pA = (1/oddsA) / (1/oddsA + 1/oddsB) × 100`. The 3-way markets here (Regulation Result, Most Runs In A Single Inning) are genuinely three-outcome markets and are normalized across all three prices at once — `pX = (1/oddsX) / Σ(1/odds) × 100` — the correct approach for a market that isn't reducible to two paired sides, the same principle the table tennis tool applied to its six-outcome Correct Score market. The Winning Margin market (6 outcomes: Home/Away × by 1/2/3+) is normalized the same multi-way way, using however many of the six you've filled in — same "n/6 entered" completeness indicator as the table tennis tool's Correct Score field.

### 5.2 Bookmaker Margin

`margin% = (Σ 1/oddsᵢ − 1) × 100` across however many sides a given market has. Shown next to every market's top pick. As in the table tennis build, this is the one number in the tool representing a genuine, prediction-free form of value: among equally-likely candidates, the lower-margin one costs less to bet.

### 5.3 Market-Fair EV

`EV = (probability/100 × odds) − 1`, using a market's own normalized probability against its own raw price. Read Part 7 before treating this as anything beyond a margin-cost indicator — the mechanics and the honest caveats are identical to the table tennis tool's EV explanation.

---

## PART 6 — The Final Verdict

Same mechanism as the table tennis tool: the top pick from each of the eight Primary-tagged markets (Regulation Result, True Winner, Full Game Total, Home Team Total, Away Team Total, 1-5 Innings Result, 1-5 Innings Total, 1st Inning Total) becomes a candidate.

- **Safest Selection** = the single highest normalized-probability candidate across all eight.
- **Best Value Selection** = among candidates at 55%+ probability, the one with the least-negative EV (i.e., lowest margin) — directly answering "the baseline margin to bet."
- A ranked table of up to eight candidates shows how close the alternatives were.

---

## PART 7 — What EV and the Consistency Checks Actually Mean (read before staking anything)

**On EV:** identical caveat to the table tennis tool. A market-fair EV figure computed from a market's own de-vigged odds against its own raw price will always land at or near zero, because the probability and the price being checked come from the same source. The number closest to zero among your candidates is the cheapest (lowest-margin) bet available among your options — not a profit forecast.

**On the three consistency checks (Part 4):** these are the closest thing this tool has to genuine "value-finding," and it's worth being precise about their limits too. A divergence flag means two of the bookmaker's own markets are pricing the same underlying event differently from each other — it does **not** mean either price is "wrong," and it does not tell you which side of either market to bet. Bookmakers sometimes intentionally price correlated markets slightly differently to manage liability across their book, independent of what they actually believe is likely. Treat every flag as "worth a closer look before committing," never as a standing instruction to bet the divergence.

**No claim in this tool should be read as a promise it can consistently beat a bookmaker's margin.** That is not something achievable from odds alone — see the table tennis documentation's Part 8 for the fuller version of this argument, which applies here without modification.

---

## PART 8 — Auto-Save Behavior

Identical mechanism and identical caveat to the table tennis tool: every input is written to `localStorage` under the key `diamondLineBB_v1_state` and reloaded automatically on next open, in any standard browser where the file is opened directly (double-click, `file://`, or your own simple web server). It will not persist inside a sandboxed in-chat preview pane, for the same security reasons noted in the table tennis documentation's Part 7 — the app detects this gracefully and simply skips saving/loading without breaking anything else. Nothing is cleared automatically within a session; only the reset button clears it.

---

## PART 9 — Limitations

1. **The Extra-Innings, Team-Totals, and Pace-Ratio checks (Part 4) are all derived from the odds you enter, not from any independent baseball data** — no park factors, weather, starting pitcher handedness/form, bullpen usage patterns, or lineup information feed this tool anywhere.
2. **The fair-number interpolation (Part 4.2/4.3) is most accurate with two or three filled tiers that bracket the 50% point.** With only one tier entered, the tool applies a small directional nudge rather than a true interpolation — treat single-tier fair-number estimates as rougher than multi-tier ones.
3. **The 45–68% "typical pace" band and the 8-point "extra innings" threshold are human-calibrated, not statistically fitted** to a dataset of actual results — they're reasonable structural approximations, the same caveat the table tennis tool makes about its own thresholds.
4. **Winning Margin is a simplified 6-outcome consolidation** of what some books list as a more granular ~10-outcome exact-margin market (Limitation noted in Part 2).
5. **Combo/correlated markets are intentionally excluded** (Part 2) rather than approximated.
6. **No live odds feed, no player/pitcher statistics, no weather or park data.** Every read is price-only and manual, by design, consistent with the rest of this project's offline-first scope.

---

## PART 10 — How-To-Use Guide

1. Open `diamond-line-baseball-screener.html` in any modern browser — no internet connection needed after the first load.
2. Enter home/away team names (optional, cosmetic).
3. Work through **Regular Time** first — the five Priority markets (Regulation Result, True Winner, Full Game Total, both Team Totals) are expanded by default.
4. Move to **1st 5 Innings**, then **1st Inning** — same pattern, Priority markets expanded, Context markets one tap away.
5. For any Over/Under or Handicap market, pick a line from the dropdown (or "Custom…" and type your own), then enter both prices — repeat for as many tiers as your bookmaker offers, ideally filling at least two tiers on the Total and Team Total markets so the fair-number interpolation in Part 4.2/4.3 has something to interpolate between.
6. Watch each market's own result strip update directly beneath its inputs.
7. Check the **Match Shape Intelligence** panel for the extra-innings read, the team-totals-vs-combined check, the pace ratio, and any flags.
8. Scroll to the **Final Verdict** panel for the safest pick, the lowest-vig alternative, and the full ranked table.
9. Read the EV column as "margin cost," not "expected profit" — Part 7.
10. Use "Clear all fields & saved data" between games for a clean slate.

---

## PART 11 — Disclaimers (must remain in any distributed version)

This tool is a decision-support screening aid. It normalizes and cross-checks odds you provide; it does not access live data, does not possess an independent statistical model of either team, and does not guarantee any outcome, win rate, or profit. The EV figures reflect bookmaker margin embedded in the prices you entered, not a forecast. The Match Shape Intelligence flags point out when a bookmaker's own correlated markets disagree with each other — they are not instructions to bet either side of a divergence. No claim in this tool or its documentation should be read as a promise that it can consistently beat a bookmaker's margin; that is not something any odds-only tool can do. Users are solely responsible for their own staking decisions. If betting stops being enjoyable or feels out of control, free, confidential support is available in most regions through national gambling-help helplines.
