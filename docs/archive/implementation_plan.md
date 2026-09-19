# Sports Screener Upgrades & Feature Parity Implementation Plan

This plan details the comprehensive upgrade of the Sports Screener mobile application to achieve full feature parity (Final Verdict, Margin Rank, Shape Read, All Markets) across all four supported sports (Football, Basketball, Tennis, and Table Tennis / Rally), fix the decimal odds options picker, customize all metrics and verdicts to each sport's unique domain characteristics, and verify with automated browser smoke testing.

## Summary of Goals
1. **Decimal Odds Picker Fix**:
   - Replace the static `oddsOptions` array with sequential decimal odds from 1.01 to 5.00 in 0.01 increments (1.01, 1.02, ..., 5.00, 400 values).
   - Include 5.01 to 10.00 range in 0.50 increments (5.50, 6.00, ..., 10.00).
   - Add a custom odds setter for odds > 10.00 via a numeric input field in `OddsPicker.svelte`.
2. **Feature Parity Across All 4 Sports**:
   - Replicate the Rally (Table Tennis) 4-profile pattern (`Profile A: Safest Selection / Final Verdict`, `Profile B: Best Value / Margin Rank`, `Profile C: Match-Shape Intelligence / Shape Read`, `Profile D: All Markets Ranking`) across Football, Basketball, and Tennis.
3. **Sport-Specific Domain Customization**:
   - **Football**: 0-0 resistance, low-score cluster (0-0, 1-0, 0-1, 1-1), draw price support, goal-line & BTTS ranking, scope presets (`h1`, `h2`, `ft` × league deltas).
   - **Basketball**: MET (Market Expected Total) 50%-crossover algorithm, value-zone positioning (±1–5 pts from MET), Team Total Consistency (TTC), cross-scope pace scale check (Q1×4, 1H×2 vs FT).
   - **Tennis**: MEG (Market Expected Games) algorithm, surface modifiers (Clay/Grass/Hard), Bo3/Bo5 format awareness, Correct Score Intelligence (CSI: Decisive%, Competitive%, Tiebreak%), Dual Tiebreak Signal cross-check.
   - **Table Tennis (Rally)**: Match/set shape (3-0, 3-1, 3-2, etc.), sets handicap & totals cross-checks.
4. **Build, Test & Deployment**:
   - Run type checks (`svelte-check`) and Vite build (`npm run build`).
   - Run Playwright smoke tests across all 4 sports (`qa-smoke.mjs`).
   - Commit and push to Git repository.

---

## User Review Required

> [!IMPORTANT]
> - **Odds Picker Change**: All decimal odds 1.01–5.00 are now selectable in 0.01 steps directly in the dropdown. Odds 5.50–10.00 use 0.50 steps. For odds > 10.00 (or custom odds entry), selecting "Custom..." or entering custom odds displays a dedicated numeric input field.
> - **Unified Profile Format**: Every sport will display 4 cards: `Profile A (Safest Selection - Final Verdict)`, `Profile B (Best Value - Margin Rank)`, `Profile C (Match-Shape Intelligence - Shape Read)`, and `Profile D (All Markets Ranking)`.

---

## Proposed Changes

### Core Engine & Data Models

#### [MODIFY] [engine.ts](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/engine.ts)
- Generate sequential `oddsOptions` array programmatically: 1.01 to 5.00 by 0.01 step, 5.50 to 10.00 by 0.50 step.
- Rewrite `analyzeFootball` into 4-profile pattern (A: Safest Selection, B: Best Value Margin EV, C: Match-Shape Intelligence, D: All Markets Ranking).
- Split `analyzeMetSport` into separate `analyzeBasketball` and `analyzeTennis` functions:
  - `analyzeBasketball`: MET calculation, Value Zone lines, TTC (Team Total Consistency), Pace Scale Checks, 4 profiles A/B/C/D.
  - `analyzeTennis`: MEG calculation, Surface & Format modifiers, CSI (Correct Score Intelligence), Dual Tiebreak Signal, 4 profiles A/B/C/D.
- Refine `analyzeRally` to align strictly with the standardized 4-profile pattern and outputs.

---

### UI Components

#### [MODIFY] [OddsPicker.svelte](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/components/OddsPicker.svelte)
- Add "Custom (>10.00)" option to dropdown.
- Render numeric input for custom odds entry when selected or when value > 10.00.

#### [MODIFY] [ScreenerPage.svelte](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/components/ScreenerPage.svelte)
- Call `analyzeBasketball` for basketball and `analyzeTennis` for tennis directly instead of `analyzeMetSport`.

---

## Verification Plan

### Automated Tests
1. **Type Checking**:
   ```powershell
   npx svelte-check --tsconfig ./tsconfig.json
   ```
2. **Build Verification**:
   ```powershell
   npm run build
   ```
3. **Playwright Smoke Test**:
   ```powershell
   node qa-smoke.mjs
   ```

### Manual Verification
- Test all 4 sports in local browser (`npm run dev`).
- Test odds dropdown for 1.01–5.00 (0.01 step), 5.50–10.00 (0.50 step), and Custom odds input > 10.00.
- Verify Profile A, B, C, D cards on Football, Basketball, Tennis, and Rally screener pages.
