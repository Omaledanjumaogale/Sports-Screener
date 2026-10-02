import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { verifiedPayment, validWebhookSignature } from './paymentValidation';

declare const process: { env: Record<string, string | undefined> };

const http = httpRouter();
auth.addHttpRoutes(http);

// Flutterwave Webhook Listener
// Webhook URL: https://gallant-minnow-735.eu-west-1.convex.site/webhooks/flutterwave
// Secret Hash is read from the FLW_SECRET_HASH Convex environment variable.
http.route({
  path: "/webhooks/flutterwave",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secretHash = process.env.FLW_SECRET_HASH;
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 131072) return new Response('Payload too large', { status: 413 });
    const signature = request.headers.get('flutterwave-signature');
    const modernValid = !!secretHash && await validWebhookSignature(raw, signature, secretHash);
    const legacyValid = process.env.FLW_ALLOW_LEGACY_WEBHOOK === 'true' && !!secretHash && request.headers.get('verif-hash') === secretHash;

    // Verify webhook signature against the configured secret hash. No hardcoded
    // fallback — a missing env secret must fail closed.
    if (!secretHash || (!modernValid && !legacyValid)) {
      console.warn("Flutterwave Webhook Signature Mismatch");
      return new Response(JSON.stringify({ status: "error", message: "Unauthorized signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const payload = JSON.parse(raw);
      const event = payload?.event;
      const data = payload?.data;

      if (event === "charge.completed" && data?.status === "successful") {
        const flags = await ctx.runQuery(internal.access.flagStatus, {});
        if (!flags.payments) return new Response('Settlement temporarily disabled', { status: 503 });
        const id = String(data?.id ?? '');
        const key = process.env.FLW_SECRET_KEY;
        if (!key || !/^\d+$/.test(id)) throw new Error('Verification unavailable');
        const response = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
          headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('Provider verification failed');
        const result = await response.json();
        if (result.status !== 'success') throw new Error('Provider verification failed');
        const payment = verifiedPayment(result.data, { email: data?.customer?.email, reference: data?.tx_ref });
        if (payment.transactionId !== id) throw new Error('Transaction ID mismatch');
        await ctx.runMutation(internal.users.markSubscribed, { ...payment, durationDays: 30 });
      }

      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("[Flutterwave Webhook Error]:", err?.message);
      return new Response(JSON.stringify({ status: "error", message: "Webhook processing failed" }), {
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

// ── Health probe (uptime monitoring) ──────────────────────────────────────────
// GET /api/health → 200 with a liveness + cron-freshness snapshot. External
// uptime monitors (BetterStack/UptimeRobot) point here; the flags object turns
// non-zero when a scheduled job stops stamping. Deliberately unauthenticated
// and side-effect free (safe to poll every minute).
http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    try {
      const health = await ctx.runQuery(api.cronHealth.getHealth, {});
      const stale = Object.values(health.flags).some(Boolean);
      return new Response(
        JSON.stringify({ status: stale ? 'degraded' : 'ok', ...health }),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ status: "error", message: String(err?.message || err).slice(0, 200) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  })
});

// ── Error beacon (client error capture) ───────────────────────────────────
// POST /api/error-report → ring-buffer errorLog row (capped per source, see
// convex/errorLog.ts). Body: { source, message, href }. Deliberately minimal:
// no auth (anonymous errors are exactly the ones we can't see otherwise),
// tightly truncated fields, and the ring buffer bounds total storage.
http.route({
  path: "/api/error-report",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body: any = await request.json().catch(() => ({}));
      const source = String(body.source || 'client').slice(0, 60);
      const message = String(body.message || 'unknown').slice(0, 500);
      const meta = { href: String(body.href || '').slice(0, 200) };
      await ctx.runMutation(api.errorLog.report, { source, message, meta });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
});

export default http;
