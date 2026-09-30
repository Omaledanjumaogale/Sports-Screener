// Tester access-code management from the terminal (super-admin credentials from
// .env.local). The same operations are available in the admin console UI.
//
// Usage:
//   node scripts/tester-codes.cjs list
//   node scripts/tester-codes.cjs generate [count] ["label"]
//   node scripts/tester-codes.cjs revoke  PDT-XXXX-XXXXX
//   node scripts/tester-codes.cjs restore PDT-XXXX-XXXXX
//   node scripts/tester-codes.cjs extend  PDT-XXXX-XXXXX [days]
//   node scripts/tester-codes.cjs release PDT-XXXX-XXXXX     (unbind the device)
//   node scripts/tester-codes.cjs nin     PDT-XXXX-XXXXX     (audited reveal)
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

function msgOf(e) {
  if (!e) return "";
  if (typeof e.data === "string") return e.data;
  if (e.data && typeof e.data.message === "string") return e.data.message;
  return String(e.message || e);
}

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

async function main() {
  var cmd = (process.argv[2] || "list").toLowerCase();
  var arg1 = process.argv[3];
  var arg2 = process.argv[4];

  var client = new ConvexHttpClient(envMap.PUBLIC_CONVEX_URL);
  var auth = await client.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", email: envMap.SUPER_ADMIN_EMAIL, password: envMap.SUPER_ADMIN_PASSWORD }
  });
  var tok = auth && auth.tokens && (auth.tokens.token || (Array.isArray(auth.tokens) && auth.tokens[0] && (auth.tokens[0].token || auth.tokens[0].value)));
  if (!tok) { console.log("Could not sign in as the super admin (check .env.local)."); process.exit(1); }
  client.setAuth(tok);

  if (cmd === "generate") {
    var res = await client.mutation(anyApi.testerCodes.generate, {
      count: Number(arg1 || 1),
      label: arg2 || undefined
    });
    console.log("Generated " + res.count + " access code(s) — issue ONE per tester:\n");
    res.codes.forEach(function (c) { console.log("   " + c); });
    console.log("\nEach code: tester registers at /tester, then logs in with the tester email + this code.");
    console.log("The code binds to the first device used and starts the 90-day trial.");
    process.exit(0);
  }

  if (cmd === "revoke") { console.log(JSON.stringify(await client.mutation(anyApi.testerCodes.revoke, { code: arg1 }))); process.exit(0); }
  if (cmd === "restore") { console.log(JSON.stringify(await client.mutation(anyApi.testerCodes.restore, { code: arg1 }))); process.exit(0); }
  if (cmd === "extend") { console.log(JSON.stringify(await client.mutation(anyApi.testerCodes.adjust, { code: arg1, addDays: Number(arg2 || 30) }))); process.exit(0); }
  if (cmd === "release") { console.log(JSON.stringify(await client.mutation(anyApi.testerCodes.adjust, { code: arg1, clearDevice: true }))); process.exit(0); }
  if (cmd === "nin") {
    var r = await client.mutation(anyApi.testerCodes.revealNin, { code: arg1 });
    console.log("NIN: " + r.nin + "  (this reveal is recorded in the audit trail)");
    process.exit(0);
  }

  // Default: list
  var o = await client.query(anyApi.testerCodes.overview, {});
  console.log("Tester access codes — " + o.counts.codesIssued + " issued, " + o.counts.activeTrials +
    " active trial(s), " + o.counts.codesAwaitingRegistration + " awaiting registration, " + o.counts.revoked + " revoked");
  console.log("Free trial: " + o.trialDays + " days · active users now: " + o.counts.onlineNow + "\n");
  if (!o.testers.length) { console.log("(none yet — run: node scripts/tester-codes.cjs generate 1)"); process.exit(0); }
  o.testers.forEach(function (t) {
    console.log("  " + t.code + "  [" + t.status + "]  " + (t.fullName || "unregistered"));
    if (t.fullName) {
      console.log("      NIN " + t.ninMasked + " · " + (t.actualEmail || "-") + " · " + (t.mobile || "-") + " · " + (t.stateOfResidence || "-"));
    }
    if (t.deviceLabel) console.log("      device " + t.deviceLabel + " (" + t.deviceId + ")");
    if (t.trialExpiresAt) console.log("      trial ends " + fmtDate(t.trialExpiresAt) + " (" + t.daysRemaining + "d left) · " + t.loginCount + " login(s)");
  });
  process.exit(0);
}

main().catch(function (e) { console.log("FATAL: " + msgOf(e)); process.exit(1); });
