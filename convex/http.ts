import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

declare const process: { env: Record<string, string | undefined> };

const http = httpRouter();
auth.addHttpRoutes(http);

// Flutterwave Webhook Listener
// Webhook URL: https://modest-lark-218.eu-west-1.convex.site/webhooks/flutterwave
// Secret Hash is read from the FLW_SECRET_HASH Convex environment variable.
http.route({
  path: "/webhooks/flutterwave",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("verif-hash");
    const secretHash = process.env.FLW_SECRET_HASH;

    // Verify webhook signature against the configured secret hash. No hardcoded
    // fallback — a missing env secret must fail closed.
    if (!secretHash || !signature || signature !== secretHash) {
      console.warn("Flutterwave Webhook Signature Mismatch");
      return new Response(JSON.stringify({ status: "error", message: "Unauthorized signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const payload = await request.json();
      const event = payload?.event;
      const data = payload?.data;

      if (event === "charge.completed" && data?.status === "successful") {
        const customerEmail = data?.customer?.email;
        const txRef = data?.tx_ref || data?.flw_ref || `flw_${Date.now()}`;
        const amount = Number(data?.amount) || 0;
        const currency = String(data?.currency || "").toUpperCase();

        // Only honor the configured plan amounts/currency (₦5,000 / ₦10,000 NGN).
        if (amount < 5000 || currency !== "NGN") {
          console.warn(`[Flutterwave Webhook] Rejected non-plan charge: ${amount} ${currency}`);
          return new Response(JSON.stringify({ status: "error", message: "Invalid amount or currency" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // ₦10,000+ → Master Pass (includes the AI Predictor); otherwise Punter.
        const tier: "punter" | "master" = amount >= 9500 ? "master" : "punter";

        if (customerEmail) {
          await ctx.runMutation(api.users.markSubscribed, {
            email: customerEmail,
            txRef,
            transactionId: data?.id ? String(data.id) : undefined,
            amount,
            durationDays: 30,
            tier,
            webhookSecret: secretHash
          });
          console.log(`[Flutterwave Webhook] ${tier === "master" ? "Master" : "Punter"} pass activated for ${customerEmail} (txRef: ${txRef})`);
        }
      }

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("[Flutterwave Webhook Error]:", err?.message);
      return new Response(JSON.stringify({ status: "error", message: err?.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
});

// ── Fixture-source diagnostics report ────────────────────────────────────────
// GET /api/diagnostics/fixture-pages → probes every FIXTURE_PAGES url and
// returns which pages fetch + parse fixtures per sport (for pruning dead or
// unparseable sources). Optional query params: ?sportId=football&dayKey=2026-08-10
//
// Each hit triggers up to ~45 external reads, so the route is rate-limited per
// client IP (in-memory sliding window — best-effort, single-process).
const DIAG_WINDOW_MS = 60_000;
const DIAG_MAX_HITS = 5;
const diagHits = new Map<string, number[]>();

function diagAllowed(ip: string): boolean {
  const now = Date.now();
  const hits = (diagHits.get(ip) ?? []).filter((t) => now - t < DIAG_WINDOW_MS);
  if (hits.length >= DIAG_MAX_HITS) {
    diagHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  diagHits.set(ip, hits);
  return true;
}

http.route({
  path: "/api/diagnostics/fixture-pages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!diagAllowed(ip)) {
      return new Response(JSON.stringify({ status: "error", message: "Rate limited — retry in a minute." }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const url = new URL(request.url);
      const result = await ctx.runAction(api.diagnostics.diagnoseFixturePages, {
        sportId: url.searchParams.get("sportId") || undefined,
        dayKey: url.searchParams.get("dayKey") || undefined
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ status: "error", message: String(err?.message || err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
});

// Also support GET /webhooks/flutterwave for status check
http.route({
  path: "/webhooks/flutterwave",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "active", service: "PulseOdds Flutterwave Webhook Listener" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
});

export default http;
