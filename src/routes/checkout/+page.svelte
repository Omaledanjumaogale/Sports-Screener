<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState, setSubscribedStatus, refreshAccess } from '$lib/authStore.svelte';
  import { notify } from '$lib/notificationStore';
  import { getConvexClient, api } from '$lib/convexClient';
  import { ShieldCheck, HeartHandshake, CheckCircle2, Lock, ArrowLeft, ExternalLink, RefreshCw } from '@lucide/svelte';

  const DIRECT_PAYMENT_LINK = (import.meta as any).env?.VITE_FLW_PAYMENT_LINK || 'https://flutterwave.com/pay/ndypongylu8q';
  const MASTER_PAYMENT_LINK = (import.meta as any).env?.VITE_FLW_MASTER_PAYMENT_LINK || '';
  const FLW_PUBLIC_KEY = (import.meta as any).env?.VITE_FLW_PUBLIC_KEY || 'FLWPUBK-3d7724be-0c38-4ba7-bbb0-6bfab94637b1-X';

  let verifying = $state(false);
  let verifyingSuccess = $state(false);
  let verifyingError = $state<string | null>(null);

  let userEmail = $derived(authState.user?.email || '');
  let userName = $derived(authState.user?.fullName || authState.user?.name || 'Punter');
  let userPhone = $derived(authState.user?.mobile || '');

  // ── Plan selection (two tiers) ─────────────────────────────────────────────
  type Tier = 'punter' | 'master';
  let plan = $state<Tier>('punter');

  const PLANS: Record<
    Tier,
    { label: string; tag: string; amount: number; blurb: string; features: string[]; highlight?: string }
  > = {
    punter: {
      label: 'Punter Pass',
      tag: 'All-Sport Screeners',
      amount: 5000,
      blurb: 'Unlock every sport screener + AI Copilot for a full month.',
      features: [
        '⚽ Football Screener (FT & HT Scope Intelligence)',
        '🏀 Basketball Screener (Market Expected Totals & Pace)',
        '🎾 Tennis Screener (MEG & Dual Tiebreak Indicators)',
        '🏓 Table Tennis Screener (Full Match & Set 1 Sweep Shapes)',
        '🏒 Ice Hockey Screener (Puck Lines & Overtime Intelligence)',
        '⚡ Real-Time AI Copilot Analysis & Verdict Projections'
      ]
    },
    master: {
      label: 'Master Punter Pass',
      tag: 'Everything in Punter + AI Predictor',
      amount: 10000,
      blurb: 'The full Punter Pass plus Eze Ugo & the agent team — daily high-confidence AI Predictor picks.',
      features: [
        'Everything in the ₦5,000 Punter Pass',
        '🧠 AI Predictor — matches that clear the 60% Real Win Chance floor',
        '🤖 Nine Nigeria-named AI agents (fixtures, odds, volume, risk & more)',
        '📊 Real Win Chance, Punter Edge & risk warnings on every pick',
        '📅 1–7 day fixture window with live refresh',
        '⚡ Real-Time AI Copilot Analysis & Verdict Projections'
      ],
      highlight: 'BEST VALUE'
    }
  };

  // ── Handle Return from Flutterwave Payment Redirect ──────────────────────
  onMount(async () => {
    const params = $page.url.searchParams;
    const status = params.get('status');
    const txRef = params.get('tx_ref') || params.get('transaction_id') || params.get('flw_ref');
    const transactionId = params.get('transaction_id') || undefined;

    const tierParam = params.get('tier');
    if (tierParam === 'master') plan = 'master';
    else if (tierParam === 'punter') plan = 'punter';

    // If returning from payment with status=successful
    if (status === 'successful' || status === 'completed' || params.get('verified') === 'true') {
      await handlePaymentSuccess(txRef || `flw_${Date.now()}`, transactionId);
      return;
    }

    // Redirect to login if user is completely unauthenticated
    if (!authState.isLoading && !authState.isAuthenticated) {
      notify('Please sign in or create an account to proceed to subscription checkout.', 'info', 'Authentication Required');
      void goto('/auth?mode=signup&redirect=checkout');
    }
  });

  async function handlePaymentSuccess(txRef: string, transactionId?: string) {
    verifying = true;
    verifyingError = null;

    try {
      // Server-side verification: the Convex action re-verifies the charge with
      // Flutterwave before granting access, so a forged/local txRef is rejected.
      const client = await getConvexClient();
      const result: any = await client.action(api.users.verifyFlutterwaveCharge, {
        txRef,
        transactionId,
        email: userEmail
      });

      const tier: Tier = result?.tier === 'master' ? 'master' : 'punter';
      setSubscribedStatus(true, txRef, tier);
      void refreshAccess();
      verifyingSuccess = true;

      const name = PLANS[tier].label;
      const amount = (result?.amount ?? PLANS[tier].amount).toLocaleString();
      notify(
        `Payment verified and completed successfully! Your ${name} (₦${amount} / month) is now active.`,
        'success',
        'Subscription Activated!',
        6000
      );

      // Automatically redirect: master → AI Predictor, punter → football screener.
      setTimeout(() => {
        void goto(tier === 'master' ? '/predictor' : '/football');
      }, 2000);
    } catch (err: any) {
      verifyingError = err?.message || 'Failed to verify payment. Please contact support.';
      notify(verifyingError ?? 'Failed to verify payment.', 'error', 'Verification Failed');
    } finally {
      verifying = false;
    }
  }

  function handleDirectPayment() {
    const active = PLANS[plan];
    // The ₦5,000 direct link is always available; the master link is pluggable
    // via env — until one is configured, fall back to the inline SDK for master.
    if (plan === 'master' && !MASTER_PAYMENT_LINK) {
      handleInlineCheckout();
      return;
    }
    const link = plan === 'master' ? MASTER_PAYMENT_LINK : DIRECT_PAYMENT_LINK;
    notify(`Redirecting to official Flutterwave checkout (${active.label})...`, 'info', 'Payment Checkout');

    // Construct prefilled link with customer details
    const prefilledUrl = new URL(link);
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
    const active = PLANS[plan];
    const txRef = (plan === 'master' ? 'MASTER_PO_' : 'PO_') + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    (window as any).FlutterwaveCheckout({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: txRef,
      amount: active.amount,
      currency: 'NGN',
      payment_options: 'card, banktransfer, ussd, qr',
      customer: {
        email: userEmail,
        phone_number: userPhone,
        name: userName
      },
      customizations: {
        title: `PulseOdds ${active.label}`,
        description: `Monthly ${active.label} (₦${active.amount.toLocaleString()} NGN)`,
        logo: 'https://pulseodds.pages.dev/favicon.ico'
      },
      callback: async (data: any) => {
        if (data && (data.status === 'successful' || data.status === 'completed')) {
          await handlePaymentSuccess(data.tx_ref || txRef, data.transaction_id || data.id);
        } else {
          notify('Payment was not completed. Please try again.', 'warning', 'Payment Pending');
        }
      },
      onclose: () => {
        console.log('Checkout modal closed');
      }
    });
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
        Choose your monthly pass. Punter unlocks every sport screener &amp; AI Copilot — Master
        adds the AI Predictor with high-confidence picks.
      </p>
    </div>

    <!-- Plan Selection Cards -->
    <div class="plan-picker" role="radiogroup" aria-label="Choose subscription plan">
      {#each (['punter', 'master'] as const) as key (key)}
        {@const p = PLANS[key]}
        <button
          type="button"
          role="radio"
          aria-checked={plan === key}
          class:is-active={plan === key}
          class:is-master={key === 'master'}
          class="plan-card"
          onclick={() => (plan = key)}
        >
          {#if p.highlight}
            <span class="plan-badge">{p.highlight}</span>
          {/if}
          <span class="plan-label">{p.label}</span>
          <span class="plan-tag">{p.tag}</span>
          <span class="plan-price">
            <span class="currency">₦</span><span class="amount">{p.amount.toLocaleString()}</span>
            <span class="period">/ month</span>
          </span>
          <span class="plan-blurb">{p.blurb}</span>
        </button>
      {/each}
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
        <strong class="value">{PLANS[plan].label}</strong>
      </div>
      <div class="summary-row">
        <span class="label">Access Scope:</span>
        <strong class="value highlight">{plan === 'master' ? 'All Screeners + AI Predictor' : 'All 5 Sport Screeners + AI Copilot'}</strong>
      </div>
      <div class="summary-row price-row">
        <span class="label">Monthly Donation Amount:</span>
        <strong class="amount">₦{PLANS[plan].amount.toLocaleString()} <span class="period">/ month</span></strong>
      </div>
    </div>

    <!-- Included Features Checklist -->
    <ul class="features-list">
      {#each PLANS[plan].features as feature}
        <li>
          <CheckCircle2 size={16} class="check-icon" />
          <span>{feature}</span>
        </li>
      {/each}
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
        <span>Proceed to Flutterwave Checkout (₦{PLANS[plan].amount.toLocaleString()})</span>
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
    padding: 28px 32px;
    width: 100%;
    max-width: 560px;
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

  .checkout-header { text-align: center; margin-bottom: 20px; }
  .checkout-header h2 { margin: 0 0 8px; font-size: 22px; font-weight: 900; color: var(--c-text, #f1f5ff); }
  .subtitle { margin: 0; color: var(--c-muted, #8899bb); font-size: 13px; line-height: 1.5; }

  /* Plan Picker */
  .plan-picker {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
  }
  .plan-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    padding: 16px 16px 14px;
    border-radius: 16px;
    background: var(--c-bg, #0b0f17);
    border: 1.5px solid var(--c-border, rgba(255, 255, 255, 0.1));
    color: var(--c-text, #f1f5ff);
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  }
  .plan-card:hover { border-color: color-mix(in srgb, #f97316 45%, transparent); }
  .plan-card.is-active { border-color: #f97316; box-shadow: 0 8px 28px color-mix(in srgb, #f97316 22%, transparent); }
  .plan-card.is-master.is-active { border-color: #fbbf24; box-shadow: 0 8px 30px color-mix(in srgb, #fbbf24 26%, transparent); }
  .plan-card:active { transform: scale(0.98); }
  .plan-badge {
    position: absolute;
    top: -9px;
    right: 10px;
    padding: 3px 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    color: #1a1200;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.06em;
  }
  .plan-label { font-size: 14px; font-weight: 900; }
  .plan-tag { font-size: 10.5px; font-weight: 700; color: var(--c-orange, #f97316); text-transform: uppercase; letter-spacing: 0.05em; }
  .is-master .plan-tag { color: #fbbf24; }
  .plan-price { display: inline-flex; align-items: baseline; gap: 2px; margin-top: 4px; }
  .plan-price .currency { font-size: 15px; font-weight: 800; color: var(--c-orange, #f97316); }
  .is-master .plan-price .currency { color: #fbbf24; }
  .plan-price .amount { font-size: 22px; font-weight: 900; font-family: var(--font-mono, monospace); color: var(--c-orange, #f97316); }
  .is-master .plan-price .amount { color: #fbbf24; }
  .plan-price .period { font-size: 11px; color: var(--c-muted, #8899bb); }
  .plan-blurb { font-size: 11px; line-height: 1.45; color: var(--c-muted, #8899bb); margin: 0; }

  @media (max-width: 480px) {
    .plan-picker { grid-template-columns: 1fr; }
  }

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

  .btn-primary-checkout:disabled, .btn-secondary-checkout:disabled {
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
