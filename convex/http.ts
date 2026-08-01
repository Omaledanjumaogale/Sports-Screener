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

        // Only honor the configured plan amount/currency (₦5,000 NGN).
        if (amount < 5000 || currency !== "NGN") {
          console.warn(`[Flutterwave Webhook] Rejected non-plan charge: ${amount} ${currency}`);
          return new Response(JSON.stringify({ status: "error", message: "Invalid amount or currency" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (customerEmail) {
          await ctx.runMutation(api.users.markSubscribed, {
            email: customerEmail,
            txRef,
            transactionId: data?.id ? String(data.id) : undefined,
            amount,
            durationDays: 30,
            webhookSecret: secretHash
          });
          console.log(`[Flutterwave Webhook] Subscription activated for ${customerEmail} (txRef: ${txRef})`);
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
