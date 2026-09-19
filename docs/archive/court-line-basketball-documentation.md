# Court Line — Instant Basketball Screener — Documentation v1

**File this document describes:** `court-line-basketball-screener.html`
**Sibling projects:** this tool follows the same core architecture as `rally-line-tt-totals-screener.html` (table tennis), `diamond-line-baseball-screener.html` (baseball), and `pulse-line-vfootball-screener.html` (virtual football) — config-driven market definitions, per-market normalized probability/margin/EV, a Match Shape Intelligence cross-check layer, and a Final Verdict panel. Like the virtual football tool, this one is deliberately **narrow in scope** rather than covering every market on the board — see Part 1.
**Type:** single-file, offline-capable HTML/CSS/JS application, config-driven
**Purpose:** screen pre-round SportyBet Instant Basketball odds for exactly four target selections, using a curated set of supporting markets purely as cross-checks

---

## PART 1 — Executive Summary: Four Markets, By Design

Following the same brief structure as the virtual football tool, this project names exactly four markets as the only things this tool should ever recommend: **Match Total Points Over/Under, Match Handicap, Home Team Total Points Over/Under, and Away Team Total Points Over/Under** — all "incl. overtime," since that is how Instant Basketball's headline lines are actually settled on the SportyBet board. Every other market on the Instant Basketball tabs (Winner, 1X2, quarter-level markets, the Winner-&-Total combo) is either left out entirely or included only as a supporting cross-check, never as something this tool recommends on its own. Part 2 lays out exactly what made the cut.

**What's structurally different about basketball versus the other three sports in this project, and why it matters for the model:** Instant Basketball point totals vary enormously from one simulated matchup to the next — the sample data behind this tool included one fixture pricing its match total around 177–192 points and another pricing it around 216–228, a swing of roughly 40 points between two "instant" games. Unlike virtual football's goals (where 1.5 and 2.5 are universal, sport-wide thresholds) or baseball's runs (where the realistic range is fairly narrow), basketball has no single fixed number that works as a threshold across matches. That's why, unlike the virtual football tool's fixed-line target markets, all four of this tool's target markets are **tiered** — you pick from a dropdown (with a custom-entry fallback) for each of up to three price points per market, the same mechanism used in the table tennis and baseball tools, because the line itself is a real per-match choice here, not a constant.

**The honesty commitment is identical to the other three tools:** every probability is a bookmaker price with margin removed, not an independent forecast, and — as with virtual football — Instant Basketball's odds are set directly by the operator's own simulation engine, so there's no public-betting-perception inefficiency to hunt for underneath the engine's own numbers. What this tool adds is organization, margin transparency, and basketball-specific cross-market consistency checking (Part 4).

---

## PART 2 — Market Inventory: What Made the Cut and Why

### The four target markets (Primary — the only verdict candidates)

| Market | Why it's one of the four |
|---|---|
| Match Total Points — Over/Under (incl. overtime) | Named directly in the brief ("Over/under total points") |
| Match Handicap (incl. overtime) | Named directly in the brief ("Match handicap") |
| Home Team Total Points — Over/Under (incl. OT) | Named directly in the brief ("team A... over or under total point") |
| Away Team Total Points — Over/Under (incl. OT) | Named directly in the brief ("team B... over or under total point") |

Each of the four renders as up to three tier rows (line dropdown + custom option, Over/Under or Home/Away odds), reflecting how the sample SportyBet board actually lists these markets — five to fifteen-plus lines per market, far more spread than any fixed single line could capture.

### The seven supporting markets (Context — feed cross-checks, never the verdict)

| Market | What it's for |
|---|---|
| Regulation Result (1X2) | Feeds the overtime cross-check — see Part 4.1 |
| Winner (Incl. Overtime) | The direct comparison point for the same check |
| 1st Quarter — Total Points O/U | Feeds the quarter-pace extrapolation check — Part 4.3 |
| 1st Quarter — Home / Away Team O/U | Same purpose, per team; also usable on its own as an early read |
| 1st Quarter — Handicap | Shown as plain early-game context |
| 1st Half — Total Points O/U | A second, coarser pace check alongside the quarter-level one |

**What was deliberately left out entirely, and why:** the 1st-Quarter 1X2 market and the Winner-&-Total combo market. The Quarter 1X2 duplicates, at finer grain, information the Regulation Result 1X2 already provides for this tool's purposes — a quarter can technically "draw," but that fact isn't wired into any of the four target markets the way the full-game regulation draw is (Part 4.1), so adding it would be data entry without a corresponding calculation. The Winner-&-Total combo is a correlated parlay-style market (same reasoning the earlier three tools give for excluding their own combo markets) — its fair price depends on the joint distribution of the Winner and Total markets already collected separately, and accepting its raw odds without modeling that correlation would look precise without being grounded in any calculation this tool performs.

---

## PART 3 — The Basketball-Specific Model: Three Cross-Market Checks

### 3.1 Overtime Consistency Check (this sport's version of the baseball tool's extra-innings check)

Instant Basketball prices a **Regulation Result (1X2)** market — Home, Draw, Away — where "Draw" means the score is level at the end of regulation and the game needs overtime to be settled, exactly the same structural idea as baseball's tied-after-nine-innings Draw price. Separately, the board prices a **Winner (incl. overtime)** market, a true two-way moneyline covering the actual final result.

The check: assuming overtime is, to a first approximation, a roughly fair coin-flip between the two teams (a simplification — see Part 6), the Regulation Result market's own numbers should predict the Winner-incl-OT market's numbers: `expected final Home-win% ≈ Home-win% (regulation) + 0.5 × Draw%`. The tool computes this directly and compares it against the Winner-incl-OT market's own priced Home-win%, flagging anything more than an 8-point gap. This mirrors the baseball tool's 8-point threshold and the same reasoning behind it: overtime, like extra innings, is typically a smaller-probability event, so an 8-point gap on a number that's often in the 5–15% range is proportionally a bigger disagreement than the same gap would be on a coin-flip-range figure.

### 3.2 Team Totals vs. Match Total (the "fair number" technique, carried over unchanged)

Exactly the interpolation technique documented in the baseball and virtual football tools: using every line entered for the Home Team Total, Away Team Total, and the combined Match Total, the tool finds the precise point where each market's own Over probability crosses 50%, using linear interpolation between whichever two entered lines bracket that point. In principle, (fair Home total) + (fair Away total) should closely track the fair combined Match Total, since they're pricing the same underlying quantity two different ways. Given basketball's larger point totals, the tool uses a wider absolute threshold than baseball's 1.0-run gap — a 2.0-point gap here is roughly proportionate, flagged the same way.

### 3.3 Quarter-Pace Extrapolation

The fair number from the 1st Quarter Total market, multiplied by four, is compared against the fair number from the full Match Total. A typical, evenly-paced game should land this projection within roughly 10% of the direct match-total line — outside that band is flagged as "unusual pace," worth a second look at whether the market is pricing in a pace change as the game progresses (bench units, foul trouble, blowout garbage-time, or simply a stronger/weaker starting five than the team's overall depth). As with the equivalent baseball check, this doesn't tell you which number is "right" — only that the board's own quarter-level and full-game pricing aren't extrapolating cleanly into each other.

**The same honesty caveat as the other tools' checks, restated:** none of these three checks predict the outcome of the match. They test whether the bookmaker's own correlated markets — all ultimately generated by the same simulation engine — agree with each other. Agreement is mildly reassuring; a flagged divergence means "look closer before committing," never "bet against the book."

---

## PART 4 — The Calculation Model (shared mechanics)

Identical mechanics to the other three tools in this project:

- **Normalization**: `pA = (1/oddsA) / (1/oddsA + 1/oddsB) × 100` for every two-way market; the Regulation Result 1X2 is normalized three ways using the generalized version of the same formula.
- **Margin**: `margin% = (Σ 1/oddsᵢ − 1) × 100`, shown next to every market's top pick — the one number in the tool representing genuine, prediction-free value.
- **Market-Fair EV**: `EV = (probability/100 × odds) − 1`, using a market's own normalized probability against its own raw price. See Part 6 before treating this as a profit forecast.

---

## PART 5 — The Final Verdict

Same mechanism as the other three tools, scaled to four candidates: the top pick from each of the four Primary target markets (each already the best of its own up-to-three entered tiers) becomes a verdict candidate.

- **Safest Selection** = the single highest normalized-probability candidate across all four.
- **Best Value Selection** = among candidates at 55%+ probability, the one with the least-negative EV (lowest margin).
- A ranked table of all four candidates shows exactly how close the alternatives were.

---

## PART 6 — What EV and the Consistency Checks Actually Mean (read before staking anything)

Identical caveat to the other three tools, restated for this context: a market-fair EV figure computed from a market's own de-vigged odds against its own raw price will always land at or near zero — it is a margin-cost indicator, not a forecast. The three Match Shape Intelligence checks (Part 3) are ways of testing whether this simulation engine's own board agrees with itself, not ways of predicting a randomly-generated game's outcome. The overtime check (3.1) carries an extra layer of approximation worth restating plainly: it assumes overtime is close to a fair coin-flip between the two teams, which is a simplifying assumption, not a guaranteed truth — a team that's a heavy favourite in regulation may well remain favoured in overtime too, which would make the direct Winner-incl-OT market's higher favourite-skew the more accurate of the two readings rather than a sign of mispricing. Treat every flag from every check as "worth a second look," never as an instruction to bet a particular side.

---

## PART 7 — Auto-Save Behavior

Identical mechanism to the other three tools: every input is written to `localStorage` under the key `courtLineBB_v1_state` and reloaded automatically the next time the file is opened directly in a standard browser (double-click, `file://`, or your own simple web server). It will not persist inside a sandboxed in-chat preview pane for the same security reasons noted in the earlier tools' documentation — the app detects this gracefully and simply skips saving/loading without breaking anything else. Nothing is cleared automatically within a session; only the reset button clears it.

---

## PART 8 — Limitations

1. **This tool answers exactly four questions and no others, by design.** If you want a read on the moneyline, Regulation 1X2, or any quarter-level market on its own, this is not the tool for it — Part 1 and Part 2 explain why that's intentional.
2. **The preset dropdown ranges are wide by necessity** (Part 1) — basketball's per-match total-points range can swing by 40+ points between fixtures, so the dropdowns span a broad band with a Custom option as the fallback for anything outside it. Expect to use Custom more often here than in the other three tools in this project.
3. **The overtime consistency check's fair-coin-flip assumption (Part 3.1) is a simplification**, explicitly caveated in Part 6 — a skewed OT expectation for a strong favourite is a legitimate reason for the two markets to disagree, not necessarily a mispricing.
4. **The 1st-Half Total market's preset line range is an estimate**, not drawn from a directly observed sample the way every other preset range in this tool is — the source screenshots showed this market's header but not its specific lines. Use Custom freely here.
5. **No independent probability source exists anywhere in this tool.** Every number is derived from odds you typed in from the same simulation engine's own board.
6. **No live odds feed, no round history, no simulation-engine internals.** Every read is price-only and manual, by design, consistent with the rest of this project's offline-first scope.

---

## PART 9 — How-To-Use Guide

1. Open `court-line-basketball-screener.html` in any modern browser — no internet connection needed after the first load.
2. Enter home/away team names (optional, cosmetic).
3. Fill in the four **Target Markets** first — for each, add as many of the (up to three) tier rows as your bookmaker screen offers; this alone is enough to get a Final Verdict.
4. If you have time before the round starts, open the **Supporting Markets** section and add the Regulation Result, Winner, and quarter-level markets your screen shows — the overtime check needs both Regulation Result and Winner filled in to activate.
5. Check the **Match Shape Intelligence** panel for the overtime read, the pace projection, and any consistency flags.
6. Scroll to the **Final Verdict** panel for the safest pick, the lowest-vig alternative among the four, and the full ranked table.
7. Read the EV column as "margin cost," not "expected profit" — Part 6.
8. Use "Clear all fields & saved data" between rounds — Instant Basketball moves fast, so a clean slate matters.

---

## PART 10 — Disclaimers (must remain in any distributed version)

This tool is a decision-support screening aid limited by design to four specific Instant Basketball markets. It normalizes and cross-checks odds you provide; it does not access the simulation engine's internals, does not possess an independent statistical model of either team, and does not guarantee any outcome, win rate, or profit. The EV figures reflect bookmaker margin embedded in the prices you entered, not a forecast. The Match Shape Intelligence flags point out when a bookmaker's own correlated markets disagree with each other — they are not instructions to bet either side of a divergence, and Instant Basketball odds in particular are set directly by the operator's simulation engine with no independent public-perception layer to find an edge in. No claim in this tool or its documentation should be read as a promise that it can consistently beat a bookmaker's margin; that is not something any odds-only tool can do. Users are solely responsible for their own staking decisions. If betting stops being enjoyable or feels out of control, free, confidential support is available in most regions through national gambling-help helplines.
