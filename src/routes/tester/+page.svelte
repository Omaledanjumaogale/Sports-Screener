<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    ShieldAlert, ArrowLeft, Eye, EyeOff, KeyRound, UserPlus, BadgeCheck,
    CheckCircle2, Copy, Check, Loader2, Lock
  } from '@lucide/svelte';
  import { notify } from '$lib/notificationStore';
  import { queryConvex, callConvex, api, convexErrorMessage } from '$lib/convexClient';

  const TESTER_EMAIL = import.meta.env.VITE_TESTER_EMAIL || '';

  // The code can be pre-filled from a shared link (?code=PDT-XXXX-XXXX).
  let code = $state($page.url.searchParams.get('code')?.toUpperCase() ?? '');
  let fullName = $state('');
  let nin = $state('');
  let testerEmail = $state(TESTER_EMAIL);
  let testerPassword = $state('');
  let actualEmail = $state('');
  let preferredPassword = $state('');
  let confirmPassword = $state('');
  let mobile = $state('');
  let stateOfResidence = $state('');
  let consentAccepted = $state(false);

  let showTesterPw = $state(false);
  let showPreferredPw = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let done = $state<{ code: string; fullName: string } | null>(null);

  // Live code validation so a wrong code is caught before the form is filled in.
  let codeState = $state<'idle' | 'checking' | 'valid' | 'taken' | 'revoked' | 'unknown'>('idle');
  let codeTimer: ReturnType<typeof setTimeout> | null = null;

  const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'International / Other'
  ];

  function onCodeInput() {
    code = code.toUpperCase();
    codeState = 'idle';
    if (codeTimer) clearTimeout(codeTimer);
    const candidate = code.trim();
    if (candidate.length < 10) return;
    codeTimer = setTimeout(() => void checkCode(candidate), 400);
  }

  async function checkCode(candidate: string) {
    codeState = 'checking';
    try {
      const res = await queryConvex<any>(api.testerCodes.checkCode, { code: candidate });
      if (!res?.found) codeState = 'unknown';
      else if (res.status === 'revoked') codeState = 'revoked';
      else if (res.claimed || res.registered) codeState = 'taken';
      else codeState = 'valid';
    } catch {
      codeState = 'idle';
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;

    if (preferredPassword !== confirmPassword) {
      error = 'Your preferred password and its confirmation do not match.';
      return;
    }
    if (preferredPassword.length < 8) {
      error = 'Your preferred password must be at least 8 characters long.';
      return;
    }
    if (nin.replace(/\D/g, '').length !== 11) {
      error = 'Your NIN must be exactly 11 digits.';
      return;
    }
    if (!consentAccepted) {
      error = 'Please accept the terms to continue.';
      return;
    }

    loading = true;
    try {
      const res = await callConvex<any>(api.testerCodes.register, {
        code: code.trim(),
        fullName: fullName.trim(),
        nin: nin.replace(/\D/g, ''),
        testerEmail: testerEmail.trim(),
        actualEmail: actualEmail.trim(),
        preferredPassword,
        mobile: mobile.trim(),
        stateOfResidence,
        consentAccepted: true
      });
      done = { code: res.code, fullName: res.fullName };
      notify(res.message, 'success', 'Tester Registration Complete', 8000);
    } catch (err: any) {
      error = convexErrorMessage(err, 'Registration failed. Please check your details and try again.');
      notify(error ?? 'Registration failed.', 'error', 'Registration Error');
    } finally {
      loading = false;
    }
  }

  let copied = $state(false);
  async function copyCode() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.code);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  const codeHint = $derived(
    codeState === 'valid'
      ? { tone: 'ok' as const, text: 'Access code recognised — finish the form to claim it.' }
      : codeState === 'taken'
        ? { tone: 'bad' as const, text: 'This code has already been registered to another tester.' }
        : codeState === 'revoked'
          ? { tone: 'bad' as const, text: 'This code has been revoked. Contact the administrator.' }
          : codeState === 'unknown'
            ? { tone: 'bad' as const, text: 'Code not recognised. Check it with whoever issued it.' }
            : codeState === 'checking'
              ? { tone: 'idle' as const, text: 'Checking code…' }
              : null
  );
</script>

<svelte:head>
  <title>Tester Registration | PulseOdds</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="tester-root">
  <div class="tester-card">
    <div class="top-nav">
      <a href="/" class="back-home-btn">
        <ArrowLeft size={16} />
        <span>Return to Homepage</span>
      </a>
    </div>

    <div class="head">
      <div class="brand">
        <span class="pulse-icon">⚡</span>
        <strong>PulseOdds</strong>
      </div>
      <h2>Tester access registration</h2>
      <p class="subtitle">
        Register your details against the access code you were issued. Once registered, log in with
        the tester account and your code <strong>on one device only</strong> — your
        <strong>3-month free trial</strong> starts on the first device you use and cannot be moved.
      </p>
    </div>

    {#if done}
      <div class="success-panel">
        <CheckCircle2 size={34} stroke-width={1.8} />
        <h3>You're registered, {done.fullName.split(' ')[0]}.</h3>
        <p>
          Your access code below is the key to the tester account. Log in within the app with the
          tester email plus this code.
        </p>
        <button class="code-chip" type="button" onclick={copyCode} title="Copy access code">
          <KeyRound size={16} />
          <code>{done.code}</code>
          {#if copied}<Check size={15} stroke-width={3} />{:else}<Copy size={15} />{/if}
        </button>
        <ol class="steps">
          <li>Open the login page.</li>
          <li>Enter the tester email and the tester password issued to you.</li>
          <li>Paste the access code above into the <strong>Access code</strong> field.</li>
          <li>Your 3-month trial starts on that device — stay on it.</li>
        </ol>
        <a class="submit-btn as-link" href={`/auth?mode=login&code=${encodeURIComponent(done.code)}`}>
          Continue to login
        </a>
      </div>
    {:else}
      {#if error}
        <div class="error-banner" role="alert">
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      {/if}

      <form class="tester-form" onsubmit={handleSubmit}>
        <div class="form-group">
          <label for="fullName">Full Name <span class="req">*</span></label>
          <input id="fullName" type="text" bind:value={fullName} placeholder="Jane Doe" required disabled={loading} autocomplete="name" />
        </div>

        <div class="form-group">
          <label for="nin">NIN (National Identification Number) <span class="req">*</span></label>
          <input id="nin" type="text" bind:value={nin} placeholder="11 digits" required disabled={loading}
            inputmode="numeric" maxlength="14" autocomplete="off" />
          <span class="hint">11 digits. Shown to the administrator masked — only the last 4 are visible.</span>
        </div>

        <div class="row">
          <div class="form-group">
            <label for="testerEmail">Tester Email (issued to you) <span class="req">*</span></label>
            <input id="testerEmail" type="email" bind:value={testerEmail} placeholder="tester@example.com"
              required disabled={loading || !!TESTER_EMAIL} autocomplete="off" />
            {#if TESTER_EMAIL}
              <span class="hint"><Lock size={11} /> Fixed — pre-filled with the issued tester account.</span>
            {/if}
          </div>
          <div class="form-group">
            <label for="testerPassword">Tester Password (issued to you) <span class="req">*</span></label>
            <div class="password-wrapper">
              <input id="testerPassword" type={showTesterPw ? 'text' : 'password'} bind:value={testerPassword}
                placeholder="••••••••" required disabled={loading} autocomplete="off" />
              <button type="button" class="eye-btn" tabindex="-1"
                aria-label={showTesterPw ? 'Hide password' : 'Show password'}
                onclick={() => (showTesterPw = !showTesterPw)}>
                {#if showTesterPw}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="code">Unique Access Code <span class="req">*</span></label>
          <input id="code" type="text" bind:value={code} oninput={onCodeInput}
            placeholder="PDT-XXXX-XXXX" required disabled={loading}
            autocomplete="off" spellcheck="false" maxlength="14" />
          {#if codeHint}
            <span class="hint" class:ok={codeHint.tone === 'ok'} class:bad={codeHint.tone === 'bad'}>
              {#if codeHint.tone === 'ok'}<BadgeCheck size={12} />{:else if codeHint.tone === 'idle'}<Loader2 size={12} class="spin" />{/if}
              {codeHint.text}
            </span>
          {/if}
        </div>

        <div class="form-group">
          <label for="actualEmail">Your Personal Email <span class="req">*</span></label>
          <input id="actualEmail" type="email" bind:value={actualEmail} placeholder="you@example.com"
            required disabled={loading} autocomplete="email" />
          <span class="hint">Must differ from the tester email — this is how we reach you.</span>
        </div>

        <div class="row">
          <div class="form-group">
            <label for="preferredPassword">Your Preferred Password <span class="req">*</span></label>
            <div class="password-wrapper">
              <input id="preferredPassword" type={showPreferredPw ? 'text' : 'password'} bind:value={preferredPassword}
                placeholder="At least 8 characters" required disabled={loading} autocomplete="new-password" />
              <button type="button" class="eye-btn" tabindex="-1"
                aria-label={showPreferredPw ? 'Hide password' : 'Show password'}
                onclick={() => (showPreferredPw = !showPreferredPw)}>
                {#if showPreferredPw}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
              </button>
            </div>
            <span class="hint">Stored as a one-way fingerprint — never in plain text.</span>
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Preferred Password <span class="req">*</span></label>
            <input id="confirmPassword" type="password" bind:value={confirmPassword}
              placeholder="Repeat it" required disabled={loading} autocomplete="new-password" />
          </div>
        </div>

        <div class="row">
          <div class="form-group">
            <label for="mobile">Mobile Number <span class="req">*</span></label>
            <input id="mobile" type="tel" bind:value={mobile} placeholder="+234 801 234 5678"
              required disabled={loading} inputmode="tel" autocomplete="tel" />
          </div>
          <div class="form-group">
            <label for="stateOfResidence">State of Residence <span class="req">*</span></label>
            <select id="stateOfResidence" bind:value={stateOfResidence} required disabled={loading}>
              <option value="" disabled selected>Select your state</option>
              {#each NIGERIAN_STATES as st}
                <option value={st}>{st}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="form-group consent-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={consentAccepted} required disabled={loading} />
            <span>
              I accept the Terms &amp; Conditions, confirm the details above are mine, and understand
              my tester code works on <strong>one device only</strong> for the 3-month trial.
              <span class="req">*</span>
            </span>
          </label>
        </div>

        <button type="submit" class="submit-btn" disabled={loading}>
          {#if loading}
            <span class="spinner"></span> Registering…
          {:else}
            <UserPlus size={18} /> Register tester details
          {/if}
        </button>
      </form>

      <div class="footer">
        Already registered? <a href="/auth?mode=login">Log in with your access code</a>
        <span class="dot">·</span>
        <a href="/auth?mode=signup">Regular punter signup</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .tester-root {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: radial-gradient(circle at top right, color-mix(in srgb, var(--c-orange) 12%, transparent), transparent 50%),
                radial-gradient(circle at bottom left, color-mix(in srgb, var(--c-rally) 12%, transparent), transparent 50%);
  }
  .tester-card {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 24px;
    padding: 32px 36px;
    width: 100%;
    max-width: 620px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18);
    backdrop-filter: blur(16px);
  }
  .top-nav { margin-bottom: 20px; }
  .back-home-btn {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--c-muted); font-size: 13px; font-weight: 700; text-decoration: none;
    padding: 6px 12px; border-radius: 999px; background: var(--c-bg); border: 1px solid var(--c-border);
    transition: all var(--t-base);
  }
  .back-home-btn:hover {
    color: var(--c-orange); border-color: var(--c-orange);
    background: color-mix(in srgb, var(--c-orange) 8%, var(--c-bg));
  }
  .brand {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 18px; margin-bottom: 16px; color: var(--c-text);
  }
  .pulse-icon { font-size: 24px; filter: drop-shadow(0 0 8px var(--c-orange)); }
  .head { text-align: center; margin-bottom: 26px; }
  .head h2 { margin: 0 0 8px; font-size: 23px; font-weight: 800; color: var(--c-text); }
  .subtitle { margin: 0; color: var(--c-muted); font-size: 13.5px; line-height: 1.55; }

  .error-banner {
    display: flex; align-items: center; gap: 8px; padding: 12px 14px;
    background: color-mix(in srgb, var(--c-red) 15%, transparent); color: var(--c-red);
    border: 1px solid color-mix(in srgb, var(--c-red) 30%, transparent);
    border-radius: 12px; margin-bottom: 22px; font-size: 13.5px; font-weight: 600;
  }

  .tester-form { display: block; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .form-group { margin-bottom: 16px; }
  label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: var(--c-text-2); }
  .req { color: var(--c-orange); }
  input[type="text"], input[type="email"], input[type="tel"], input[type="password"], select {
    width: 100%; padding: 12px 16px; background: var(--c-bg); border: 1px solid var(--c-border);
    border-radius: 12px; color: var(--c-text); font-size: 14.5px; font-family: inherit; outline: none;
    transition: border-color var(--t-base), box-shadow var(--t-base);
  }
  input:focus, select:focus {
    border-color: var(--c-orange);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-orange) 20%, transparent);
  }
  input:disabled { opacity: 0.65; cursor: not-allowed; }
  #code { letter-spacing: 0.08em; font-family: var(--font-mono, 'JetBrains Mono', monospace); font-weight: 700; }
  .hint {
    display: inline-flex; align-items: center; gap: 5px; margin-top: 6px;
    font-size: 11.5px; color: var(--c-muted); line-height: 1.45;
  }
  .hint.ok { color: var(--c-green, #34d399); }
  .hint.bad { color: var(--c-red); }
  .password-wrapper { position: relative; display: flex; align-items: center; }
  .password-wrapper input { padding-right: 46px; }
  .eye-btn {
    position: absolute; right: 10px; background: transparent; border: none; color: var(--c-muted);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    min-width: 30px; min-height: 30px; padding: 4px; border-radius: 6px; transition: color var(--t-fast);
  }
  .eye-btn:hover { color: var(--c-orange); }
  .consent-group { margin-top: 18px; margin-bottom: 22px; }
  .checkbox-label {
    display: flex; align-items: flex-start; gap: 10px; cursor: pointer;
    font-size: 12.5px; font-weight: 500; color: var(--c-text-2); line-height: 1.5;
  }
  .checkbox-label input[type="checkbox"] {
    width: 18px; height: 18px; margin-top: 1px; accent-color: var(--c-orange); cursor: pointer; flex-shrink: 0;
  }

  .submit-btn {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px; background: var(--c-brand-gradient, linear-gradient(135deg, #bef264 0%, #c2410c 100%));
    color: white; border: none; border-radius: 12px; font-size: 15.5px; font-weight: 800; cursor: pointer;
    text-decoration: none;
    transition: transform var(--t-base), opacity var(--t-base), box-shadow var(--t-base);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--c-orange) 40%, transparent);
  }
  .submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 22px color-mix(in srgb, var(--c-orange) 50%, transparent); }
  .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .submit-btn.as-link { margin-top: 18px; }

  .footer { margin-top: 22px; text-align: center; font-size: 13px; color: var(--c-muted); }
  .footer a { color: var(--c-orange); text-decoration: none; font-weight: 700; }
  .footer a:hover { text-decoration: underline; }
  .dot { margin: 0 6px; opacity: 0.6; }

  .success-panel { text-align: center; color: var(--c-text); }
  .success-panel h3 { margin: 12px 0 8px; font-size: 20px; font-weight: 800; }
  .success-panel > p { margin: 0 0 18px; color: var(--c-muted); font-size: 13.5px; line-height: 1.55; }
  .code-chip {
    display: inline-flex; align-items: center; gap: 10px; padding: 14px 20px;
    background: var(--c-bg); border: 1.5px dashed var(--c-orange); border-radius: 14px;
    color: var(--c-text); cursor: pointer; transition: all var(--t-base);
  }
  .code-chip:hover { background: color-mix(in srgb, var(--c-orange) 10%, var(--c-bg)); }
  .code-chip code { font-family: var(--font-mono, 'JetBrains Mono', monospace); font-size: 18px; font-weight: 700; letter-spacing: 0.08em; }
  .steps { text-align: left; margin: 22px 0 4px; padding-left: 20px; color: var(--c-text-2); font-size: 13px; line-height: 1.75; }

  /* Applied to a Lucide icon component, so it must be global for the compiler
     to keep it. */
  :global(.spin) { animation: spin 0.9s linear infinite; }
  .spinner {
    width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 620px) {
    .tester-card { padding: 24px 20px; }
    .row { grid-template-columns: 1fr; }
  }
</style>
