# The Offline Master Model v2 — Multi-Sport Odds & Lines Analysis Framework

**Version:** 2.0  
**Type:** Offline Analytical Constitution & Mathematical Framework. Zero AI inference, zero external web scraping, zero live API dependencies. Operates *exclusively* on odds and lines manually entered into the screener input fields.  
**Sports Covered in Version 2.0 (9 Total):**  
1. Football (Matchday Screener V4)  
2. Basketball (Matchday Screener V1)  
3. Tennis (Matchday Screener V1)  
4. Table Tennis (Rally Line Screener V2)  
5. Ice Hockey (Matchday Screener V1)  
6. Flash Line Instant Football Screener (v1)  
7. Court Line Instant Basketball Screener (v1)  
8. Pulse Line Virtual Football Screener (v1)  
9. Diamond Line Baseball Enterprise Screener (v1)  

---

## EXECUTIVE SUMMARY & ARCHITECTURAL EVOLUTION (v1 → v2)

Master Model v1 unified five core sports (Football, Basketball, Tennis, Table Tennis, Ice Hockey) into a Confluence Ledger framework. **Master Model v2** expands and elevates this framework across **nine sport screener variants**, introducing:

1. **Deliberate Scope-Narrowing Architecture**: Integration of fast-paced virtual/instant sports (Instant Football, Instant Basketball, Virtual Football) where target markets are strictly constrained to 4 or 5 primary selections (e.g., Over 0.5/1.5, BTTS, Team Over 0.5) to maximize speed of data entry and evaluation in fast pre-round windows.
2. **Two-Market Triangulation Engine**: Advanced cross-market verification (e.g., Teams To Score 4-way market + Correct Score Grid vs Direct Target Odds) for Instant Football and Virtual Football.
3. **Baseball Enterprise Engine**: Integration of Diamond Line Baseball, featuring 9-Inning Regulation Draw extra-innings probability extraction, 1st-5-Innings pace ratios, and team totals vs combined totals interpolation.
4. **Unified 5-Vote Confluence Ledger & Master Verdict Standards**: Standardized reporting across all 9 sports with explicit market probability, bookmaker margin, ledger voting, hard conflict capping, and margin-cost tie-breaking.

---

# PART 0 — THE CHARTER (Governs All 9 Sports)

## 0.1 The Prime Directive — Data Fidelity
Every calculation must originate from an odds/line field manually entered into the active screener for the specific fixture being evaluated.
- Empty fields are marked `[NOT ENTERED]` and their associated check is strictly **skipped**, never estimated or defaulted.
- No historical baseline, league average, form guide, or team sentiment is ever assumed or hallucinated.
- Every metric output is 100% deterministic and traceable to user input.

## 0.2 Mathematical Principles of Odds-Based Analysis
Odds-only analysis operates under three strict mathematical bounds:
1. **Margin Minimization**: Comparing de-vigged implied probabilities against raw decimal odds reveals the bookmaker margin embedded in each price (`margin% = (Σ 1/oddsᵢ - 1) × 100`). Lower margin represents lower transactional cost to the punter.
2. **Cross-Market Inconsistency Detection**: Different markets on the same fixture (e.g., 1X2 Draw vs Moneyline incl. OT, or Teams To Score vs Correct Score vs Direct Over/Under) are frequently priced via separate sub-models. Discrepancies between correlated markets signal internal pricing friction.
3. **Confluence Discipline**: A single market's high probability is validated only when independent correlated markets on the same match corroborate the direction.

## 0.3 Dual Output Standards — Market Probability vs. Confluence Tier
Every selection is reported as two distinct, unmerged metrics:
- **Market Probability %**: De-vigged normalized implied probability straight from the bookmaker's prices.
- **Confluence Tier**: Structural indicator (Tier 1 High, Tier 2 Moderate, Tier 3 Single-Angle, Tier 3 Conflicted, No Read) measuring agreement across independent market angles.
*Rule: High Confluence never inflates the Market Probability %. They remain side by side.*

## 0.4 The 5-Vote Confluence Ledger Framework
For any candidate selection, a 5-row ledger tallies votes from independent calculation sources:

| Ledger Row | Description | Vote Values |
|---|---|---|
| **1. Primary Scope Verdict** | Core profile tier for active scope (FT, Full Game, RT) | Candidate baseline |
| **2. Cross-Scope Verdict** | Same-direction verdict from secondary time segment (1H, 2H, Q1, P1, S1) | Agree / Disagree / N/A |
| **3. Cross-Market Consistency** | Structurally distinct market check (TTC, PGD, TGD, BTTS-vs-O/U, OT Split) | Agree / Disagree / N/A |
| **4. Structural / Scoreline Verdict** | Correct score grid clustering, CSI, or scoreline bounds | Agree / Disagree / N/A |
| **5. Ranking Corroboration** | Specific line ranking (Profile D, Top Picks, or Safest/Best Value convergence) | Agree / Disagree / N/A |

### Confluence Tier Assignment Rules
```
if disagreeCount >= 1:
    Tier 3 — Conflicted (Hard Cap: ANY explicit contradiction caps the tier at Tier 3)
else if agreeCount >= 3:
    Tier 1 — High Confluence
else if agreeCount == 2:
    Tier 2 — Moderate Confluence
else if agreeCount <= 1:
    Tier 3 — Single-Angle
if all rows N/A:
    No Read
```

## 0.5 Universal Mathematical Formulas
- **Implied Probability**: $P_{raw} = \frac{1}{\text{Decimal Odds}}$
- **Two-Way De-vig (Normalized %)**: $P_{norm} = \frac{1/O_A}{1/O_A + 1/O_B} \times 100$
- **Multi-Way De-vig**: $P_{norm, i} = \frac{1/O_i}{\sum_{k=1}^N 1/O_k} \times 100$
- **Bookmaker Margin %**: $M = \left( \sum_{k=1}^N \frac{1}{O_k} - 1 \right) \times 100$
- **Market-Fair EV**: $\text{EV} = \left( \frac{P_{norm}}{100} \times \text{Odds} \right) - 1$ *(Margin-cost indicator)*
- **Linear Fair-Line Interpolation**: Finds exact line $L_{fair}$ where $P_{norm}(\text{Over}) = 50\%$.

---

# PART 1 — FOOTBALL MASTER MODEL (MATCHDAY V4)

## 1.1 Scope Architecture
Evaluates three time scopes: **Full Time (FT)**, **1st Half (1H)**, and **2nd Half (2H)** using Profile A (Under), Profile B (Over), Profile C (1X2 / Double Chance / Asian Handicap), and Profile D (Goal Line / Team Totals / BTTS).

## 1.2 Scoreline & Cross-Market Checks
- **Resistance Zone Read**: Correct score grid clustering across odds bands (5.00–6.00 high-probability, 7.00–8.00 moderate, 12.00–13.50 ceiling).
- **BTTS vs. Total Consistency**:
  - `BTTS Yes >= 60%` & Candidate = Over $\rightarrow$ **Agree**
  - `BTTS No >= 60%` & Candidate = Over $\rightarrow$ **Disagree**
  - `BTTS No >= 60%` & Candidate = Under $\rightarrow$ **Agree**
  - `BTTS Yes >= 60%` & Candidate = Under $\rightarrow$ **Disagree**

## 1.3 Football Confluence Ledger Instantiation
1. **Primary Scope**: FT Profile A or B Tier  
2. **Cross-Scope**: 2H Profile A/B Tier (or 1H if 2H empty)  
3. **Cross-Market**: BTTS vs. Total Consistency  
4. **Structural**: Resistance Zone Scoreline Read  
5. **Ranking**: Profile D Top Pick Agreement  

---

# PART 2 — BASKETBALL MASTER MODEL (MATCHDAY V1)

## 2.1 Scope Architecture & MET
Evaluates FT, 1H, and Q1 scopes. Computes **Market-Expected Total (MET)** in points for Game Total, Home Total, and Away Total via linear interpolation around 50% normalized probability.

## 2.2 Basketball Cross-Market Checks
- **Team Total Consistency (TTC)**: Tests if $\text{MET}_{\text{Home}} + \text{MET}_{\text{Away}} \approx \text{MET}_{\text{Game}}$. Flagged if gap $> 2.0$ points.
- **Scale Check**: $\text{MET}_{Q1} \times 4$ and $\text{MET}_{1H} \times 2$ vs $\text{MET}_{FT}$.
- **Handicap Balance Width**: Tight line ($\le \pm 3.0$ pts) indicates defensive/low-scoring lean; wide line ($\ge \pm 8.0$ pts) indicates pace/lopsided blowout lean.

## 2.3 Basketball Confluence Ledger Instantiation
1. **Primary Scope**: FT Profile A or B Tier  
2. **Cross-Scope**: Q1 $\times 4$ or 1H $\times 2$ Scale Check  
3. **Cross-Market**: TTC Differential Classification  
4. **Structural**: Handicap Balance Width Read  
5. **Ranking**: Profile D Top Pick Agreement  

---

# PART 3 — TENNIS MASTER MODEL (MATCHDAY V1)

## 3.1 Scope Architecture & MEG
Evaluates Regular Time (RT) and 1st Set (S1). Computes **Market-Expected Games (MEG)** and **Correct Score Intelligence (CSI)** distribution across 14 set scorelines.

## 3.2 Tennis Cross-Market Checks
- **Player Game Differential (PGD)**: Checks individual player games against match MEG.
- **Dual Tiebreak Consistency**: Compares CSI-derived Tiebreak % vs direct Tiebreak (Yes/No) market. Discrepancy $> 10\%$ triggers automatic **Disagree** vote.
- **Scale Check**: $\text{MEG}_{S1} \times 2.4$ (Best of 3) or $\times 4.1$ (Best of 5) vs $\text{MEG}_{RT}$.

## 3.3 Tennis Confluence Ledger Instantiation
1. **Primary Scope**: RT Profile A or B Tier  
2. **Cross-Scope**: S1 $\times 2.4 / 4.1$ Scale Check  
3. **Cross-Market**: PGD Signal / Dual-Tiebreak Agreement  
4. **Structural**: CSI Expected Games vs Totals MEG  
5. **Ranking**: Profile D Top Pick Agreement  

---

# PART 4 — TABLE TENNIS MASTER MODEL (RALLY LINE V2)

## 4.1 Scope Architecture & 1st-Set Projection
Evaluates Full Match and 1st Set. Introduces the **1st-Set-to-Match Projection**:
$$\text{Projected Match Points} = \text{MEG}_{S1} \times 4.3$$
Difference vs Full Match MEG $> \pm 6$ points indicates pace divergence.

## 4.2 Table Tennis Cross-Market Checks
- **Match Shape Mix**: Evaluates Correct Score distribution into Sweep (3-0/0-3), 4-Set (3-1/1-3), and 5-Set (3-2/2-3) probabilities.
- **Player Totals Corroboration**: Checks if Player A Total + Player B Total agree with Match Total.

## 4.3 Table Tennis Confluence Ledger Instantiation
1. **Primary Scope**: Full Match Total O/U Top Pick  
2. **Cross-Scope**: 1st Set Total O/U / 4.3x Projection  
3. **Cross-Market**: Player A + Player B Totals Agreement  
4. **Structural**: Match Shape Sweep/Long-Match Mix  
5. **Ranking**: Final Verdict Safest & Best Value Convergence  

---

# PART 5 — ICE HOCKEY MASTER MODEL (MATCHDAY V1)

## 5.1 Scope Architecture & Mechanics
Evaluates Regular Time (60 min) and 1st Period (P1). Multiplier: $\text{MEG}_{P1} \times 3 \approx \text{MEG}_{RT}$.

## 5.2 Ice Hockey Checks & Empty-Net Reversal
- **Overtime Intelligence**: De-vigs 1X2 Draw as $P(OT)$. Checks Regulation 1X2 vs Moneyline (incl. OT) under coinflip assumption.
- **Empty-Net Reversal**: Highly lopsided Moneyline ($P > 65\%$) increases late-game empty-net pulled goaltender frequency $\rightarrow$ **leans Over**, reversing standard blowout logic.
- **Correct Score Reconciliation**: Reconstructs Shutout %, BTTS %, and Odd/Even % from grid.

## 5.3 Ice Hockey Confluence Ledger Instantiation
1. **Primary Scope**: RT Profile A or B Tier  
2. **Cross-Scope**: P1 $\times 3$ Scale Check  
3. **Cross-Market**: Team Goal Differential (TGD)  
4. **Structural**: Correct Score Shutout % Reconciliation  
5. **Ranking**: Empty-Net Reversal & Moneyline Lean  

---

# PART 6 — FLASH LINE INSTANT FOOTBALL MASTER MODEL (v1)

## 6.1 Purpose & Deliberate Scope-Narrowing
Engineered specifically for SportyBet Instant Football. Deliberately restricted to **5 target selections**:
1. Match Goals — Over/Under 0.5  
2. Match Goals — Over/Under 1.5  
3. Home Team Goals — Over/Under 0.5  
4. Away Team Goals — Over/Under 0.5  
5. Both Teams To Score (BTTS GG/NG)  

## 6.2 Two-Market Triangulation Engine
Triangulates target probabilities across **three independent odds sources**:
1. **Direct Target Odds** ($P_{direct}$)  
2. **Teams To Score (4-way Market)** ($P_{TTS}$):  
   - $P(\text{Match O0.5}) = 1 - P(\text{Neither})$  
   - $P(\text{Home O0.5}) = P(\text{Only Home}) + P(\text{Both})$  
   - $P(\text{Away O0.5}) = P(\text{Only Away}) + P(\text{Both})$  
   - $P(\text{BTTS Yes}) = P(\text{Both})$  
3. **Correct Score Grid (16 Scorelines + Other)** ($P_{CS}$)  

Max gap across sources $> 10\%$ flags a structural divergence.

## 6.3 1st Half Pace Share
$$\text{Pace Share \%} = \frac{\text{Fair Line}_{1H}}{\text{Fair Line}_{FT}} \times 100$$
Typical expected band: **35% – 55%**.

## 6.4 Instant Football Confluence Ledger Instantiation
1. **Primary Market**: Direct Normalized Target Probability  
2. **Cross-Market (TTS)**: Teams To Score Derived Probability Agreement  
3. **Cross-Market (CS)**: Correct Score Grid Derived Probability Agreement  
4. **Structural**: BTTS Statistical Independence Check ($P_H \times P_A$ vs $P_{BTTS}$)  
5. **Pace Share**: 1st Half Pace Share within 35–55% band  

---

# PART 7 — COURT LINE INSTANT BASKETBALL MASTER MODEL (v1)

## 7.1 Purpose & Target Market Focus
Engineered for SportyBet Instant Basketball. Constrained to **4 primary target markets**:
1. Match Total Points (incl. OT) — Tiered O/U  
2. Match Handicap (incl. OT) — Tiered  
3. Home Team Total Points (incl. OT) — Tiered O/U  
4. Away Team Total Points (incl. OT) — Tiered O/U  

## 7.2 Overtime Consistency Check
Extracts regulation Draw % from Regulation 1X2 market ($P_{Draw}$). Computes expected OT-inclusive Home win %:
$$P_{\text{Home, exp}} = P_{\text{Home, reg}} + 0.5 \times P_{Draw}$$
Compares against priced Winner (incl. OT) market. Discrepancy $> 8\%$ flags an OT pricing anomaly.

## 7.3 Team Totals vs Match Total & Pace
- **Team Total Sum Check**: $\text{Fair Line}_{\text{Home}} + \text{Fair Line}_{\text{Away}}$ vs $\text{Fair Line}_{\text{Match}}$. Flagged if gap $> 2.0$ pts.  
- **Quarter-Pace Extrapolation**: $\text{Fair Line}_{Q1} \times 4$ vs $\text{Fair Line}_{\text{Match}}$. Expected band: within $\pm 10\%$.

## 7.4 Instant Basketball Confluence Ledger Instantiation
1. **Primary Market**: Tiered Target Market Normalized %  
2. **Cross-Scope**: Q1 $\times 4$ Pace Extrapolation  
3. **Cross-Market**: Team Totals Sum vs Match Total  
4. **Structural**: Overtime 1X2 vs Moneyline Consistency ($8\%$ cap)  
5. **Ranking**: Best Line Tier Selection Agreement  

---

# PART 8 — PULSE LINE VIRTUAL FOOTBALL MASTER MODEL (v1)

## 8.1 Purpose & Target Selections
Tailored for fast-paced Virtual Football (3–5 min round cycle). Restricted to **5 primary target selections**:
1. Match Goals — Over/Under 1.5  
2. Match Goals — Over/Under 2.5  
3. Home Team Goals — Over/Under 0.5  
4. Away Team Goals — Over/Under 0.5  
5. Both Teams To Score (BTTS GG/NG)  

## 8.2 Joint Distribution Correct Score Grid
Calculates target probabilities directly from the 16-scoreline + "Other" grid:
- $P(\text{Match O1.5}) = \sum P(\text{Scores with } \ge 2 \text{ goals}) + P(\text{Other})$
- $P(\text{Match O2.5}) = \sum P(\text{Scores with } \ge 3 \text{ goals}) + P(\text{Other})$
- $P(\text{Home O0.5}) = \sum P(\text{Home Score } \ge 1)$ *(Lower bound when "Other" present)*
- $P(\text{Away O0.5}) = \sum P(\text{Away Score } \ge 1)$ *(Lower bound when "Other" present)*
- $P(\text{BTTS Yes}) = \sum P(\text{Both Teams Score } \ge 1)$ *(Lower bound when "Other" present)*

## 8.3 Virtual Football Confluence Ledger Instantiation
1. **Primary Market**: Direct Target Market Normalized %  
2. **Cross-Market**: Correct Score Joint Distribution Derived %  
3. **Cross-Market**: Goals Curve Interpolated Fair Line Agreement  
4. **Structural**: Team Goals Sum ($\text{Fair}_H + \text{Fair}_A$) vs Match Fair Line (gap $< 0.5$)  
5. **Pace Share**: 1st Half Pace Share Context  

---

# PART 9 — DIAMOND LINE BASEBALL MASTER MODEL (v1)

## 9.1 Purpose & Time Window Architecture
Covers 21 baseball markets organized across three time windows: **Regular Time (9 Innings)**, **1st 5 Innings (F5)**, and **1st Inning (F1)**. Identifies **8 Primary Target Markets**:
1. Regulation Result (1X2)  
2. Winner (incl. Extra Innings)  
3. Full Game Total Runs (Tiered)  
4. Full Game Home Total Runs (Tiered)  
5. Full Game Away Total Runs (Tiered)  
6. 1-5 Innings Result (1X2)  
7. 1-5 Innings Total Runs (Tiered)  
8. 1st Inning Total Runs (Tiered)  

## 9.2 Baseball Cross-Market Checks
1. **Extra-Innings Consistency Check**: De-vigs Regulation 1X2 Draw % ($P_{Draw}$). Compares against direct "Will There Be Extra Innings" market. Gap $\ge 8\%$ flags discrepancy.
2. **Team Totals vs Combined Total**: Interpolates fair lines for Home Runs, Away Runs, and Combined Runs. Gap $\ge 1.0$ run triggers divergence flag.
3. **1st-5-Innings Pace Ratio**:
   $$\text{Pace Ratio \%} = \frac{\text{Fair Line}_{F5}}{\text{Fair Line}_{\text{Full Game}}} \times 100$$
   Typical expected band: **50% – 62%**. Ratios outside 45% – 68% flag unusual starter/bullpen scoring concentration.

## 9.3 Baseball Confluence Ledger Instantiation
1. **Primary Scope**: Full Game Priority Market Normalized %  
2. **Cross-Scope**: F5 Total to Full Game Pace Ratio (45–68% band)  
3. **Cross-Market**: Team Totals Sum vs Combined Total ($1.0$ run gap)  
4. **Structural**: Extra-Innings 1X2 Draw vs Direct Extra Inning Market ($8\%$ cap)  
5. **Ranking**: Top Pick Convergence across Priority Markets  

---

# PART 10 — MASTER CROSS-SPORT SYNTHESIS & EXECUTION MATRIX

| Sport / Variant | Primary Focus Scope | Key Cross-Market Check | Structural / Scoreline Check | Confluence Tier Threshold |
|---|---|---|---|---|
| **Football (V4)** | FT, 1H, 2H | BTTS vs Total O/U | Resistance Zone Clusters | 3+ Agree, 0 Disagree |
| **Basketball (V1)** | FT, 1H, Q1 | Team Total Consistency (TTC) | Handicap Balance Width | 3+ Agree, 0 Disagree |
| **Tennis (V1)** | RT, S1 | Dual-Tiebreak Agreement | CSI Expected Games vs MEG | 3+ Agree, 0 Disagree (10% TB cap) |
| **Table Tennis (Rally)** | Full Match, S1 | Player A+B Totals Sum | 4.3x S1-to-Match Projection | 3+ Agree, 0 Disagree |
| **Ice Hockey (V1)** | RT (60m), P1 | Team Goal Differential (TGD) | Empty-Net Reversal & CS Shutout % | 3+ Agree, 0 Disagree |
| **Instant Football (Flash)** | 5 Target Markets | 2-Market Triangulation (TTS + CS) | BTTS Independence Check | 3+ Agree, 0 Disagree (10% gap cap) |
| **Instant Basketball (Court)** | 4 Target Markets | Team Totals Sum vs Match Total | OT 1X2 vs Moneyline ($8\%$ cap) | 3+ Agree, 0 Disagree |
| **Virtual Football (Pulse)** | 5 Target Markets | CS Joint Distribution | Team Goals Sum vs Match Fair Line | 3+ Agree, 0 Disagree |
| **Baseball (Diamond)** | RT, F5, F1 | Team Totals Sum vs Combined Total | 9-Inn Draw vs Extra Innings ($8\%$ cap) | 3+ Agree, 0 Disagree |

---

## CONCLUDING CHARTER & OPERATIONAL NOTICE

The Master Model v2 framework serves as the unified mathematical constitution for the Sports Screener application. It guarantees 100% data fidelity, zero artificial probability inflation, rigorous cross-market consistency checking, and disciplined confluence tiering across all 9 sports.
