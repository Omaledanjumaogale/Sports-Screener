// End-to-end verification of the tester access-code system against the LIVE
// Convex deployment. Proves, in order:
//
//   1. the super admin can generate a code (and only the admin can)
//   2. an unregistered code cannot be activated
//   3. registration claims the code and stores the tester's details
//   4. the first device binds the code and starts the 3-month trial
//   5. a SECOND device is refused
//   6. the tester holds Master Pass (AI Predictor readable) but NOT admin
//   7. revoking the code immediately removes access
//
// Usage: node scripts/tester-verify.cjs
"use strict";
var fs = require("fs");
var path = require("path");
var { ConvexHttpClient } = require("convex/browser");
var anyApi = require("convex/server").anyApi;

var envMap = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/).forEach(function (l) {
  var t = l.trim(); if (!t || t[0] === "#") return;
  var eq = t.indexOf("="); if (eq > 0) envMap[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

var results = [];
function ok(label, detail) { results.push({ pass: true, label: label }); console.log("  PASS  " + label + (detail ? "  → " + detail : "")); }
function fail(label, detail) { results.push({ pass: false, label: label }); console.log("  FAIL  " + label + (detail ? "  → " + detail : "")); }
function expect(label, cond, detail) { if (cond) ok(label, detail); else fail(label, detail); }

// IMPORTANT: on a PRODUCTION Convex deployment the `message` of a thrown error
// is REDACTED for the client ("[Request ID: …] Server Error") — even for a
// ConvexError. The user-facing text arrives in `error.data`. Anything reading
// `.message` here would report a false failure.
function msgOf(e) {
  if (!e) return "";
  if (typeof e.data === "string") return e.data;
  if (e.data && typeof e.data.message === "string") return e.data.message;
  return String(e.message || e);
}

function dayKeyWat() {
  return new Date(Date.now() + (new Date().getTimezoneOffset() ? 3600e3 : 3600e3)).toISOString().slice(0, 10);
}

async function main() {
  var url = envMap.PUBLIC_CONVEX_URL;
  var admin = new ConvexHttpClient(url);
  var tester = new ConvexHttpClient(url);

  console.log("Tester access-code end-to-end verification\n");

  // ── 1. Admin sign-in + code generation ───────────────────────────────────
  var adminAuth = await admin.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var adminTok = adminAuth && adminAuth.tokens && (adminAuth.tokens.token || (Array.isArray(adminAuth.tokens) && adminAuth.tokens[0] && adminAuth.tokens[0].value));
  if (!adminTok) { fail("admin sign-in", "no token"); process.exit(1); }
  admin.setAuth(adminTok);
  ok("admin sign-in");

  var gen;
  try {
    gen = await admin.mutation(anyApi.testerCodes.generate, { count: 1, label: "AUTOTEST", batch: "verify-script" });
  } catch (e) { fail("admin generates a code", String(e.message || e)); process.exit(1); }
  var CODE = gen.codes[0];
  expect("admin generates a code", /^PDT-[A-Z2-9]{4}-[A-Z2-9]{5}$/.test(CODE), CODE);

  // ── 2. Unregistered code cannot be activated ─────────────────────────────
  var testerAuth = await tester.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", email: envMap.TESTER_EMAIL, password: envMap.TESTER_PASSWORD }
  });
  var testerTok = testerAuth && testerAuth.tokens && (testerAuth.tokens.token || (Array.isArray(testerAuth.tokens) && testerAuth.tokens[0] && testerAuth.tokens[0].value));
  if (!testerTok) { fail("tester sign-in", "no token"); process.exit(1); }
  tester.setAuth(testerTok);
  ok("tester sign-in (shared tester account)");

  var blockedBefore = false, beforeMsg = "";
  try { await tester.mutation(anyApi.testerCodes.activateSession, { code: CODE, deviceId: "device-aaaaaaaaaaaa" }); }
  catch (e) { beforeMsg = msgOf(e); blockedBefore = /not been registered/i.test(beforeMsg); }
  expect("unregistered code is refused at login", blockedBefore, beforeMsg.slice(0, 90));

  // ── 3. Registration claims the code ──────────────────────────────────────
  var unique = Date.now().toString().slice(-6);
  var reg;
  try {
    reg = await tester.mutation(anyApi.testerCodes.register, {
      code: CODE,
      fullName: "Autotest Verifier",
      nin: "12345678901",
      testerEmail: envMap.TESTER_EMAIL,
      actualEmail: "autotest+" + unique + "@pulseodds-test.invalid",
      preferredPassword: "Preferred!Pass9",
      mobile: "+2348012345678",
      stateOfResidence: "Lagos",
      consentAccepted: true
    });
  } catch (e) { fail("registration claims the code", String(e.message || e)); process.exit(1); }
  expect("registration claims the code", reg.status === "claimed", "trial " + reg.trialDays + " days");

  // ── 4. First device binds and starts the trial ───────────────────────────
  var act;
  try {
    act = await tester.mutation(anyApi.testerCodes.activateSession, {
      code: CODE, deviceId: "device-aaaaaaaaaaaa", deviceLabel: "Chrome · Windows"
    });
  } catch (e) { fail("first device activates", String(e.message || e)); process.exit(1); }
  var expectedDays = 90;
  var gotDays = act.daysRemaining;
  expect("first device activates and starts the trial", act.ok && Math.abs(gotDays - expectedDays) <= 1,
    "trial expires in " + gotDays + " days (expected ~" + expectedDays + ")");

  // ── 5. A second device is refused ────────────────────────────────────────
  var secondBlocked = false, secondMsg = "";
  try { await tester.mutation(anyApi.testerCodes.activateSession, { code: CODE, deviceId: "device-bbbbbbbbbbbb" }); }
  catch (e) { secondBlocked = true; secondMsg = msgOf(e); }
  expect("a second device is refused", secondBlocked && /another device/i.test(secondMsg), secondMsg.slice(0, 110));

  // ── 6. Master Pass, but never admin ──────────────────────────────────────
  var me = await tester.query(anyApi.users.me, {});
  expect("tester holds Master Pass", me.hasMasterPass === true && me.isTester === true,
    "code=" + (me.testerCode || "-"));
  expect("tester is NOT an admin", me.isAdmin === false);

  var adminOnlyBlocked = false, adminOnlyMsg = "";
  try { await tester.query(anyApi.testerCodes.overview, {}); }
  catch (e) { adminOnlyMsg = msgOf(e); adminOnlyBlocked = /Admin access required/i.test(adminOnlyMsg); }
  expect("tester cannot read the admin console data", adminOnlyBlocked, adminOnlyMsg.slice(0, 90));

  var canGenerate = false;
  try { await tester.mutation(anyApi.testerCodes.generate, { count: 1 }); canGenerate = true; }
  catch (_) { canGenerate = false; }
  expect("tester cannot generate access codes", !canGenerate);

  var dk = dayKeyWat();
  var predictOk = false, predictErr = "";
  try {
    await tester.query(anyApi.predictor.listMatches, { sportId: "football", dayKey: dk });
    predictOk = true;
  } catch (e) { predictErr = String(e.message || e); }
  expect("tester can read the AI Predictor (all sports)", predictOk, predictErr.slice(0, 90));

  // ── 7. Device release, then revoke ───────────────────────────────────────
  await admin.mutation(anyApi.testerCodes.adjust, { code: CODE, addDays: 30 });
  var afterExtend = await tester.query(anyApi.users.me, {});
  expect("admin can extend the trial", (afterExtend.trialExpiresAt || 0) > (me.trialExpiresAt || 0),
    "extended by 30 days");

  var overview = await admin.query(anyApi.testerCodes.overview, {});
  var row = (overview.testers || []).filter(function (t) { return t.code === CODE; })[0];
  expect("admin console lists the tester with name + masked NIN",
    !!row && row.fullName === "Autotest Verifier" && /•/.test(row.ninMasked),
    row ? row.fullName + " · NIN " + row.ninMasked + " · " + (row.stateOfResidence || "-") : "missing");

  var revealed = await admin.mutation(anyApi.testerCodes.revealNin, { code: CODE });
  expect("audited NIN reveal returns the full value", revealed.nin === "12345678901");

  await admin.mutation(anyApi.testerCodes.revoke, { code: CODE });
  var afterRevoke = await tester.query(anyApi.users.me, {});
  expect("revoking removes Master Pass immediately", afterRevoke.hasMasterPass === false,
    "reason=" + (afterRevoke.testerReason || "-"));

  var predictBlocked = false;
  try { await tester.query(anyApi.predictor.listMatches, { sportId: "football", dayKey: dk }); }
  catch (_) { predictBlocked = true; }
  expect("revoked tester loses AI Predictor access", predictBlocked);

  // ── Summary ──────────────────────────────────────────────────────────────
  await admin.mutation(anyApi.testerCodes.adjust, { code: CODE, clearDevice: true }).catch(function () {});
  var passed = results.filter(function (r) { return r.pass; }).length;
  console.log("\n" + passed + "/" + results.length + " checks passed  (test code " + CODE + " left revoked for audit)");
  if (passed !== results.length) {
    results.filter(function (r) { return !r.pass; }).forEach(function (r) { console.log("  → " + r.label); });
    process.exit(1);
  }
  process.exit(0);
}

main().catch(function (e) { console.log("FATAL: " + (e && e.message || e)); process.exit(1); });
