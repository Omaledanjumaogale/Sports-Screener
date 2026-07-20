# Rally Line — TT Enterprise Multi-Market Screener — Documentation v2

**File this document describes:** `rally-line-tt-totals-screener.html` (Enterprise v3, multi-market)
**Supersedes:** `rally-line-screener-documentation.md` (v1, two-profile totals-only edition). This document is self-contained — you don't need the v1 doc to use or maintain this version, though Part 9 tracks what changed and why.
**Type:** single-file, offline-capable HTML/CSS/JS application, config-driven
**Purpose:** screen pre-match table tennis odds across every commonly-offered market (Full Match and 1st Set tabs), score each market's own best selection with a normalized probability and bookmaker-margin read, and roll everything up into one Final Verdict

---

## PART 1 — Executive Summary

v1 answered two fixed questions (best Game 1 total-points line; safest full-match Under line). This version generalizes that into **14 independent market profiles** — one per market a bookmaker typically lists across the Full Match and 1st Set tabs — each producing its own recommendation and probability, plus a **Final Verdict** panel that ranks the eight "safest-market" profiles against each other to surface one headline pick.

**The central honesty commitment of this build, stated up front because the brief that produced it explicitly asked the tool to "beat the bookmakers":** no odds-reading tool — this one included — can manufacture a statistical edge from a single market's own prices. Every probability this tool shows is the bookmaker's own price with their margin mathematically removed (de-vigged), not an independently-derived "true" probability. What this tool *can* legitimately do, and what its actual value-add is, are three things: (1) organize and normalize dozens of correlated markets so you can compare them on a level footing instead of eyeballing raw odds, (2) tell you exactly how much margin/vig each candidate bet is charging you, so among similarly-likely outcomes you can pick the one that costs less, and (3) cross-check correlated markets (correct score vs. total sets, for instance) against each other and flag when they disagree, which is a genuine — if modest — signal that one of the two may be mispriced. None of this is prediction. See Part 6 for the full limitations list and Part 8 for what "EV" specifically does and doesn't mean in this tool.

---

## PART 2 — Market Inventory (what this version added over v1)

| # | Market | Section | Kind | Baselines | Priority |
|---|---|---|---|---|---|
| 1 | Match Winner (1X2) | Full Match | Winner | — | **Primary** |
| 2 | Total Points (Game Total) | Full Match | O/U | 3 tiers, dropdown + custom | **Primary** |
| 3 | Player A Total Points | Full Match | O/U | 3 tiers | **Primary** |
| 4 | Player B Total Points | Full Match | O/U | 3 tiers | **Primary** |
| 5 | Points Handicap | Full Match | Handicap | 2 tiers | Context |
| 6 | Sets Handicap | Full Match | Handicap | 3 tiers | Context |
| 7 | Total Sets Played | Full Match | O/U | 2 tiers (3.5 / 4.5) | Context |
| 8 | Total Sets Odd/Even | Full Match | Yes/No | — | Context |
| 9 | Correct Score (by sets) | Full Match | 6-way | fixed: 3-0/3-1/3-2/0-3/1-3/2-3 | Context |
| 10 | 1st Set Winner (1X2) | 1st Set | Winner | — | **Primary** |
| 11 | 1st Set Total Points | 1st Set | O/U | 3 tiers | **Primary** |
| 12 | 1st Set — Player A Points | 1st Set | O/U | 3 tiers | **Primary** |
| 13 | 1st Set — Player B Points | 1st Set | O/U | 3 tiers | **Primary** |
| 14 | 1st Set — Points Handicap | 1st Set | Handicap | 2 tiers | Context |

**Primary vs. Context**, per the brief's own framing: "game total over/under, 1st set total over/unders, players total points and the player-to-win markets" were named as the *safest* table tennis markets — those eight rows are tagged Primary and are the only ones eligible to appear as the Final Verdict's headline pick. The remaining six (handicaps, total sets, odd/even, correct score) are tagged Context — they still screen themselves individually with their own probability and are fully interactive, but they feed the Match Shape Intelligence panel and the Final Verdict's *supporting evidence* rather than becoming the headline pick themselves. This mirrors the v1 architecture's Primary/Supporting split, just expanded from 2 markets to 14.

**Deliberately excluded:** the "Set/Match" combo market (e.g. W1/W1, W2/W1 in the source screenshots) and the "Result + Total" combo markets (e.g. "W1 and Total Under 71.5 – Yes/No"). Both are correlated parlay-style markets whose fair price depends on the joint distribution of two other markets this tool already prices separately — adding them as raw odds-in fields without modeling that correlation would either duplicate information already shown elsewhere or produce a probability read that looks precise but isn't grounded in anything the tool actually calculates. If a future version adds them, it should derive their probability from the correlation of the two underlying markets rather than accepting raw odds input for them — see Part 10.

---

## PART 3 — Baseline Dropdown + Custom Line Design

Every Over/Under and Handicap market renders as one or more **tier rows**. Each tier row has:

1. A **line dropdown** pre-populated with the realistic range of lines a bookmaker offers for that specific market (e.g. the Game Total dropdown spans 66.5–84.5; the 1st Set Player Points dropdown spans 6.5–13.5) — curated from the sample odds this version was built against, not an arbitrary generic range.
2. A **Custom…** option at the end of every dropdown. Selecting it reveals a free-entry number field next to the dropdown for any line not in the preset list — the exact behavior requested: "users should also be able to input baselines if the baseline pick is not among the dropdown."
3. **Over/Under (or Home/Away) odds fields** next to the line.

Markets with three realistic price points shown by the bookmaker (Game Total, both Player Totals, 1st Set Total, both 1st Set Player Totals) get **three tier rows** — this is the "highest baseline / medium baseline / lowest baseline" structure requested, letting you enter the low, middle, and high lines a book typically posts side-by-side (e.g. 70.5 / 71.5 / 72.5) without deciding in advance which one matters most; the tool ranks all filled tiers together and surfaces whichever single line+side combination has the strongest normalized read. Handicap markets and Total Sets get two or three tiers depending on how many lines bookmakers typically list for that market (see Part 2's table). Winner, Odd/Even, and Correct Score markets have no line concept and render as a single row or a fixed six-field grid respectively.

You do not have to fill every tier. A market screens itself as soon as at least one tier (or, for Correct Score, at least two of the six scores) has both odds sides entered.

---

## PART 4 — The Calculation Model

### 4.1 Normalization (unchanged principle from v1, applied to every market kind here)

Every two-way market (Over/Under, Home/Away, Yes/No) is de-vigged the same way: `pA = (1/oddsA) / (1/oddsA + 1/oddsB) × 100`. Correct Score, a genuine six-way market, is normalized across **all filled outcomes** the same way — each entered score's raw implied probability divided by the sum of all entered scores' raw implied probabilities. This is more accurate than pairwise normalization for a market with more than two outcomes, and is a deliberate improvement over treating multi-outcome markets as a series of two-way comparisons.

**Caveat carried over honestly:** if you only enter 2–5 of the six correct-score prices, the normalization is only as good as the subset you gave it — the missing outcomes' probability mass gets redistributed across whatever you did enter, which inflates their normalized probabilities somewhat. The tool displays "n/6 scores entered" so you always know how complete the read is; fill all six for a fully accurate margin and probability picture.

### 4.2 Bookmaker Margin (the tool's actual "edge-finding" mechanism)

For every two-way market: `margin% = (1/oddsA + 1/oddsB − 1) × 100`. This is the bookmaker's built-in take on that specific line. It is shown next to every market's top pick. **This is the one number in the entire tool that represents a genuine, mathematically real form of "value"**: given two bets you judge equally likely, the one with the lower margin costs you less to place, full stop — no prediction skill required to benefit from noticing it. The Final Verdict's "Best Value Selection" is explicitly built around this principle (Part 5).

### 4.3 Market-Fair EV

For each market's top pick, the tool computes `EV = (probability/100 × odds) − 1`, using that market's own normalized probability and its own raw offered price. Read Part 8 before using this number for anything — the short version is that this number is mathematically guaranteed to sit at or very close to zero (usually slightly negative), because the probability and the price it's checked against both come from the same market. It is a **margin-cost indicator**, not a profit forecast.

### 4.4 Match Shape Intelligence (the cross-market layer)

Three numbers are derived from the Correct Score market, when at least two of its six prices are entered:

- **Sweep probability** = normalized P(3-0) + P(0-3)
- **4-set probability** = normalized P(3-1) + P(1-3)
- **5-set probability** = normalized P(3-2) + P(2-3)

These are compared against the Total Sets market's own Under-3.5 price, when present, in a **Consistency Flag**: if the two markets' implied "match ends in a sweep" probabilities differ by 15 percentage points or more, the tool flags a divergence and suggests double-checking both prices before betting either — this is the closest thing in the tool to genuine value-detection, because it doesn't rely on the tool having an opinion of its own; it only points out when two of the bookmaker's own markets disagree with each other about the same underlying event. When they agree, that's also shown, as a positive consistency signal rather than silence.

---

## PART 5 — The Final Verdict

The Final Verdict panel gathers the top pick from each of the **eight Primary-tagged markets** (Match Winner, Game Total, Player A Total, Player B Total, 1st Set Winner, 1st Set Total, 1st Set Player A, 1st Set Player B) — each contributes at most one candidate outcome, whichever of its own filled tiers scored highest.

- **Safest Selection** = the single highest normalized-probability candidate across all eight primary markets. This directly answers "the safest bet."
- **Best Value Selection** = among candidates at 55%+ probability (a floor chosen so the tool never recommends a coin-flip line just because its margin happens to be thin), the one with the least-negative EV — i.e., the lowest bookmaker margin. This directly answers "the baseline margin to bet": it's telling you which of your likely-enough picks charges you the smallest commission.
- A **ranked table** of up to eight candidates (market, pick, probability, odds, EV) lets you see how close the alternatives were, the same "show the full ranking, not just a single verdict" principle carried over from v1.

If Safest and Best Value point to the same outcome, the panel says so rather than repeating itself — that convergence (highest probability *and* lowest margin on the same pick) is the strongest read the tool is capable of producing.

---

## PART 6 — Limitations (must be preserved/disclosed, not silently fixed)

1. **No independent probability source exists anywhere in this tool.** Every probability is derived from odds you typed in from the same bookmaker. The tool cannot tell you the bookmaker is wrong — only how internally consistent their own markets are with each other (Part 4.4) and how much margin each one is charging you (Part 4.2).
2. **Correct Score normalization degrades with partial entry** (Part 4.1). Treat any Correct-Score-derived number as provisional until all six scores are entered.
3. **Best-of-5 format assumed throughout.** All preset baseline dropdown ranges, the sweep/4-set/5-set correct-score grouping, and every match-length inference assume a first-to-3 (best-of-5) format. A best-of-7 event will still let you enter odds (custom baseline lets you bypass the preset ranges entirely), but the Correct Score grid and Sets Handicap presets are shaped around 3-vs-5 games, not 4-vs-7 — a future version should add a format toggle (Part 10).
4. **The "Set/Match" and "Result + Total" combo markets from the source odds pages are intentionally not included** as raw-odds-input fields (Part 2) — accepting their prices without modeling the correlation between the two legs they combine would produce a probability number that looks like it means something but doesn't rest on any calculation this tool actually performs.
5. **The 55% floor on Best Value candidacy is a fixed, human-chosen threshold**, not a statistically derived one — it exists purely to stop the tool from ever recommending a low-probability outcome on margin grounds alone.
6. **No live odds feed, no player statistics, no head-to-head history, no playing-style or fatigue data.** Every input is manual and every read is price-only, by design — consistent with the offline-first scope of this whole project.
7. **Auto-save uses browser `localStorage`, which is not supported inside every environment this file might be opened in** (Part 7 explains where it does and doesn't work). The app is fully functional either way — inputs simply won't survive a page reload in environments where storage is blocked, but nothing within a single session is lost until you explicitly click "Clear all fields."

---

## PART 7 — Auto-Save Behavior

Every input and dropdown change is written to the browser's `localStorage` under the key `rallyLineTT_v3_state`, and reloaded automatically the next time the page opens in that same browser. This means: if you open the downloaded `.html` file directly in a normal desktop or mobile browser (double-click it, or open it via `file://`, or host it on your own simple web server), your odds entries will still be there if you accidentally navigate away and come back, right up until you press "Clear all fields & saved data."

**This will not persist inside a sandboxed in-chat preview** (for example, viewing the file inside an AI assistant's built-in preview pane before downloading it) — those environments commonly block persistent local storage for security reasons. The app detects this gracefully: every storage call is wrapped so a blocked environment simply skips saving/loading without breaking any other part of the tool. Within a single continuous session, your inputs are never cleared automatically regardless of environment — only the reset button clears them.

---

## PART 8 — What "EV" Here Actually Means (read this before staking anything)

The brief that produced this tool asked for an EV calculation, so one is shown next to every Final Verdict candidate. It is worth being precise about what it is and is not.

**What it is:** `EV = (fair probability × offered odds) − 1`, where "fair probability" is this market's own odds with the bookmaker's margin mathematically stripped out (Part 4.1), and "offered odds" is the same market's own raw price. Algebraically, this number is a direct readout of how much margin is embedded in that specific price — nothing more.

**What it will look like in practice:** at or slightly below 0%. This is not a bug or a sign the tool failed — it's mathematically guaranteed, because you're checking a price against a probability estimate drawn from that exact same price. A market with a tight 2% margin will show an EV close to −1%; a market with a fat 8% margin will show something closer to −4%. The number that's *closest to zero* among your candidates is the one charging you the least to play — that's genuinely useful information for choosing between two equally-appealing bets, and it's exactly what "the baseline margin to bet" means in the Final Verdict.

**What it is not:** a forecast of profit, a claim that the pick will win, or evidence that this tool has found an edge the bookmaker missed. A truly positive expected value requires a probability estimate that comes from *somewhere other than the market you're betting into* — real statistical modeling of player performance, a sharper competing bookmaker's line, or genuine inside information. This tool has none of those inputs. Anyone telling you an odds-normalization tool alone can reliably "beat the bookmaker to a higher certainty of winning" is describing something that isn't mathematically possible from a single market's own prices — this documentation says so plainly rather than let the tool's polish imply otherwise.

---

## PART 9 — Changelog: v1 → v2 (this document) / v2 → v3 (the app)

| Area | v1 / v2 doc | v2 doc (this file) / v3 app |
|---|---|---|
| Markets covered | 2 (Game 1 total points; derived full-match Under estimate) | 14, spanning both Full Match and 1st Set tabs |
| Full-match total points | Estimated only (no direct market existed in the sample data) | Directly priced and screened — the sample odds for this version include a real Total market, so no derivation is needed here |
| Player totals | Not covered | Full Match and 1st Set, both players, each with 3 baseline tiers |
| Correct Score | Not covered | 6-outcome market, properly multi-way normalized, feeds Match Shape Intelligence |
| Handicaps | 1st-game and full-match points handicap only | Adds Sets Handicap and 1st Set points handicap |
| Baseline entry | Fixed `<select>` per market, no custom option | Dropdown + "Custom…" free-entry on every tiered market, 2–3 tiers per market |
| Verdict | Two separate profile cards, one combined banner | One Final Verdict panel ranking all 8 primary markets by probability and by margin/EV, plus a ranked table |
| Persistence | None (explicitly stated as a design choice) | `localStorage` auto-save, gracefully degrading where unsupported |
| Cross-market checks | None | Correct-Score vs. Total-Sets consistency flag |

---

## PART 10 — Roadmap / Suggested Upgrade Paths

1. **Best-of-7 format toggle** that swaps the Correct Score grid to a first-to-4 set of eight scores and adjusts the Sets Handicap / Total Sets preset ranges accordingly (Limitation 3).
2. **Correlated combo-market support** (Set/Match, Result+Total) built by deriving their fair price from the two underlying single markets' own normalized probabilities and an assumed correlation, rather than accepting raw odds input for them directly (Limitation 4) — this would need to be clearly labeled as a modeled estimate, the same way v1's Profile B labeled its full-match-total estimate.
3. **Configurable Best Value floor** (currently fixed at 55%) as a small settings input, so users can tighten or loosen how conservative the "Best Value" candidate pool is.
4. **A second cross-check**, alongside the existing Correct-Score-vs-Total-Sets flag: compare the Sets Handicap favourite's strength against the Match Winner favourite's strength, since both should imply a similar dominance level if the bookmaker is pricing consistently.
5. **Match history / multi-event log** using this project's supported persistence pattern if this tool is ever rebuilt inside a platform that offers real backend storage, rather than browser `localStorage` — the natural next step for anyone wanting to actually test whether the Consistency Flag or margin-minimization approach adds value over time.

---

## PART 11 — How-To-Use Guide

1. Open `rally-line-tt-totals-screener.html` in your browser — no internet connection needed after the first load.
2. Enter player names (optional, cosmetic).
3. Work through the **Full Match Markets** section first — the four Priority markets (Match Winner, Game Total, both Player Totals) are expanded by default; the six Context markets are collapsed but one tap away.
4. For each Over/Under market, pick a line from the dropdown (or choose "Custom…" and type your own) and enter both the Over and Under prices — repeat for as many of the 2–3 tiers as your bookmaker offers.
5. Do the same for the **1st Set Markets** section.
6. Watch each market's own result strip update live directly beneath its inputs — pick, probability, and margin.
7. Check the **Match Shape Intelligence** panel for the sweep/4-set/5-set breakdown and any Consistency Flag.
8. Scroll to the **Final Verdict** panel for the single safest pick, the lowest-vig alternative, and the full ranked table.
9. Read the EV column as "margin cost," not "expected profit" — see Part 8.
10. Use "Clear all fields & saved data" between matches — this also wipes the auto-saved browser data for a clean slate.

---

## PART 12 — Disclaimers (must remain in any distributed version)

This tool is a decision-support screening aid. It normalizes and cross-checks odds you provide; it does not access live data, does not possess an independent statistical model of either player, and does not guarantee any outcome, win rate, or profit. The EV figures shown reflect bookmaker margin embedded in the prices you entered, not a forecast — see Part 8 in full before making any staking decision. No claim in this tool or its documentation should be read as a promise that it can consistently beat a bookmaker's margin; that is not something any odds-only tool can do. Users are solely responsible for their own staking decisions. If betting stops being enjoyable or feels out of control, free, confidential support is available in most regions through national gambling-help helplines.
