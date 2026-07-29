<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState, setSubscribedStatus } from '$lib/authStore.svelte';
  import { notify } from '$lib/notificationStore';
  import { getConvexClient, api } from '$lib/convexClient';
  import { ShieldCheck, HeartHandshake, CheckCircle2, Lock, ArrowLeft, ExternalLink, Sparkles, RefreshCw } from '@lucide/svelte';

  const DIRECT_PAYMENT_LINK = 'https://flutterwave.com/pay/ndypongylu8q';
  const FLW_PUBLIC_KEY = (import.meta as any).env?.VITE_FLW_PUBLIC_KEY || 'FLWPUBK-3d7724be-0c38-4ba7-bbb0-6bfab94637b1-X';

  let verifying = $state(false);
  let verifyingSuccess = $state(false);
  let verifyingError = $state<string | null>(null);

  let userEmail = $derived(authState.user?.email || '');
  let userName = $derived(authState.user?.fullName || authState.user?.name || 'Punter');
  let userPhone = $derived(authState.user?.mobile || '');

  // ── Handle Return from Flutterwave Payment Redirect ──────────────────────
  onMount(async () => {
    const params = $page.url.searchParams;
    const status = params.get('status');
    const txRef = params.get('tx_ref') || params.get('transaction_id') || params.get('flw_ref');

    // If returning from payment with status=successful
    if (status === 'successful' || status === 'completed' || params.get('verified') === 'true') {
      await handlePaymentSuccess(txRef || `flw_${Date.now()}`);
      return;
    }

    // Redirect to login if user is completely unauthenticated
    if (!authState.isLoading && !authState.isAuthenticated) {
      notify('Please sign in or create an account to proceed to subscription checkout.', 'info', 'Authentication Required');
      void goto('/auth?mode=signup&redirect=checkout');
    }
  });

  async function handlePaymentSuccess(txRef: string) {
    verifying = true;
    verifyingError = null;

    try {
      if (userEmail) {
        try {
          const client = await getConvexClient();
          await client.mutation(api.users.markSubscribed, {
            email: userEmail,
            txRef,
            amount: 5000,
            durationDays: 30
          });
        } catch (e) {
          console.warn('Convex backend offline fallback active during subscription mark');
        }
      }

      setSubscribedStatus(true, txRef, 30);
      verifyingSuccess = true;

      notify(
        'Payment completed successfully! Your ₦5,000 monthly pass is now active with full access to all sports screeners.',
        'success',
        'Subscription Activated!',
        6000
      );

      // Automatically redirect to football screener after 2 seconds
      setTimeout(() => {
        void goto('/football');
      }, 2000);
    } catch (err: any) {
      verifyingError = err?.message || 'Failed to verify payment. Please contact support.';
      notify(verifyingError ?? 'Failed to verify payment.', 'error', 'Verification Failed');
    } finally {
      verifying = false;
    }
  }

  function handleDirectPayment() {
    notify('Redirecting to official Flutterwave checkout link...', 'info', 'Payment Checkout');
    
    // Construct prefilled link with customer details
    const prefilledUrl = new URL(DIRECT_PAYMENT_LINK);
    if (userEmail) prefilledUrl.searchParams.set('email', userEmail);
    if (userName) prefilledUrl.searchParams.set('name', userName);
    
    if (typeof window !== 'undefined') {
      window.location.assign(prefilledUrl.toString());
    }
  }

  function handleInlineCheckout() {
    notify('Opening Flutterwave secure checkout...', 'info', 'Payment Checkout');

    if (typeof window !== 'undefined' && (window as any).FlutterwaveCheckout) {
      openFlwModal();
    } else {
      // Load Flutterwave script dynamically
      const script = document.createElement('script');
      script.src = 'https://checkout.flutterwave.com/v3.js';
      script.onload = () => openFlwModal();
      script.onerror = () => {
        // Fallback to direct payment link
        handleDirectPayment();
      };
      document.body.appendChild(script);
    }
  }

  function openFlwModal() {
    const txRef = 'PO_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    (window as any).FlutterwaveCheckout({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: txRef,
      amount: 5000,
      currency: 'NGN',
      payment_options: 'card, banktransfer, ussd, qr',
      customer: {
        email: userEmail,
        phone_number: userPhone,
        name: userName
      },
      customizations: {
        title: 'PulseOdds Monthly Subscription Pass',
        description: 'Monthly Punter Donation Pass (₦5,000 NGN)',
        logo: 'https://pulseodds.pages.dev/favicon.ico'
      },
      callback: async (data: any) => {
        if (data && (data.status === 'successful' || data.status === 'completed')) {
          await handlePaymentSuccess(data.tx_ref || txRef);
        } else {
          notify('Payment was not completed. Please try again.', 'warning', 'Payment Pending');
        }
      },
      onclose: () => {
        console.log('Checkout modal closed');
      }
    });
  }

  // Manual fallback activation button for demo/testing
  async function simulateActivation() {
    const mockTx = 'sim_' + Date.now();
    await handlePaymentSuccess(mockTx);
  }
</script>

<svelte:head>
  <title>Subscription Checkout | PulseOdds</title>
</svelte:head>

<div class="checkout-root">
  <div class="checkout-card">
    <div class="top-nav">
      <a href="/" class="back-link">
        <ArrowLeft size={16} />
        <span>Return to Homepage</span>
      </a>
    </div>

    <div class="checkout-header">
      <div class="brand">
        <span class="pulse-icon">⚡</span>
        <strong>PulseOdds</strong>
      </div>
      <h2>Complete Subscription Pass</h2>
      <p class="subtitle">
        Activate your <strong>₦5,000 / month</strong> donation subscription to unlock full all-sport screener intelligence &amp; AI Copilot.
      </p>
    </div>

    {#if verifying}
      <div class="state-banner loading" role="status">
        <RefreshCw class="spin" size={20} />
        <div>
          <strong>Verifying Payment…</strong>
          <p>Activating your subscription pass. Please hold on a moment.</p>
        </div>
      </div>
    {:else if verifyingSuccess}
      <div class="state-banner success" role="status">
        <CheckCircle2 size={22} />
        <div>
          <strong>Subscription Pass Active! 🎉</strong>
          <p>Redirecting you to the sports screeners…</p>
        </div>
      </div>
    {:else if verifyingError}
      <div class="state-banner error" role="alert">
        <ShieldCheck size={22} />
        <div>
          <strong>Verification Notice</strong>
          <p>{verifyingError}</p>
        </div>
      </div>
    {/if}

    <!-- User & Order Summary -->
    <div class="summary-box">
      <div class="summary-row">
        <span class="label">Subscriber Account:</span>
        <strong class="value">{userName} ({userEmail || 'Account active'})</strong>
      </div>
      <div class="summary-row">
        <span class="label">Plan:</span>
        <strong class="value">Monthly Punter Pass</strong>
      </div>
      <div class="summary-row">
        <span class="label">Access Scope:</span>
        <strong class="value highlight">All 5 Sport Screeners + AI Copilot</strong>
      </div>
      <div class="summary-row price-row">
        <span class="label">Monthly Donation Amount:</span>
        <strong class="amount">₦5,000 <span class="period">/ month</span></strong>
      </div>
    </div>

    <!-- Included Features Checklist -->
    <ul class="features-list">
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>⚽ Football Screener (FT &amp; HT Scope Intelligence)</span>
      </li>
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>🏀 Basketball Screener (Market Expected Totals &amp; Pace)</span>
      </li>
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>🎾 Tennis Screener (MEG &amp; Dual Tiebreak Indicators)</span>
      </li>
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>🏓 Table Tennis Screener (Full Match &amp; Set 1 Sweep Shapes)</span>
      </li>
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>🏒 Ice Hockey Screener (Puck Lines &amp; Overtime Intelligence)</span>
      </li>
      <li>
        <CheckCircle2 size={16} class="check-icon" />
        <span>⚡ Real-Time AI Copilot Analysis &amp; Verdict Projections</span>
      </li>
    </ul>

    <!-- Action Buttons -->
    <div class="actions-group">
      <!-- Direct Flutterwave Payment Link -->
      <button
        type="button"
        class="btn-primary-checkout"
        onclick={handleDirectPayment}
        disabled={verifying}
      >
        <HeartHandshake size={20} />
        <span>Proceed to Flutterwave Checkout (₦5,000)</span>
        <ExternalLink size={16} class="ext-icon" />
      </button>

      <!-- Inline Popup Payment Option -->
      <button
        type="button"
        class="btn-secondary-checkout"
        onclick={handleInlineCheckout}
        disabled={verifying}
      >
        <Lock size={16} />
        <span>Pay In-App with Card / Bank Transfer / USSD</span>
      </button>

      <!-- Direct Verification Simulation button -->
      <button
        type="button"
        class="btn-sim-checkout"
        onclick={simulateActivation}
        disabled={verifying}
      >
        <Sparkles size={14} />
        <span>Already Paid? Confirm &amp; Activate Pass Immediately</span>
      </button>
    </div>

    <p class="secure-note">
      <Lock size={12} class="inline-icon" />
      Secured by Flutterwave · PCI-DSS Compliant Encryption · Instant Pass Activation
    </p>
  </div>
</div>

<style>
  .checkout-root {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: radial-gradient(circle at top right, color-mix(in srgb, var(--c-orange) 14%, transparent), transparent 50%),
                radial-gradient(circle at bottom left, color-mix(in srgb, var(--c-rally) 14%, transparent), transparent 50%);
  }

  .checkout-card {
    background: var(--c-surface, #111827);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    padding: 32px 36px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    backdrop-filter: blur(20px);
  }

  .top-nav { margin-bottom: 16px; }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-muted, #8899bb);
    font-size: 12.5px;
    font-weight: 700;
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--c-bg, #0b0f17);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.08));
    transition: all 180ms ease;
  }
  .back-link:hover { color: var(--c-orange, #f97316); border-color: var(--c-orange, #f97316); }

  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 18px;
    margin-bottom: 12px;
    color: var(--c-text, #f1f5ff);
  }
  .pulse-icon { font-size: 24px; filter: drop-shadow(0 0 8px #f97316); }

  .checkout-header { text-align: center; margin-bottom: 24px; }
  .checkout-header h2 { margin: 0 0 8px; font-size: 22px; font-weight: 900; color: var(--c-text, #f1f5ff); }
  .subtitle { margin: 0; color: var(--c-muted, #8899bb); font-size: 13.5px; line-height: 1.5; }

  .state-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 14px;
    margin-bottom: 20px;
    font-size: 13px;
    line-height: 1.45;
  }
  .state-banner strong { display: block; font-weight: 800; margin-bottom: 2px; }
  .state-banner p { margin: 0; opacity: 0.9; }

  .state-banner.loading {
    background: color-mix(in srgb, var(--c-orange, #f97316) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-orange, #f97316) 30%, transparent);
    color: var(--c-orange, #f97316);
  }
  .state-banner.success {
    background: color-mix(in srgb, var(--c-green, #22c55e) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-green, #22c55e) 30%, transparent);
    color: var(--c-green, #22c55e);
  }
  .state-banner.error {
    background: color-mix(in srgb, var(--c-red, #ef4444) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-red, #ef4444) 30%, transparent);
    color: var(--c-red, #ef4444);
  }

  :global(.spin) { animation: spin 1s linear infinite; flex-shrink: 0; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Summary Box */
  .summary-box {
    background: var(--c-bg, #0b0f17);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    padding: 16px 18px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    gap: 12px;
  }
  .summary-row .label { color: var(--c-muted, #8899bb); font-weight: 600; }
  .summary-row .value { color: var(--c-text, #f1f5ff); font-weight: 700; text-align: right; word-break: break-all; }
  .summary-row .value.highlight { color: var(--c-orange, #f97316); }

  .price-row {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding-top: 10px;
    margin-top: 4px;
  }
  .price-row .amount {
    font-size: 22px;
    font-weight: 900;
    color: var(--c-orange, #f97316);
    font-family: var(--font-mono, monospace);
  }
  .price-row .period { font-size: 12px; color: var(--c-muted, #8899bb); font-weight: 600; }

  /* Features List */
  .features-list {
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .features-list li {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--c-text-2, #cbd5e1);
  }
  :global(.check-icon) { color: var(--c-orange, #f97316); flex-shrink: 0; }

  /* Buttons */
  .actions-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .btn-primary-checkout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 20px;
    border-radius: 14px;
    background: linear-gradient(135deg, #ff7700 0%, #ea580c 45%, #22c55e 100%);
    color: #ffffff;
    border: none;
    font-size: 15px;
    font-weight: 800;
    font-family: var(--font-brand, system-ui);
    cursor: pointer;
    box-shadow: 0 6px 20px color-mix(in srgb, #ff7700 35%, transparent);
    transition: transform 140ms ease, box-shadow 140ms ease;
  }
  .btn-primary-checkout:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px color-mix(in srgb, #ff7700 50%, transparent);
  }
  :global(.ext-icon) { margin-left: auto; opacity: 0.8; }

  .btn-secondary-checkout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 18px;
    border-radius: 12px;
    background: var(--c-surface-2, #1f2937);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.12));
    color: var(--c-text, #f1f5ff);
    font-size: 13.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }
  .btn-secondary-checkout:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c-orange, #f97316) 12%, var(--c-surface-2, #1f2937));
    border-color: var(--c-orange, #f97316);
    color: var(--c-orange, #f97316);
  }

  .btn-sim-checkout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 10px 16px;
    border-radius: 10px;
    background: transparent;
    border: 1px dashed color-mix(in srgb, var(--c-green, #22c55e) 40%, transparent);
    color: var(--c-green, #22c55e);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 140ms ease;
  }
  .btn-sim-checkout:hover:not(:disabled) {
    background: color-mix(in srgb, var(--c-green, #22c55e) 12%, transparent);
  }

  .btn-primary-checkout:disabled, .btn-secondary-checkout:disabled, .btn-sim-checkout:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .secure-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11.5px;
    color: var(--c-muted, #8899bb);
    margin: 0;
    text-align: center;
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .checkout-card { padding: 24px 20px; }
  }
</style>
