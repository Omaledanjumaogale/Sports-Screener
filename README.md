# 🏆 PulseOdds Sports Screener — Multi-Sport Odds & Lines Screening Engine

[![SvelteKit](https://img.shields.io/badge/SvelteKit-2.70-orange?style=flat-square&logo=svelte)](https://kit.svelte.dev/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5.19-red?style=flat-square&logo=svelte)](https://svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Cloud-purple?style=flat-square)](https://convex.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/Deployment-Cloudflare_Pages-f38020?style=flat-square&logo=cloudflare)](https://pages.cloudflare.com/)

> **Version:** 2.0.0 (Enterprise Synchronized Edition · August 2026)  
> **Architecture:** SvelteKit 2 Static Single-Page Application (SPA) on Cloudflare Pages + Convex Serverless Realtime Cloud Database & Auth + Cloudflare AI Copilot.

---

## 📌 Executive Summary

**PulseOdds Sports Screener** is an enterprise-grade multi-sport odds analysis and matchday screening platform covering **9 distinct sports and game modes**. Operating on a **100% deterministic, offline-capable mathematical framework (Offline Master Model v2)**, the application evaluates user-entered betting odds and line handicaps across multiple market angles to produce standardized probability reports, bookmaker margin indicators, expected value (EV) metrics, and 5-vote confluence ledgers.

The application features a **two-tiered hybrid storage engine**:
1. **Instant Offline Layer (`localStorage`)**: Zero-latency UI updates and full offline evaluation capabilities.
2. **Serverless Cloud Source of Truth (`Convex Cloud`)**: Realtime device-to-cloud draft synchronization, identity-based saved screener history, user profiles, predictor engine datasets, and payment subscription status.

---

## ✨ Key Features & Capabilities

- 🏟️ **9 Multi-Sport Screener Modules**:
  - **Football (Matchday V4)**: Full Time, 1st Half, 2nd Half scopes; 1X2, Asian Handicap, Over/Under Goal Lines, Both Teams To Score (BTTS), Correct Score Resistance Grids.
  - **Basketball (Matchday V1)**: Full Game, 1st Half, 1st Quarter scopes; Moneyline, Spread Handicap, Total Points, Team Totals, Pace/Quarter ratios.
  - **Tennis (Matchday V1)**: Full Match, Set 1, Set 2 scopes; Match Winner, Games Handicap, Total Games, Set Betting, Tie-Break probabilities.
  - **Table Tennis (Rally Line V2)**: Full Match, Set 1, Set 2 scopes; Match Winner, Set Handicap, Total Points, Clean Sweep vs. Decider checks.
  - **Ice Hockey (Matchday V1)**: Regulation Time (60 Min), 1st Period, Full Game (incl. OT/SO) scopes; 1X2, Puck Line Handicap, Total Goals, Team Totals, Overtime Split probabilities.
  - **Flash Line Instant Football (v1)**: Fast pre-round screener evaluating 4 high-frequency markets (Over 0.5/1.5, BTTS, Home/Away Score).
  - **Court Line Instant Basketball (v1)**: Rapid basketball total and team line evaluation for tight pre-round windows.
  - **Pulse Line Virtual Football (v1)**: Virtual sports round evaluation featuring Two-Market Triangulation (Teams To Score 4-way market + Correct Score Grid vs Direct Over/Under).
  - **Diamond Line Baseball Enterprise (v1)**: Full Game & 1st 5 Innings (F5) scopes; Moneyline, Run Line Handicap, Total Runs, F5 Pace ratios, and 9-Inning Regulation Draw extra-innings probability extraction.
- 🎯 **Predictor Analytics Engine (`/predictor`)**: AI-driven match selections dashboard, match cards, interactive team selectors, selection confidence charts, and detailed verdict panels.
- 🧠 **Offline Master Model v2 Engine**: Browser-side, zero-latency mathematical framework performing multi-way de-vigging, bookmaker margin calculation, fair line linear interpolation, EV estimation, and hard conflict capping.
- 🤖 **AI Fixture Copilot**: Cloudflare AI Pages Function (`/api/ai-analyze`) integrating Agnes and OpenRouter models for natural language match reports, risk summaries, and key structural recommendations.
- 🔄 **Realtime Convex Synchronization & Offline Queue**: Realtime draft syncing across devices with an automatic offline retry queue (`sportsScreener_pending_*`) that auto-flushes local records when cloud connectivity is restored.
- 🔐 **Real Convex Authentication & Identity**: Password authentication provider integrated via `@convex-dev/auth`, with JWT session handling (`setConvexAuthToken()`) and developer/tester access modes.
- 💳 **Flutterwave Donation & Subscription Flow**: Webhook endpoint (`convex/http.ts`) handling payment verification, instant activation passes, and user subscription records.
- 🌗 **Harmonized Enterprise Theme Engine**: Adaptive Dark/Light mode theme with high-contrast accessibility, responsive flexbox/grid layouts, metric strips, and mobile bottom navigation.

---

## 📐 System Architecture

```
                                  +-------------------------------------------------+
                                  |                Browser SPA (Client)             |
                                  |                                                 |
                                  |  +------------------+   +--------------------+  |
                                  |  | engine.ts        |   | localStorage       |  |
                                  |  | Math Analysis    |---| (Instant/Offline)  |  |
                                  |  +------------------+   +--------------------+  |
                                  |           |                        |            |
                                  |  +------------------+   +--------------------+  |
                                  |  | draftSync.ts     |   | SaveHistory.svelte |  |
                                  |  | Draft Sync       |   | History Management |  |
                                  |  +------------------+   +--------------------+  |
                                  +-----------|------------------------|------------+
                                              | (Realtime HTTP/WS)     | (Mutations/Queries)
                                              v                        v
+-----------------------------------------------------------------------------------+
| Convex Cloud Backend (https://modest-lark-218.eu-west-1.convex.cloud)             |
|                                                                                   |
|  +---------------+  +------------------+  +--------------+  +------------------+  |
|  | drafts Table  |  | savedScreeners   |  | userProfiles |  | predictor Tables |  |
|  +---------------+  +------------------+  +--------------+  +------------------+  |
|  +---------------+  +------------------+                                          |
|  | auth Actions  |  | Flutterwave HTTP |                                          |
|  +---------------+  +------------------+                                          |
+-----------------------------------------------------------------------------------+
                                    |                                    |
                                    v                                    v
                  +-----------------------------------+   +-------------------------+
                  | Cloudflare AI (/api/ai-analyze)   |   | Flutterwave Webhook     |
                  | Agnes / OpenRouter Models         |   | charge.completed        |
                  +-----------------------------------+   +-------------------------+
```

---

## 🧮 Mathematical Framework (Offline Master Model v2)

The engine operates on strict odds-based probability bounds:

### 1. Implied & De-vigged Market Probabilities
- **Raw Implied Probability:**  
  $$\text{Probability}_{\text{raw}} = \frac{1}{\text{Decimal Odds}}$$
- **Two-Way De-vigged (Normalized %):**  
  $$P_{\text{norm}, A} = \frac{1/\text{Odds}_A}{\frac{1}{\text{Odds}_A} + \frac{1}{\text{Odds}_B}} \times 100$$
- **Bookmaker Margin %:**  
  $$\text{Margin } M\% = \left( \sum_{k=1}^N \frac{1}{\text{Odds}_k} - 1 \right) \times 100$$
- **Market Fair EV (Margin-Cost Indicator):**  
  $$\text{EV} = \left( \frac{P_{\text{norm}}}{100} \times \text{Odds} \right) - 1$$

### 2. The 5-Vote Confluence Ledger
For every candidate selection, 5 independent mathematical checks vote to assign a **Confluence Tier**:

| Ledger Row | Description | Check |
|---|---|---|
| **1. Primary Scope Verdict** | Core profile tier for active scope (FT/RT/Full Game) | Candidate baseline |
| **2. Cross-Scope Verdict** | Same-direction check in sub-period (1H, 2H, Q1, P1, S1) | Agree / Disagree / N/A |
| **3. Cross-Market Consistency** | Independent market check (BTTS, TTC 4-Way, OT Split) | Agree / Disagree / N/A |
| **4. Structural Scoreline** | Correct Score Grid clustering or scoreline bounds | Agree / Disagree / N/A |
| **5. Ranking Corroboration** | Convergence across Top Value & Safest Profile rankings | Agree / Disagree / N/A |

#### Tier Rules:
- **Tier 1 (High Confluence):** $\ge 3$ Agree votes and 0 Disagree votes.
- **Tier 2 (Moderate Confluence):** Exactly 2 Agree votes and 0 Disagree votes.
- **Tier 3 (Single-Angle):** $\le 1$ Agree vote and 0 Disagree votes.
- **Tier 3 (Conflicted):** $\ge 1$ Disagree vote (*Hard Cap rule: any contradiction caps selection at Tier 3*).

---

## 📂 Project Structure

```
Sports-Screener/
├── AUDIT.md                                # Convex synchronization & audit log
├── Basketball-Matchday-Screener-V1.html     # HTML baseline documentation / preview
├── Basketball-Screener-V1-Documentation.md  # Basketball engine specs
├── Football Matchday-Screener-V4.html       # Football baseline documentation
├── Football Matchday-Screener-V4-Documentation.md # Football engine specs
├── OFFLINE-MASTER-MODEL-v2-Documentation.md# Master model mathematical framework
├── README.md                                # Comprehensive application documentation
├── convex/                                  # Convex serverless backend
│   ├── _generated/                         # Generated types & API code
│   ├── auth.ts                             # Auth configuration (@convex-dev/auth)
│   ├── drafts.ts                           # Drafts mutation & query functions
│   ├── http.ts                             # HTTP router & Flutterwave webhook
│   ├── predictor.ts                        # Predictor engine dataset management
│   ├── savedScreeners.ts                   # Saved history storage & sync
│   ├── schema.ts                           # Convex database schema definition
│   └── users.ts                            # User profile & subscription functions
├── functions/                               # Cloudflare Pages Functions
│   └── api/ai-analyze.ts                   # AI Copilot endpoint (Agnes/OpenRouter)
├── qa-smoke.mjs                             # Playwright automated multi-sport smoke runner
├── src/                                     # SvelteKit frontend source
│   ├── app.css                             # Enterprise theme styling tokens
│   ├── app.html                            # HTML entry shell
│   ├── lib/                                # Shared libraries & components
│   │   ├── authStore.svelte.ts             # Auth session state & Convex token binding
│   │   ├── cloudflareAi.ts                 # AI copilot client API integrations
│   │   ├── components/                     # Reusable Svelte 5 components
│   │   │   ├── AiPredictorButton.svelte    # AI trigger component
│   │   │   ├── BottomNav.svelte            # Mobile bottom navigation bar
│   │   │   ├── CloudflareAiBanner.svelte   # AI copilot banner & results display
│   │   │   ├── Header.svelte               # Main header & navigation
│   │   │   ├── MasterVerdictCard.svelte    # Master verdict card & ledger
│   │   │   ├── PredictorPage.svelte        # Predictor analytics page component
│   │   │   ├── SaveHistory.svelte          # Saved history modal & sync manager
│   │   │   ├── ScreenerPage.svelte         # Core multi-sport screener component
│   │   │   └── ThemeToggle.svelte          # Dark/Light theme toggler
│   │   ├── convexClient.ts                 # Convex client singleton & helpers
│   │   ├── draftSync.ts                    # Live draft synchronization manager
│   │   ├── engine.ts                       # Core mathematical screening engine (109KB)
│   │   ├── predictorClient.ts              # Predictor engine query client
│   │   ├── predictorInsights.ts            # Predictor statistical insights engine
│   │   └── predictorSelections.ts          # Predictor selection algorithms
│   └── routes/                             # SvelteKit pages & API endpoints
│       ├── +layout.svelte                  # Root layout & providers
│       ├── +page.svelte                    # Landing dashboard
│       ├── auth/                           # Authentication page
│       ├── baseball/                       # Baseball screener module
│       ├── basketball/                     # Basketball screener module
│       ├── checkout/                       # Flutterwave checkout & donation pass
│       ├── football/                       # Football screener module
│       ├── hockey/                         # Ice Hockey screener module
│       ├── instant-basketball/             # Instant Basketball module
│       ├── instant-football/               # Instant Football module
│       ├── predictor/                      # Predictor analytics dashboard
│       ├── rally/                          # Table Tennis module
│       ├── tennis/                         # Tennis screener module
│       └── vfootball/                      # Virtual Football module
├── svelte.config.js                         # SvelteKit adapter-static config
├── tsconfig.json                           # TypeScript configuration
├── vite.config.ts                          # Vite build system config
└── wrangler.toml                           # Cloudflare Pages deployment config
```

---

## 🗄️ Database Schema (Convex Cloud)

The Convex backend defines 8 primary tables (`convex/schema.ts`):

1. **`drafts`**: Stores live active screener inputs per sport/session/user (`owner`, `sessionId`, `userId`, `sportId`, `scopes`, `updatedAt`). Indexed by owner, session, and user.
2. **`savedScreeners`**: User saved analysis records (`sportId`, `title`, `notes`, `scopes`, `verdict`, `sessionId`, `userId`, `createdAt`, `updatedAt`).
3. **`userProfiles`**: User account details, roles (`user`, `tester`, `admin`), trial status, and subscription state (`isSubscribed`, `subscriptionExpiresAt`).
4. **`subscriptions`**: Flutterwave payment transactions (`email`, `txRef`, `amount`, `status`, `flwRef`).
5. **`predictorDays`**: Daily predictor refresh status per sport (`dayKey`, `sportId`, `status`, `cap`, `sourcesUsed`).
6. **`predictorRuns`**: Execution progress tracking for predictor data pipelines.
7. **`predictorMatches`**: Daily fixture datasets, odds snapshots, and market availability.
8. **`predictorVerdicts`**: AI-generated match reports, citations, and LLM metadata.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Convex CLI**: `npm install -g convex` (or via `npx convex`)
- **Cloudflare Wrangler**: `npm install -g wrangler` (or via `npx wrangler`)

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# Convex Deployment Settings
CONVEX_DEPLOYMENT=prod:modest-lark-218
VITE_CONVEX_URL=https://modest-lark-218.eu-west-1.convex.cloud

# Admin / Tester identities — REQUIRED (no hardcoded fallbacks remain in code).
#   Client build (VITE_*): read by src/lib/authStore.svelte.ts
#   Convex server env (SUPER_ADMIN_EMAIL / TESTER_EMAIL): npx convex env set ...
VITE_SUPER_ADMIN_EMAIL=you@example.com
VITE_TESTER_EMAIL=tester@example.com

# AI Copilot API Keys — server-side ONLY (Cloudflare Pages Function + Convex).
# Never prefix with VITE_ in production — VITE_* values are baked into the
# public JS bundle and readable by anyone.
AGNES_AI_KEY=your_agnes_key_here
OPENROUTER_API_KEY=your_openrouter_key_here

# Flutterwave Payment Integration
VITE_FLW_PUBLIC_KEY=FLWPUBK_TEST-xxxx
FLW_SECRET_KEY=FLWSECK_TEST-xxxx
FLW_SECRET_HASH=your_webhook_hash_secret
```

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/Omaledanjumaogale/Sports-Screener.git
   cd Sports-Screener
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Synchronize SvelteKit Types:**
   ```bash
   npm run prepare
   ```

---

## 🛠️ Development & Operations

### Local Development Server

Run the Vite development server accessible across local network interfaces (`0.0.0.0`):
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Convex Backend Development

Start the Convex dev process to automatically push schema or function changes:
```bash
npx convex dev
```

---

## 🧪 Testing & Quality Assurance

The project includes unit tests, predictor engine tests, Svelte type checks, and Playwright end-to-end smoke testing.

### 1. Type Checking
Run Svelte-Check across all components and TypeScript files:
```bash
npm run check
```

### 2. Unit & Engine Tests (Vitest)
- **Run All Vitest Suites:**
  ```bash
  npm run test
  ```
- **Test Core Mathematical Engine (`engine.ts`):**
  ```bash
  npm run test:engine
  ```
- **Test Predictor Insights & Selections:**
  ```bash
  npm run test:predictor
  ```

### 3. Automated End-to-End Smoke Test (Playwright)
Run the headless smoke test runner (`qa-smoke.mjs`) across landing and all main sport screeners:
```bash
node qa-smoke.mjs
```
*Outputs screenshots (`smoke-landing.png`, `smoke-football.png`, etc.) verifying key UI components, profile cards, odds grids, and master verdict cards.*

---

## 📦 Building & Production Deployment

### 1. Deploy Convex Backend
Push backend functions, indexes, and schema updates to Convex Cloud:
```bash
npx convex deploy
```

### 2. Build Static SPA Production Bundle
Compile the SvelteKit static single-page application into the `dist/` directory:
```bash
npm run build
```

### 3. Preview Production Build Locally
Preview the static build using Vite's preview server:
```bash
npm run preview
```

### 4. Deploy to Cloudflare Pages
Deploy the compiled SPA to Cloudflare Pages:
```bash
npm run wrangler:deploy
```

---

## 🔄 Recent Upgrades & Audit Changelog (August 2026 Pass)

| Category | Upgrade Description | File Reference |
|---|---|---|
| **Convex Auth** | Replaced broken legacy auth with real Convex `auth:signIn` action, wired token to `convexClient.setAuth()`, and added real identity-aware queries/mutations. | [`src/lib/convexClient.ts`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/convexClient.ts) |
| **Live Draft Sync** | Created `drafts` table in Convex for instant cross-device draft backup and retrieval. | [`src/lib/draftSync.ts`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/draftSync.ts), [`convex/drafts.ts`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/convex/drafts.ts) |
| **AI Insights Persistence** | Wired AI copilot outputs from `CloudflareAiBanner` into `SaveHistory` payloads so AI match breakdowns persist in history records. | [`src/lib/components/SaveHistory.svelte`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/components/SaveHistory.svelte) |
| **Offline Queue Engine** | Implemented automatic local queueing (`sportsScreener_pending_*`) for saves and deletes performed while offline, re-uploading upon reconnection. | [`src/lib/components/SaveHistory.svelte`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/components/SaveHistory.svelte) |
| **Scope Tab Cache Fix** | Fixed analysis cache keying in `ScreenerPage.svelte` to force analysis re-computation when switching time scopes (FT → 1H → 2H / Q1 / P1). | [`src/lib/components/ScreenerPage.svelte`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/components/ScreenerPage.svelte) |
| **Master Ledger Calibration**| Corrected Row 1 ledger voting for Over vs. Under candidate profiles in `src/lib/engine.ts`. | [`src/lib/engine.ts`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/engine.ts) |
| **Multi-Sport Storage Clear**| Expanded `clearAllScopeStorage()` utility to purge all 9 supported sports cleanly. | [`src/lib/engine.ts`](file:///c:/Users/OMALE%20DANJUMA%20OGALE/Downloads/SELECTION%20SCREENER/Sports-Screener/src/lib/engine.ts) |

---

## ⚖️ License & Disclaimer

**PulseOdds Sports Screener** is proprietary software designed strictly for informational, analytical, and entertainment purposes. It does not provide gambling services, place real-money wagers, or guarantee sports outcomes. All odds and probability evaluations represent deterministic mathematical transforms of user-provided data.
