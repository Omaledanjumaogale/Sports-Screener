# PulseOdds application audit and release assessment

Date: 2 October 2026 (Africa/Lagos). Canonical application: Sports-Screener.

## Release assessment

The application has substantial implemented functionality, but enterprise production readiness is not established. This audit makes concrete security, integration, authentication and landing-page changes. Local passing checks do not certify a live deployment, every authenticated interaction, financial settlement, or predictive profitability. No live deployment, real charge, bulk data migration or privileged account creation was performed.

The older AUDIT.md is historical: its statements that client-trusting payment and identity shortcuts are acceptable must not be used as release approval.

## Implemented application inventory

| Area | Existing implementation | Assessment |
| --- | --- | --- |
| Landing | Sport directory, pricing, framework explanation, agent showcase, theme, navigation, lazy Three.js scene | Implemented; new generated artwork and mobile visibility fixes added |
| Screeners | Football, basketball, tennis, table tennis, hockey, baseball, rugby, cricket, MMA, volleyball, instant football, instant basketball, virtual football | All 13 route wrappers exist and share ScreenerPage; engine test coverage exists. Per-sport authenticated input/analysis/save workflows still need staging acceptance |
| Predictor | Overview, sport views and match detail; source scraping, normalization, quality gates, consensus, score grading | Implemented; live feed freshness and out-of-sample predictive performance remain unverified |
| Accounts | Password authentication, persisted access/refresh tokens, renewal, authoritative access lookup, account profiles | Implemented; corrected failed-profile handling, server flags, return routing and reserved-account provisioning protection |
| Tester program | Issued codes, public registration, shared tester credential, device binding, 90-day trials, admin revoke/suspend/reactivate/approve, presence | Implemented; corrected lost Master Pass fields and stale validation responses. Shared credentials remain an architectural limitation |
| Billing | Flutterwave checkout, verification action, webhook, subscription ledger and expiry | Implemented; corrected signed-in account binding, verified reference checks, replay handling and Master Pass amount threshold |
| Saved work | Local history/drafts, offline queues, Convex synchronization and bet slips | Implemented; closed caller-supplied ownership and by-ID authorization gaps; removed invalid draft arguments |
| Administration | Tester/account management, performance snapshots, feature flags, audit events, hygiene/retention, cron health | Implemented; gated diagnostics, error-log reads and pending recovery-token counts |
| Notifications | Push subscription storage/preferences | Partial: pushSubscriptions.ts explicitly leaves VAPID delivery for future work |
| Operations | CI checks, static Cloudflare build, PWA assets and audit/uptime workflows | Exists; backup restoration, capacity, live alerts and release rollback not verified |

## Changes made in this audit

1. Cloud drafts and saved history now require verified Convex authentication. Browser session IDs and userId arguments cannot grant access. The saved-by-ID query checks ownership.
2. Anonymous callers can no longer read, update or delete bet slips by ID. Grading now persists a newly resolved grade even when a final score was already stored.
3. Ordinary-account new writes use a stable account ID; shared tester records retain auth-session isolation. Current-session legacy records remain readable. Older records from other sessions need a controlled migration; anonymous legacy cloud rows are intentionally inaccessible through public APIs.
4. Removed the unsupported owner argument from both draft-upload paths; it was rejected by the Convex validator and silently queued forever.
5. Login propagates hasMasterPass, subscriptionTier, testerCode and testerReason from the server. Client email configuration no longer overrides the server's admin/tester verdict. A failed profile save or access lookup no longer reports a successful completed login.
6. Login guards preserve requested destinations and ignore arbitrary localStorage presence as authorization. The shared ScreenerPage guard no longer competes with the shell by sending all visitors to signup/checkout. Tester identity discovery works even when the frontend tester-email variable is missing.
7. Copilot requests carry a refreshed bearer token. Pages middleware verifies an active pass through Convex and an atomic 12-request/minute/session budget before contacting AI providers. Missing verification configuration or an outage fails closed. wrangler.toml supplies the public backend URL; provider secrets remain server configuration.
8. Payment verification requires the signed-in account to match the submitted and verified customer email. It verifies tx_ref against the provider response. Already-applied successful references cannot extend access again. Master Pass starts at NGN 10,000 rather than NGN 9,500.
9. Reserved admin/tester email signup requires the matching server-configured provisioning password. New account emails are normalized; existing case-sensitive account login remains supported. Existing privileged account seeding remains compatible when those environment secrets are configured.
10. Password recovery now uses actions for external email delivery, cryptographic 192-bit random codes, SHA-256 token digests, uniform public responses, issuance/verification limits, atomic single-use consumption and session invalidation. Added /auth/reset and a login recovery link. RESEND_API_KEY and sender-domain delivery must be verified on staging.
11. Frontend and backend calibration averages now exclude pushes, matching the sample used for observed win rate. Backend rollup weighting uses resolved selections consistently. Added a regression with a pushed selection and a resolved selection at different predicted probabilities.
12. Created two original landing artworks with the built-in image generator, retained PNG sources and generated optimized WebP derivatives. Added responsive hero imagery and a consensus feature section, dimensional borders/shadows and restrained hover motion. Prompts: cinematic football/basketball/tennis still life on graphite platforms with emerald/cyan trajectories; floating glass prism with orbital signal nodes. Neither artwork claims actual predictive performance.
13. Three.js loading now cancels work on unmount, releases its capability-probe context, observes tab visibility and respects reduced motion. Added a physically shaded rotating geometric core, two orbital meshes and colored scene lights; generated textures are disposed on teardown. Reveal animations use an attainable threshold for tall mobile sections and leave content visible under reduced motion. Background usage heartbeats no longer count hidden tabs.
14. Updated SvelteKit within version 2, Vitest, Lighthouse and Wrangler, refreshed vulnerable transitive packages, and pinned a patched compatible cookie override. The final dependency scan reports zero known vulnerabilities. Added reproducible npm peer-resolution configuration after checking required framework/runtime compatibility. Updated the PWA audit for Lighthouse 13's removed PWA category: manifest and controlling service-worker prerequisites are checked directly with Playwright.
15. Public error telemetry uses bounded source names and a global request budget; arbitrary metadata and URL query/hash values are removed to limit storage growth and accidental credential logging.
16. Separated the static adapter's SPA fallback (200.html) from the pre-rendered homepage (index.html), which the old build overwrote. Added explicit Cloudflare rewrites for account, screener, administration and predictor routes while retaining the rendered homepage and static asset routes. The 3D bundle is loaded after the first gesture while its section is visible. Off-screen landing sections use content visibility containment to reduce initial layout work.

## Remaining release requirements

**Follow-up execution:** see [RELEASE-EXECUTION-2026-10-02.md](RELEASE-EXECUTION-2026-10-02.md) for implemented fixes, live deployment/credential/data work and the requirements still awaiting external acceptance. The table below records findings before that follow-up, not the current completion state.

| Priority | Requirement | Evidence / next verification |
| --- | --- | --- |
| P0 | Deploy and verify backend before the protected Copilot edge/frontend release | New users:authorizeCopilot function and recovery actions must be present on the target Convex deployment. Verify correct public URL and server environment |
| P0 | Authenticated staging acceptance matrix | Real admin, ordinary unsubscribed user, Punter, Master, active/expired/revoked/suspended tester; wrong code/device; signup profile failure; session expiry; logout; all 13 screeners; predictor overview/sport/detail; bet slips |
| P0 | Validate payment settlement with provider sandbox | Wrong customer/reference/currency/amount; repeated and concurrent webhook/verification; delayed webhook; missing profile; interrupted network. Webhook still trusts a valid legacy verif-hash event payload; confirm the account's configured signature scheme and reverify before fulfillment |
| P0 | Inventory and rotate previously exposed credentials | Historical audit documents committed/obfuscated secrets. Verify Git history and live provider credentials without printing secrets. Do not assume removing a value from current source revokes it |
| P1 | Migrate legacy cloud ownership deliberately | Session-scoped rows from old sessions are not automatically discovered by account-indexed list queries. Use an audited admin/internal migration with dry-run counts; never restore browser-supplied ownership bypasses |
| P1 | Replace shared tester account with individual identities | Preferred password stored in testerCodes is not an authentication credential. Device ID is browser storage, not hardware attestation. Shared credentials restrict revocation, MFA, attribution and cross-device isolation |
| P1 | Protect tester PII and registration abuse | Raw NIN remains in testerCodes; hashSecret includes an unsafe FNV fallback and is not a password KDF. Minimize collected data, remove unused password fingerprints, define access/retention and migrate legacy rows. Add edge limits for public code lookup/registration |
| P1 | Recovery delivery acceptance | Configure and verify sender-domain/email delivery; test token reuse, expiry, rate limits, case-sensitive legacy emails, delivery failure and session invalidation. A consumed token must be requested again if credential rotation fails |
| P1 | Remove optimistic checkout expiry | Backend settlement is idempotent, but checkout still temporarily assigns a local 30-day expiry before refreshing server access. Render the persisted access result, including replayed or expired transactions, and handle refresh failure explicitly |
| P1 | Complete push delivery or label unavailable | Storage alone does not deliver VAPID notifications; verify permission denial, unsubscription and expired endpoints |
| P1 | Reduce unbounded data operations | Several list/admin/score-grading paths collect whole tables. Introduce pagination, bounded scheduled batches, load tests and database budget alerts |
| P1 | Establish prediction evidence | Store immutable pre-kickoff predictions and model/data versions; evaluate held-out seasons and leagues, calibration/Brier score/log loss, sample sizes, ROI after fees and odds movement. Current retrospective recomputation is not proof of future profitability |
| P1 | Security headers and runtime validation | Add and test a practical Content Security Policy for Convex, Three.js and Flutterwave; enforce actual body-size/message validation beyond a Content-Length check. Validate telemetry quota sizing under real load |
| P1 | Deployment and operational resilience | Verify backups/restoration, monitoring alerts, paid quotas, availability targets, recovery objectives, incident response and rollback. Browser measurements are local checks, not production capacity evidence |
| P2 | Visual/performance acceptance across devices | Verify keyboard/screen-reader flows, both themes, low-memory WebGL devices, real touch devices, reduced motion and production Core Web Vitals. The original scene still uses emoji sprites and can be refined with designed meshes |

## Prediction and confidence interpretation

A confidence percentage is a model output. It is not a guaranteed win rate or a promised winning streak. Odds-derived models and multiple agents can share the same underlying evidence; agreement does not make their estimates independent. Publish measured calibration beside the estimate with sample size, market, sport, date range and data-quality status. Changes in this audit correct a reporting calculation; they do not assert increased predictive accuracy.

## Validation record

Baseline: 27 suites; 340 passed, 1 skipped; Svelte check 0 errors / 0 warnings.

Security regression coverage added for ownership rejection, stable/legacy record ownership, shared tester session isolation, Copilot anonymous/origin/entitlement/quota/outage gates and non-push calibration. Unit tests: 29 suites, 350 passed, 1 skipped. Svelte check: zero errors / zero warnings. Convex typecheck: passed. npm ci dry run: passed.

Browser audit before the homepage fallback correction: 28/28 checks passed, covering 390px/768px/1440px image loading and overflow, reduced-motion content visibility, normal-motion tall-section visibility, anonymous guards for all 13 screener routes plus admin/bet slip/predictor, four public account forms and uncaught errors. PWA manifest/service-worker/offline reload: passed. Initial measured local mobile Lighthouse scores: performance 67, accessibility 96, best practices 100. That performance result prompted the homepage pre-render correction; it is not represented as enterprise-grade performance. Final post-correction results are recorded below.

Dependency audit initially reported 22 advisories (14 high, 6 moderate, 2 low; 0 critical). Both npm 11 and npm 10 encountered an Arborist edgesOut failure while resolving optional peers. After verifying peer/runtime compatibility, targeted updates and legacy-peer resolution succeeded. Final audit: zero vulnerabilities. npm ci dry run succeeds with the committed configuration. This scan covers known registry advisories, not every possible application vulnerability.

Generated asset sources and derivatives: static/images/sports-intelligence-v1.png, sports-intelligence-v1.webp, sports-intelligence-mobile-v1.webp, consensus-intelligence-v1.png and consensus-intelligence-v1.webp. Built-in image generation was used; no API-key CLI fallback.

Final image prompts:

- Hero: "Create a premium panoramic sports analytics website artwork, cinematic realistic 3D still life: football, basketball and tennis ball on dark graphite sculptural platforms with subtle emerald and cyan illuminated trajectory lines, dramatic stadium lighting, refined realistic materials, generous dark negative space, no text, no logos, no numbers. Wide landscape composition for PulseOdds landing page, sophisticated editorial product photography."
- Consensus section: "Premium editorial 3D illustration for sports analytics website feature section. Dark graphite background, a floating frosted glass prism surrounded by subtle emerald and cyan orbital paths and small luminous nodes, precise geometric architecture, dramatic realistic studio lighting, refined fintech aesthetic, no text no numbers no logos no fake user interface, landscape 3:2 composition."

Final local verification after accessibility edits: Svelte check 0 errors / 0 warnings; production build passed; git diff whitespace check passed. Browser audit 31/31 passed on a fresh preview, including predictor overview/sport/detail redirects and preservation of query parameters. Manifest, controlling service worker and offline shell reload passed. Public form rendering and anonymous guards were verified; real authenticated account/provider flows were not exercised.

Latest mobile Lighthouse result: performance 45, accessibility 96, best practices 100; LCP 4.6 seconds and total blocking time 2,360 ms. The earlier isolated post-optimization run scored performance 69; the final run overlapped browser auditing on this workstation. These variable local scores are evidence that performance acceptance remains unresolved, not a production performance guarantee. Reduce initial DOM/font/hydration work and benchmark serially on controlled devices and the deployed origin. Accessible names were aligned with visible labels and light-theme accent/WhatsApp contrast improved, but remaining accessibility findings still require review. Actual animated WebGL rendering after a user gesture also needs device acceptance.

Release sequence: use Node 22.19 or newer; run the committed install/check/test/build gates; deploy the new Convex functions first; verify environment configuration and authenticated staging flows; publish Pages assets/functions together; verify route rewrites, Copilot authorization, payments, recovery delivery, PWA behavior and monitoring on the deployed origin. The local Vite preview serves assets but does not execute Cloudflare Pages middleware; edge authorization is covered by the mocked middleware regression tests until staging verification.

## Reference checks

- [Convex authentication identity contract](https://docs.convex.dev/api/interfaces/server.Auth)
- [Convex Auth authorization and session helpers](https://github.com/get-convex/convex-auth/blob/main/docs/pages/authz.mdx)
- [Flutterwave transaction verification](https://developer.flutterwave.com/docs/transaction-verification)
- [Flutterwave webhook handling](https://developer.flutterwave.com/docs/webhooks)
- [Cloudflare Pages route rewrites](https://developers.cloudflare.com/pages/configuration/redirects/)

The installed Password provider source was also inspected for its profile hook, Scrypt hashing and credential/session APIs.
