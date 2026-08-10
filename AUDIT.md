# PulseOdds Sports Screener — Audit & Convex Synchronization Report

> Generated: Aug 2026 · App: SvelteKit static SPA (Cloudflare Pages) + Convex backend
> Convex deployment: `https://modest-lark-218.eu-west-1.convex.cloud` (`prod:modest-lark-218`)

---

## 1. Executive summary

The app is a **9-sport betting screener** (football, basketball, tennis, rally/table-tennis,
hockey, instant-football, instant-basketball, virtual-football, baseball) whose screening engine
runs entirely in the browser. A **Convex backend already existed** for saved screener history,
user profiles, and Flutterwave webhooks — but the frontend↔backend integration was partial,
broken in places, and left several high-impact bugs and security gaps.

This pass **synchronized the whole app to Convex** and fixed the most serious audit findings:

1. Real Convex auth (Password provider) is now actually invoked and its token is attached to the
   Convex client (`setAuth`), so the backend can finally see `ctx.auth.getUserIdentity()`.
2. **Live screener drafts** now sync to a new Convex `drafts` table (device-to-cloud, cloud-to-device,
   offline queue), not just localStorage.
3. **Saved screener history** got an offline op-queue, automatic re-sync of offline (`ls_`) records,
   anonymous→user record merging, an infinite-recursion fix, and **AI Copilot insights are now
   actually persisted** (previously the save payload always dropped them).
4. Fixed the stale-verdict-across-scope-tabs bug, the Over-bias in the master ledger, and the
   incomplete "clear all storage" sport list.
5. Deployed the new backend and verified every function live.

---

## 2. Architecture (as-is after this pass)

```
Browser (SPA)                       Convex (cloud)
────────────────────────────        ──────────────────────────────
engine.ts  (analysis, all client-side)
   │  scopes state
   ├─ localStorage  sportsScreener_v1_<sport>   (instant layer, offline)
   └─ draftSync.ts ──────────────▶ drafts:get / drafts:save    (drafts table)
SaveHistory.svelte ─────────────▶ savedScreeners:list/save/remove
auth/+page.svelte ──(action)────▶ auth:signIn / auth:signOut   (Password provider)
authStore (localStorage session) ▶ convexClient.setAuth(token) → identity-aware calls
checkout/+page.svelte ──────────▶ users:markSubscribed
convex/http.ts ◀──(webhook)───── Flutterwave  charge.completed
AI Copilot: browser ──▶ /api/ai-analyze (CF Pages Function) ──▶ Agnes/OpenRouter
```

Data is intentionally two-tiered: **localStorage = instant + offline**, **Convex = source of truth /
cross-device**. Drafts and history both write-through to Convex when reachable and queue when not.

---

## 3. Audit findings — issues fixed in this pass

### 3.1 Convex auth was vestigial / broken
- `auth/+page.svelte` called `client.mutation('auth:signIn', {email, password, flow})`.
  `@convex-dev/auth` registers `auth:signIn` as an **action** taking `{provider, params, …}`;
  the old call always threw and was silently swallowed, so nobody was ever authenticated.
  **Fixed** → `client.action('auth:signIn', { provider: 'password', params: { flow, email, password } })`
  via new `convexSignIn()` helper, with graceful fallback to the local emulated session (admin/tester/dev).
- The signIn token was saved to localStorage but **never attached** to the Convex client.
  **Fixed** → `convexClient.setConvexAuthToken()` is now called on restore/login and cleared on logout;
  `convexSignOut()` (the old `// TODO: call convex client sign out` in `+page.svelte`) is wired up.
- Server handlers never read `ctx.auth.getUserIdentity()`. **Fixed** → `savedScreeners.ts` and the new
  `drafts.ts` resolve ownership from the attached identity, falling back to `sessionId`/`userId` args.
- **Guard added:** only real Convex JWTs (>40 chars, not `token_…`) are attached — a legacy fake token
  previously 401'd every anonymous call.

### 3.2 Data only in localStorage → now synchronized to Convex
| Data | Before | After |
|---|---|---|
| Live screener drafts (`scopes`) | localStorage only, lost on device change | `drafts` table sync (pull on load if local empty, debounced push on edit) |
| AI Copilot insights | **never saved** (`aiResult` prop not passed to `SaveHistory`) | hoisted via `CloudflareAiBanner.onResultChange` → persisted in `verdict.aiInsights` |
| Offline history records (`ls_…`) | never uploaded | uploaded to Convex on next successful `list`, then removed locally |
| Failed online saves/deletes | infinite-recursion risk | queued in `sportsScreener_pending_<sport>_v1` and replayed |

### 3.3 Schema drift
- `savedScreeners.verdict` was a strict `v.object({headline, chips, topPick})` while the client always
  wrote `masterLedger` + `aiInsights`. **Fixed** → `verdict: v.optional(v.any())` so the full payload
  (ledger, AI insights, future fields) is stored without validation drift.

### 3.4 Functional bugs fixed
- **Stale verdict across scope tabs** (`ScreenerPage.svelte`): the analysis cache key now includes
  `selectedScopeIndex`, so switching FT→HT→Q1 recomputes instead of showing the previous scope's verdict.
- **Master ledger Row 1 never agreed for Over candidates** (`engine.ts`): `find(p => p.key==='A'||'B')`
  always returned A; now Over→profile B, Under→profile A are selected explicitly.
- **`clearAllScopeStorage()` only cleared 5 of 9 sports** → now all 9.
- **`SaveHistory` submitSave infinite recursion** → guarded with `fallbackInProgress`.

### 3.5 Security notes (improved, remaining acceptable-by-design)
- Webhook secret, admin password, tester password remain in the repo (obfuscated base64). The tester
  account and "Already Paid?" activation button are intentional demo/admin flows of this donation model.
- `users:markSubscribed` / `checkSubscription` are still client-trusting (email-string based) because the
  subscription is a donation pass; hardening these requires mandatory real auth on every user, which is a
  product decision. The webhook layer verifies `verif-hash` and now should also be pointed at the real
  `FLW_SECRET_HASH` from `.env.local` instead of the committed fallback.

---

## 4. New / changed files

### Backend (`convex/`)
| File | Change |
|---|---|
| `convex/schema.ts` | Added `drafts` table (owner/sessionId/userId/sportId/scopes/updatedAt, 3 indexes); `savedScreeners.verdict` → `v.any()`; exported `SPORT_IDS` union |
| `convex/drafts.ts` | **new** — `get` / `save` / `remove` (identity-aware with session fallback) |
| `convex/savedScreeners.ts` | `list` merges user-owned + session-owned records (pre-login saves no longer "vanish"); `save`/`update`/`remove` resolve ownership from identity |
| `convex/_generated/*` | regenerated by `npx convex deploy` |

### Frontend (`src/`)
| File | Change |
|---|---|
| `src/lib/convexClient.ts` | `setAuth/clearAuth/action` on the HTTP client; `setConvexAuthToken` (real-JWT guard); `convexSignIn` / `convexSignOut`; `api.drafts.*` + `api.auth.*`; `DraftDoc` type |
| `src/lib/authStore.svelte.ts` | attaches/clears Convex token on restore, login, logout |
| `src/lib/draftSync.ts` | **new** — `pushDraft`, `pullDraft`, `flushPendingDrafts`, offline queue |
| `src/lib/components/ScreenerPage.svelte` | non-blocking draft sync on mount; `scheduleDraftPush()` on edits/clear; stale-tab analysis fix; hoists `aiResult` → `SaveHistory` |
| `src/lib/components/CloudflareAiBanner.svelte` | new `onResultChange` callback bubbles latest result |
| `src/lib/components/SaveHistory.svelte` | offline op-queue, `ls_` upload on reconnect, recursion guard, queued deletes |
| `src/lib/engine.ts` | ledger Row-1 fix; `clearAllScopeStorage` covers all 9 sports |
| `src/routes/auth/+page.svelte` | real Convex `auth:signIn` action call (with fallback) |
| `src/routes/+page.svelte` | sign-out now calls `convexSignOut()` |
| `qa-smoke.mjs` | seeds tester session; ignores dev-only AI network noise |

---

## 5. Remaining recommendations (not done — product decisions / bigger scope)

1. **Enforce real auth for everyone.** Move the admin/tester special-cases into Convex (`userProfiles`
   gains `isTester`, `trialStartsAt`) and require a Convex identity for screener access. Then harden
   `users:*` mutations with `ctx.auth` checks and drop client-forged `userId`/`email` arguments.
2. **Verify Flutterwave transactions server-side.** Call Flutterwave's verify API on the webhook using
   `FLW_SECRET_KEY`; require `amount === 5000` and currency NGN; use the real `FLW_SECRET_HASH` from env.
3. **Remove the free "Already Paid? Confirm & Activate" button** from production checkout (it bypasses
   payment); keep it behind an env flag for demos.
4. **Move the super-admin password & tester password to env** (they ship in the JS bundle today).
   *(Partially done 2026-08-10: the hardcoded `SUPER_ADMIN_EMAIL`/`TESTER_EMAIL` fallbacks were
   removed from `convex/users.ts` and `src/lib/authStore.svelte.ts` — admin/tester recognition now
   requires the `SUPER_ADMIN_EMAIL`/`TESTER_EMAIL` Convex env vars and `VITE_SUPER_ADMIN_EMAIL`/
   `VITE_TESTER_EMAIL` at build time. Remaining credential defaults still need moving to env.)*
5. **Move the AI call fully server-side** — **DONE (2026-08-10)**: removed the client-side
   `VITE_AGNES_AI_KEY`/`VITE_OPENROUTER_API_KEY` reads and the Agnes/OpenRouter direct browser
   fallbacks from `src/lib/cloudflareAi.ts`; the client now calls only the `/api/ai-analyze` Pages
   Function, which keeps keys server-side.
6. Consider a proper **client for real-time** (Convex `useQuery`-style subscriptions) if multi-tab/multi-device
   live sync is wanted; today one-shot HTTP + pull-on-load is used (deliberate, keeps the SPA static).

---

## 5b. AI Predictor overhaul — country prefixes, market math & verification (2026-08-10)

### Fixture identification
- New `src/lib/leagueCountries.ts` renders every league as `"[Country] - [League]"`
  (e.g. `England - Premier League`, `Spain - La Liga`) across the match card, the
  day's league-group headers on the predictor page, and the match detail page.
  Mapping order: international/continental competitions (UEFA, NBA, NHL, ATP, UFC…) are
  left unprefixed; inline country adjectives (`Egyptian Premier League` → Egypt) and
  country names (`Colombia: Primera A`) win over generic league keywords (`Serie A` →
  Italy, but `Brazil Serie A` → Brazil). Unmapped leagues pass through untouched.

### Predictive logic overhaul (root causes of the away/away-+0.5 bias)
- **Hash-coinflip odds removed.** `uniqueFallbackOdds` previously picked the favourite with
  `hash % 2` and priced a wide fav/dog gap; combined with the single derived `-0.5` AH line
  this flipped entire cards onto the away side and painted every away-lean as `Away +0.5`.
  Fallbacks are now balanced, modest-gap odds with one unbiased coin-flip per match.
- **Full Asian Handicap ladder.** `deriveFootballMarkets` now prices every standard line
  (`-1.5 … +1.5`, quarter-goal steps) from ONE calibrated Poisson goal grid
  (`buildFootballGrid`) instead of a hardcoded `-0.5`. Whole/half lines win outright,
  quarter lines split the stake; prices de-vig back to the de-vigged 1X2. Soccer now also
  carries an **Over/Under goals ladder (0.5–4.5)** and a **Both Teams To Score** market
  (BTTS) plus the existing Double Chance — all marked `derived` so they inform analysis
  but never gate Amara's confidence floor on their own.
- **Single-team edge enforced.** The Great Minds verdict's spread pick is reconciled to the
  result favourite — a spread pick pointing at the *other* team is dropped and a
  same-direction spread is used instead, so a match never shows "Home Win **and** Away
  +0.5". Markets are also strictly classified (result/winner vs handicap vs total), so a
  totals pick can no longer masquerade as the winner pick.
- **No fabricated probabilities.** Great Minds fallbacks now default to a neutral 50% (not
  hash-derived 55–68%) and the total consensus pick selects the *fair line* (the pair
  straddling 50%) instead of a derived extreme like Over 0.5 @ 92%.

### Multi-stage verification gate (pre-qualification)
Every consensus pick must pass all three independent cross-checks before it can carry a
Top/Strong/Qualifying signal; failures are demoted to **Reference Only**:
1. **Data integrity** — the selection traces to a real engine pick priced from real odds.
2. **Computation accuracy** — Real Win Chance sits in the documented band around the engine
   base probability and the EV recomputes to the same figure.
3. **Single-team edge** — exactly one team holds the edge; winner and spread agree.
The debate-level `realWinChanceTag` is computed from qualified picks only.

### Monitoring
- Track `qualified` + `verification.stages` on `consensusPicks.*` per match; a rising share of
  `Reference Only` verdicts signals falling real-odds coverage (add API keys / fix the reader
  chain). Track post-match grades (`resolvedVerdict.winRatePct`) per sport and per market and
  compare against the published `realWinChancePct` band — publish the drift in the daily P&L
  summary. Re-run `diagnostics:diagnoseFixturePages` after adding reader keys.

---

## 6. Verification performed

- `npx convex typecheck` ✅
- `npx convex deploy` ✅ → deployed to `https://modest-lark-218.eu-west-1.convex.cloud`
- Live smoke against deployed backend ✅ (drafts save/get/remove, savedScreeners save/list/remove incl.
  `aiInsights`, users:checkSubscription, auth:signIn action present)
- `npm run check` ✅ (0 errors/warnings)
- `npm run build` ✅
- `node qa-smoke.mjs` ✅ (landing + all 5 main sport screeners: 4 profile cards, markets, verdicts)

## 7. Deploy command

```bash
npx convex deploy      # push Convex backend (already run — run again after future backend edits)
npm run build          # build the static site
npm run wrangler:deploy  # deploy the SPA to Cloudflare Pages
```
