# Flash Line — Instant Football Screener — Documentation v1

**File this document describes:** `flash-line-instantfootball-screener.html`
**Sibling projects:** this tool follows the same core architecture as `rally-line-tt-totals-screener.html` (table tennis), `diamond-line-baseball-screener.html` (baseball), `pulse-line-vfootball-screener.html` (virtual football), and `court-line-basketball-screener.html` (instant basketball) — config-driven market definitions, per-market normalized probability/margin/EV, a Match Shape Intelligence cross-check layer, and a Final Verdict panel. Like the virtual football and instant basketball tools, this one is deliberately **narrow in scope**, built around a fixed list of named target markets rather than covering everything the board offers — see Part 1.
**Type:** single-file, offline-capable HTML/CSS/JS application, config-driven
**Purpose:** screen pre-round SportyBet Instant Football odds for exactly five target selections, using a curated set of supporting markets — including one exceptionally well-suited direct cross-check market — purely as consistency checks

---

## PART 1 — Executive Summary: Five Markets, and a Cross-Check the Other Tools Didn't Have

Following the same brief structure as the virtual football and instant basketball tools, this project names exactly five markets as the only things this tool should ever recommend: **Match Over 0.5, Match Over 1.5, Home Team Over 0.5, Away Team Over 0.5, and BTTS.** These thresholds are deliberately lower than the virtual football tool's Over 1.5 / Over 2.5 — the source SportyBet Instant Football board prices goal totals in the same realistic range as real-world football (its Over/Under ladder tops out around 5.5, versus the earlier virtual football product's ladder that ran past 9.5), so 0.5 and 1.5 are the two thresholds that actually matter for this product's scoring distribution.

**What makes this tool's cross-check layer genuinely stronger than its two closest siblings:** the Instant Football board includes a market neither the virtual football nor the instant basketball source data had — **Teams To Score**, a clean four-outcome market (Neither / Only Home / Only Away / Both) that already buckets the exact quantities four of this tool's five targets need. Where the virtual football tool had to build its Correct-Score-derived cross-check as its main triangulation tool, this tool gets a second, independent, and structurally cleaner read almost for free — Part 3 explains why that matters and how the two are combined.

**The honesty commitment is identical to the other four tools in this project:** every probability is a bookmaker price with margin removed, not an independent forecast, and — as with virtual football and instant basketball — Instant Football's odds are set directly by the operator's own simulation engine, so there's no public-betting-perception inefficiency to hunt for underneath the engine's own numbers.

---

## PART 2 — Market Inventory: What Made the Cut and Why

### The five target markets (Primary — the only verdict candidates)

| Market | Why it's one of the five |
|---|---|
| Match Goals — Over/Under 0.5 | Named directly in the brief |
| Match Goals — Over/Under 1.5 | Named directly in the brief |
| Home Team Goals — Over/Under 0.5 | Named directly in the brief ("team A... over 0.5 goal or under") |
| Away Team Goals — Over/Under 0.5 | Named directly in the brief ("team B... over 0.5 goal or under") |
| Both Teams To Score (GG/NG) | Named directly in the brief |

### The six supporting markets (Context — feed cross-checks, never the verdict)

| Market | What it's for |
|---|---|
| Teams To Score (4-way) | The tool's strongest cross-check — see Part 3 |
| Correct Score Grid (16 scorelines + "Other") | A second, independent cross-check covering all five targets, including Over 1.5 which Teams To Score can't reach |
| Match Goals — Extra Lines (2.5, 3.5, 4.5, 5.5) | Lets the tool fit a fuller goals curve around the two target lines — Part 4.2 |
| Home / Away Team Goals — Extra Lines (1.5, 2.5, 3.5) | Same purpose, per team |
| 1st Half — Total Goals O/U | Feeds the pace-share check — Part 4.3 |
| Match Result (1X2) | Shown as plain context — which side is favoured and by how much |

**What was deliberately left out entirely, and why:** this board offers considerably more markets than either virtual football or instant basketball did — Handicap (3-way, scoreline-based), Double Chance, First Goal, Last Goal, Goal Bounds (four variants), 1X2-1UP/2UP, Incorrect Score, and the full set of 1st-Half/2nd-Half sub-markets beyond the 1st-Half total. None of these are wired into the five targets:

- **Handicap, Double Chance, First Goal, Last Goal, 1X2-1UP/2UP, Incorrect Score** — none of these bear directly on any of the five thresholded goal/BTTS questions this tool answers, the same reasoning the earlier two tools give for excluding their own non-essential markets.
- **Goal Bounds** (all four variants: full match, 1st half, home, away) is excluded for a structural reason distinct from the others: it's a **single-sided market** — one price per selected range, with no opposing side quoted. Every calculation in this tool (and its three sibling tools) depends on de-vigging a market by comparing two or more sides against each other; a market that only ever shows one price for a given selection can't be normalized this way, so it's structurally incompatible with how this tool works, not merely a scope decision.
- **2nd-Half 1X2 / 2nd-Half O/U** — left out because the 1st-Half total already provides the pace-check input this tool needs (Part 4.3); a full-match total minus a 1st-half total would approximate the 2nd half anyway, so adding it as a separate direct input wouldn't add new information.

---

## PART 3 — The Two-Market Triangulation: This Tool's Central Innovation

Where the virtual football tool could only compare each target's direct market price against a single Correct-Score-derived estimate, this tool has **two independent supporting reads** for four of its five targets, plus the direct market price itself — a genuine three-way triangulation, laid out as its own table in the Match Shape Intelligence panel rather than buried in prose flags.

**Why Teams To Score is the stronger of the two supporting markets:** Correct Score requires you to fill in a meaningful chunk of sixteen-plus individual scoreline prices before its derived estimates are trustworthy, and even fully filled, its Home/Away/BTTS figures can be undercut by the "Other" bucket (Part 3.1 of the virtual football documentation explains this limitation in full; it applies identically here). Teams To Score sidesteps both problems — it's exactly four prices, it's exhaustive by construction (Neither + Only Home + Only Away + Both is every possible scoring outcome for the two teams, with no "Other" catch-all needed), and its four buckets map onto this tool's targets almost perfectly:

- `P(Match Over 0.5) = 1 − P(Neither scores)`
- `P(Home Over 0.5) = P(Only Home) + P(Both)`
- `P(Away Over 0.5) = P(Only Away) + P(Both)`
- `P(BTTS — Yes) = P(Both)`

The one target it can't reach is **Match Over 1.5** — knowing that both teams scored doesn't tell you whether the combined total was 2 or 5 — so Over 1.5's only supporting read comes from the Correct Score grid, same as in the virtual football tool.

**The triangulation table** shown in the Match Shape Intelligence panel lists all five targets with three columns — Direct market, Teams-To-Score-derived, Correct-Score-derived — plus the largest gap between whichever of the three are filled in, flagged green under a 10-point gap and red at or above it. This is a genuinely richer read than either sibling tool offers on its own: three independently-priced (or independently-derived) views of the same question agreeing with each other is a stronger consistency signal than two, and disagreement among three narrows down which specific reading looks like the outlier more easily than a single pairwise comparison can.

---

## PART 4 — The Match Shape Intelligence Checks

### 4.1 The Triangulation Table (Part 3)

Covered in full above — the headline feature of this tool's intelligence layer.

### 4.2 BTTS Independence Check (carried over from virtual football, unchanged)

Compares the direct GG/NG price against `P(Home scores) × P(Away scores)`, treating each team's scoring as statistically independent — a simplification, flagged as such, but a useful sanity-check anchor that needs only the two team Over-0.5 markets to compute, no Correct Score or Teams To Score data required.

### 4.3 First-Half Pace Share

The fair number from the 1st Half Total Goals market (Part 4.2's "fair number" interpolation technique, applied here exactly as in the other three tools), divided by the fair number from the full match goals curve. Unlike the baseball and instant basketball tools' pace checks — which had either an established typical band (baseball) or a natural quarters-based multiplier (basketball) — this check uses a judged typical band of roughly 35–55% for a football match's first-half scoring share, wide enough to allow for the normal variation in how goals distribute across two halves without being so wide it never flags anything.

**The same honesty caveat as every other check in this project, restated once more:** none of these checks predict the outcome of the match. They test whether the bookmaker's own correlated markets — all generated by the same simulation engine — agree with each other. Agreement is mildly reassuring; a flagged divergence means "look closer before committing," never "bet against the book."

---

## PART 5 — The Calculation Model (shared mechanics)

Identical mechanics to the other three tools in this project:

- **Normalization**: `pA = (1/oddsA) / (1/oddsA + 1/oddsB) × 100` for every two-way market; Teams To Score and the Correct Score grid use the generalized multi-way version (`pX = (1/oddsX) / Σ(1/odds)`), the same approach the baseball tool applies to its Winning Margin market and the virtual football tool applies to its own Correct Score grid.
- **Margin**: `margin% = (Σ 1/oddsᵢ − 1) × 100`, shown next to every market's top pick.
- **Market-Fair EV**: `EV = (probability/100 × odds) − 1`, using a market's own normalized probability against its own raw price. See Part 7 before treating this as a profit forecast.

---

## PART 6 — The Final Verdict

Same mechanism as the other three tools: the top pick from each of the five Primary target markets becomes a verdict candidate.

- **Safest Selection** = the single highest normalized-probability candidate across all five.
- **Best Value Selection** = among candidates at 55%+ probability, the one with the least-negative EV (lowest margin).
- A ranked table of all five candidates shows exactly how close the alternatives were.

---

## PART 7 — What EV and the Consistency Checks Actually Mean (read before staking anything)

Identical caveat to the other three tools, restated for this context: a market-fair EV figure computed from a market's own de-vigged odds against its own raw price will always land at or near zero — it is a margin-cost indicator, not a forecast. The triangulation table and the two supplementary checks (Part 4) are ways of testing whether this simulation engine's own board agrees with itself across several differently-shaped markets pricing the same underlying events — not ways of predicting a randomly-generated match's outcome. A green row across all three columns in the triangulation table is a stronger consistency signal than any single one of this project's other cross-checks can offer on its own, but "consistent" still only means "the book agrees with itself," never "this is a guaranteed winner."

---

## PART 8 — Auto-Save Behavior

Identical mechanism to the other three tools: every input is written to `localStorage` under the key `flashLineIF_v1_state` and reloaded automatically the next time the file is opened directly in a standard browser (double-click, `file://`, or your own simple web server). It will not persist inside a sandboxed in-chat preview pane for the same security reasons noted in the earlier tools' documentation — the app detects this gracefully and simply skips saving/loading without breaking anything else. Nothing is cleared automatically within a session; only the reset button clears it.

---

## PART 9 — Limitations

1. **This tool answers exactly five questions and no others, by design** — Part 1 and Part 2 explain why that's intentional rather than an oversight, and why several markets on this particular board (Goal Bounds especially) couldn't be included even if the scope were widened, for structural reasons.
2. **Teams To Score cannot inform the Over 1.5 target** (Part 3) — that target's only supporting read is the Correct Score grid, which carries the same partial-coverage caveat documented in the virtual football tool (accuracy improves with more scorelines filled in, and the "Other" bucket is excluded from the Home/Away/BTTS sums but included in the Over-threshold sums).
3. **The BTTS independence check (4.2) assumes each team's scoring is statistically independent of the other's**, a simplification — treat it as a sanity-check anchor, not a superior estimate to the market's own direct GG/NG price.
4. **The 1st-half pace band (35–55%) is a judged range, not a statistically fitted one**, the same caveat the other three tools make about their own thresholds.
5. **No independent probability source exists anywhere in this tool.** Every number — including both supporting cross-checks — is derived from odds you typed in from the same simulation engine's own board.
6. **No live odds feed, no round history, no simulation-engine internals.** Every read is price-only and manual, by design, consistent with the rest of this project's offline-first scope.

---

## PART 10 — How-To-Use Guide

1. Open `flash-line-instantfootball-screener.html` in any modern browser — no internet connection needed after the first load.
2. Enter home/away team names (optional, cosmetic).
3. Fill in the five **Target Markets** first — this alone is enough to get a Final Verdict.
4. If you have time before the round starts, fill in **Teams To Score** first among the supporting markets — it's four fields for a read that covers four of your five targets at once, the best value-per-field entry in the whole tool. Add the Correct Score grid next if you want Over 1.5 covered too.
5. Check the **Match Shape Intelligence** panel's triangulation table for a side-by-side read across all three sources, and the flags below it for the BTTS and pace checks.
6. Scroll to the **Final Verdict** panel for the safest pick, the lowest-vig alternative among the five, and the full ranked table.
7. Read the EV column as "margin cost," not "expected profit" — Part 7.
8. Use "Clear all fields & saved data" between rounds — Instant Football moves fast, so a clean slate matters.

---

## PART 11 — Disclaimers (must remain in any distributed version)

This tool is a decision-support screening aid limited by design to five specific Instant Football markets. It normalizes and cross-checks odds you provide; it does not access the simulation engine's internals, does not possess an independent statistical model of either team, and does not guarantee any outcome, win rate, or profit. The EV figures reflect bookmaker margin embedded in the prices you entered, not a forecast. The Match Shape Intelligence flags and triangulation table point out when a bookmaker's own correlated markets agree or disagree with each other — they are not instructions to bet any particular side, and Instant Football odds in particular are set directly by the operator's simulation engine with no independent public-perception layer to find an edge in. No claim in this tool or its documentation should be read as a promise that it can consistently beat a bookmaker's margin; that is not something any odds-only tool can do. Users are solely responsible for their own staking decisions. If betting stops being enjoyable or feels out of control, free, confidential support is available in most regions through national gambling-help helplines.
