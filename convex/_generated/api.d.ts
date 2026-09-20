/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as actionCache from "../actionCache.js";
import type * as agents_agentDefinitions from "../agents/agentDefinitions.js";
import type * as agents_jevEvaluator from "../agents/jevEvaluator.js";
import type * as agents_smoa from "../agents/smoa.js";
import type * as agents_specialists from "../agents/specialists.js";
import type * as apis_sportsApis from "../apis/sportsApis.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as cronHealth from "../cronHealth.js";
import type * as crons from "../crons.js";
import type * as diagnostics from "../diagnostics.js";
import type * as drafts from "../drafts.js";
import type * as email from "../email.js";
import type * as errorLog from "../errorLog.js";
import type * as featureFlags from "../featureFlags.js";
import type * as http from "../http.js";
import type * as hygiene from "../hygiene.js";
import type * as internal_retentionProbe from "../internal/retentionProbe.js";
import type * as jev from "../jev.js";
import type * as llm from "../llm.js";
import type * as predictor from "../predictor.js";
import type * as predictorOrchestrator from "../predictorOrchestrator.js";
import type * as presence from "../presence.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as rateLimit from "../rateLimit.js";
import type * as retention from "../retention.js";
import type * as retentionPolicy from "../retentionPolicy.js";
import type * as savedScreeners from "../savedScreeners.js";
import type * as scores from "../scores.js";
import type * as scrapers_betwatch from "../scrapers/betwatch.js";
import type * as scrapers_brightdata from "../scrapers/brightdata.js";
import type * as scrapers_dataQuality from "../scrapers/dataQuality.js";
import type * as scrapers_firecrawl from "../scrapers/firecrawl.js";
import type * as scrapers_fixtures from "../scrapers/fixtures.js";
import type * as scrapers_jinaReader from "../scrapers/jinaReader.js";
import type * as scrapers_normalize from "../scrapers/normalize.js";
import type * as scrapers_pages from "../scrapers/pages.js";
import type * as scrapers_serper from "../scrapers/serper.js";
import type * as scrapers_sources from "../scrapers/sources.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  actionCache: typeof actionCache;
  "agents/agentDefinitions": typeof agents_agentDefinitions;
  "agents/jevEvaluator": typeof agents_jevEvaluator;
  "agents/smoa": typeof agents_smoa;
  "agents/specialists": typeof agents_specialists;
  "apis/sportsApis": typeof apis_sportsApis;
  auditLog: typeof auditLog;
  auth: typeof auth;
  cronHealth: typeof cronHealth;
  crons: typeof crons;
  diagnostics: typeof diagnostics;
  drafts: typeof drafts;
  email: typeof email;
  errorLog: typeof errorLog;
  featureFlags: typeof featureFlags;
  http: typeof http;
  hygiene: typeof hygiene;
  "internal/retentionProbe": typeof internal_retentionProbe;
  jev: typeof jev;
  llm: typeof llm;
  predictor: typeof predictor;
  predictorOrchestrator: typeof predictorOrchestrator;
  presence: typeof presence;
  pushSubscriptions: typeof pushSubscriptions;
  rateLimit: typeof rateLimit;
  retention: typeof retention;
  retentionPolicy: typeof retentionPolicy;
  savedScreeners: typeof savedScreeners;
  scores: typeof scores;
  "scrapers/betwatch": typeof scrapers_betwatch;
  "scrapers/brightdata": typeof scrapers_brightdata;
  "scrapers/dataQuality": typeof scrapers_dataQuality;
  "scrapers/firecrawl": typeof scrapers_firecrawl;
  "scrapers/fixtures": typeof scrapers_fixtures;
  "scrapers/jinaReader": typeof scrapers_jinaReader;
  "scrapers/normalize": typeof scrapers_normalize;
  "scrapers/pages": typeof scrapers_pages;
  "scrapers/serper": typeof scrapers_serper;
  "scrapers/sources": typeof scrapers_sources;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
