<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ShieldAlert, LogIn, UserPlus, Eye, EyeOff, ArrowLeft, Crown, KeyRound, Smartphone } from '@lucide/svelte';
  import { setAuthenticated, isSuperAdminEmail, isTesterEmail, setUnauthenticated } from '$lib/authStore.svelte';
  import { notify } from '$lib/notificationStore';
  import { getConvexClient, api, convexSignIn, convexSignOut, convexErrorMessage } from '$lib/convexClient';
  import { getDeviceId, getDeviceLabel } from '$lib/deviceId';

  let isSignUp = $derived($page.url.searchParams.get('mode') === 'signup');
  let redirectTarget = $derived($page.url.searchParams.get('redirect') || '');
  
  let email = $state('');
  let password = $state('');
  let fullName = $state('');
  let mobile = $state('');
  let dob = $state('');
  let stateOfResidence = $state('');
  let consentAccepted = $state(false);
  // Tester accounts are a SHARED email/password, so the access code is what
  // identifies the individual tester (and binds them to one device).
  let accessCode = $state(($page.url.searchParams.get('code') || '').toUpperCase());
  
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const NIGERIAN_STATES = [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
    'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
    'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
    'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'International / Other'
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    error = null;

    const cleanEmail = email.trim().toLowerCase();
    // Identity/flag checks stay normalized, but the actual auth call must use
    // the email as typed: @convex-dev/auth resolves accounts by exact string,
    // so a lowercased input can miss an account created with different casing.
    const typedEmail = email.trim();
    const isAdmin = isSuperAdminEmail(cleanEmail);
    const isTester = isTesterEmail(cleanEmail);

    if (isSignUp && !isAdmin && !isTester) {
      if (!fullName.trim() || !mobile.trim() || !dob.trim() || !stateOfResidence || !consentAccepted) {
        error = 'Please fill out all required fields and accept the consent agreement.';
        loading = false;
        return;
      }
    }

    // Validate the credential fields before any backend round-trip. A blank
    // email/password produces an opaque "Server Error" from the auth provider
    // and was making real customers think their credentials were wrong.
    if (!typedEmail || !password) {
      error = 'Enter both your email and password to continue.';
      loading = false;
      return;
    }
    if (password.length < 8) {
      error = 'Passwords are at least 8 characters long.';
      loading = false;
      return;
    }

    try {
      // Real Convex Password-provider auth. Admin/tester accounts are provisioned
      // server-side (seeded) and always log in — never sign up. No local
      // emulation fallback: credentials are validated by the backend.
      const flow = isAdmin || isTester ? 'signIn' : isSignUp ? 'signUp' : 'signIn';
      let res = await convexSignIn({ email: typedEmail, password, flow });
      // Case-insensitive fallback: if the as-typed email matched no account,
      // retry lowercased (covers users typing a different casing than the
      // account was created with).
      if (!res?.token && typedEmail !== cleanEmail) {
        res = await convexSignIn({ email: cleanEmail, password, flow });
      }
      if (!res?.token) {
        // Distinguish "no such account" from "wrong password" from "backend
        // unreachable". The auth provider throws plain Errors with messages like
        // "Invalid credentials" that Convex redacts to "Server Error" on prod,
        // so the safe UI message is "could not verify credentials".
        if (isAdmin || isTester) {
          throw new Error(
            'Could not verify the admin/tester credentials. If this is a new deployment, the account must be seeded first (run `node scripts/seed-accounts.cjs`). Otherwise double-check the email and password — note that special characters like #, &, % must be entered exactly as issued.'
          );
        }
        throw new Error(
          isSignUp
            ? 'Could not create your account. The email may already be registered, or the password may not meet the security policy.'
            : 'Could not sign you in. Check your email and password — special characters like #, &, % must be entered exactly.'
        );
      }
      const token = res.token;
      const userId = res.subject || 'user_' + Math.random().toString(36).slice(2, 10);
      const client = await getConvexClient();

      // ── Tester accounts: code-gated, one device, 3-month trial ─────────────
      // The tester email/password is shared, so authentication alone proves
      // nothing about WHO is logging in. The access code does: it must already
      // be registered, it gets bound to THIS device on first use, and the trial
      // clock starts here. Every refusal below signs the session back out.
      if (isTester) {
        const code = accessCode.trim().toUpperCase();
        if (!code) {
          await convexSignOut();
          setUnauthenticated();
          error = 'This account needs a tester access code. Enter the code you were issued, or register your details first.';
          loading = false;
          return;
        }
        try {
          await client.mutation(api.testerCodes.activateSession, {
            code,
            deviceId: getDeviceId(),
            deviceLabel: getDeviceLabel()
          });
        } catch (activateErr: any) {
          const msg = convexErrorMessage(
            activateErr,
            'Could not activate tester access. Check your access code and try again.'
          );
          await convexSignOut();
          setUnauthenticated();
          const expired = /trial has ended|trial has expired/i.test(msg);
          notify(
            msg,
            expired ? 'warning' : 'error',
            expired ? 'Free Trial Ended' : 'Tester Access Denied',
            9000
          );
          if (expired) {
            void goto('/checkout');
          } else {
            error = msg;
          }
          loading = false;
          return;
        }
      }

      // Fetch the authoritative access state (admin/tester/subscription) from
      // the server now that the real token is attached.
      let access: any = {};
      try {
        access = await client.mutation(api.users.syncAccess, {});
      } catch (err: any) {
        console.warn('syncAccess skipped:', err?.message || err);
      }

      if (isSignUp && !isAdmin && !isTester) {
        try {
          await client.mutation(api.users.registerProfile, {
            email: cleanEmail,
            fullName: fullName.trim(),
            mobile: mobile.trim(),
            dob,
            stateOfResidence,
            consentAccepted: true,
            userId
          });
        } catch (err: any) {
          console.warn('registerProfile skipped:', err?.message || err);
        }
      }

      const isSubscribed = !!(access.isAdmin || access.isTester || access.isSubscribed);
      const testerExpired = access.isTester && !access.isSubscribed;

      // Server truth wins: syncAccess is authoritative for privileged access,
      // so an env-casing mismatch on the client can never demote a real admin
      // or tester session.
      const effectiveIsAdmin = isAdmin || !!access.isAdmin;
      const effectiveIsTester = isTester || !!access.isTester;

      const user = {
        id: userId,
        email: cleanEmail,
        fullName: isSignUp ? (fullName.trim() || (effectiveIsAdmin ? 'Super Admin' : effectiveIsTester ? 'Tester User' : cleanEmail.split('@')[0])) : (effectiveIsAdmin ? 'Super Admin' : effectiveIsTester ? 'Tester User' : cleanEmail.split('@')[0]),
        mobile: mobile.trim() || undefined,
        dob: dob || undefined,
        stateOfResidence: stateOfResidence || undefined,
        consentAccepted: true,
        name: effectiveIsAdmin ? 'Super Admin' : effectiveIsTester ? 'Tester User' : (fullName.trim() || cleanEmail.split('@')[0]),
        isSubscribed: effectiveIsAdmin || effectiveIsTester || isSubscribed,
        isAdmin: effectiveIsAdmin,
        isTester: effectiveIsTester,
        subscriptionExpiresAt: access.subscriptionExpiresAt ?? access.trialExpiresAt,
        createdAt: Date.now()
      };

      // Pass the refresh token through so the session can renew itself; without
      // it the 1-hour JWT expires and the user is signed out mid-session.
      setAuthenticated(user, token, res.refreshToken);

      if (effectiveIsAdmin) {
        notify(
          'Welcome, Super Admin! Full unrestricted access granted. Choose any sport screener from the homepage.',
          'success',
          'Super Admin Access Granted',
          6000
        );
        void goto('/');
      } else if (effectiveIsTester && !testerExpired) {
        const daysLeft = access.subscriptionExpiresAt
          ? Math.max(0, Math.ceil((access.subscriptionExpiresAt - Date.now()) / 86_400_000))
          : null;
        notify(
          daysLeft !== null
            ? `Welcome, ${user.fullName || 'Tester'}! Full Master Pass access is active on this device — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of your free trial.`
            : 'Welcome, Tester! Your free trial is active. Full unrestricted access granted to all screeners and the AI Predictor.',
          'success',
          'Tester Free Access Granted',
          8000
        );
        void goto('/predictor');
      } else if (testerExpired) {
        await convexSignOut();
        setUnauthenticated();
        notify(
          'Your 3-month free trial has ended. Subscribe to continue using the AI Predictor and screeners.',
          'warning',
          'Trial Expired',
          9000
        );
        void goto('/checkout');
      } else if (isSignUp) {
        notify(
          'Account created successfully! Choose your monthly pass to unlock the screeners (₦5,000 Punter or ₦10,000 Master Pass).',
          'success',
          'Registration Complete!',
          5000
        );
        void goto('/checkout');
      } else if (redirectTarget === 'checkout' || !isSubscribed) {
        notify(
          'Welcome back! Complete your subscription payment (₦5,000 Punter or ₦10,000 Master Pass) to access all sports screeners.',
          'info',
          'Subscription Required'
        );
        void goto('/checkout');
      } else {
        notify(`Welcome back, ${user.fullName || 'Punter'}!`, 'success', 'Logged In');
        void goto('/football');
      }
    } catch (err: any) {
      error = convexErrorMessage(err, 'Authentication failed. Please check your credentials.');
      notify(error ?? 'Authentication failed.', 'error', 'Authentication Error');
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>{isSignUp ? 'Sign Up' : 'Log In'} | PulseOdds</title>
</svelte:head>

<div class="auth-root">
  <div class="auth-card">
    <div class="auth-top-nav">
      <a href="/" class="back-home-btn">
        <ArrowLeft size={16} />
        <span>Return to Homepage</span>
      </a>
    </div>

    <div class="auth-header">
      <div class="brand">
        <span class="pulse-icon">⚡</span>
        <strong>PulseOdds</strong>
      </div>
      <h2>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
      <p class="subtitle">
        {isSignUp 
          ? 'Sign up to register your punter profile and proceed to subscription checkout (₦5,000 Punter or ₦10,000 Master Pass).' 
          : 'Log in to access your saved screeners and subscription pass.'}
      </p>
    </div>

    {#if error}
      <div class="error-banner" role="alert">
        <ShieldAlert size={16} />
        <span>{error}</span>
      </div>
    {/if}

    <form class="auth-form" onsubmit={handleSubmit}>
      {#if isSignUp}
        <!-- Full Name -->
        <div class="form-group">
          <label for="fullName">Full Name <span class="req">*</span></label>
          <input 
            type="text" 
            id="fullName" 
            bind:value={fullName} 
            placeholder="John Doe" 
            required 
            disabled={loading}
          />
        </div>
      {/if}

      <!-- Email -->
      <div class="form-group">
        <label for="email">Email Address <span class="req">*</span></label>
        <input 
          type="email" 
          id="email" 
          bind:value={email} 
          placeholder="punter@example.com" 
          required 
          disabled={loading}
        />
      </div>

      <!-- Password with Eye Toggle -->
      <div class="form-group">
        <label for="password">Password <span class="req">*</span></label>
        <div class="password-wrapper">
          <input 
            type={showPassword ? 'text' : 'password'} 
            id="password" 
            bind:value={password} 
            placeholder="••••••••" 
            required 
            disabled={loading}
          />
          <button 
            type="button" 
            class="eye-btn" 
            onclick={() => showPassword = !showPassword}
            tabindex="-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {#if showPassword}
              <EyeOff size={18} />
            {:else}
              <Eye size={18} />
            {/if}
          </button>
        </div>
      </div>

      {#if !isSignUp}
        <!-- Tester access code (the shared tester login needs one) -->
        <div class="form-group">
          <label for="accessCode">
            Tester Access Code
            <span class="optional">only for tester accounts</span>
          </label>
          <div class="code-input">
            <KeyRound size={16} />
            <input
              type="text"
              id="accessCode"
              bind:value={accessCode}
              placeholder="PDT-XXXX-XXXX"
              disabled={loading}
              autocomplete="off"
              spellcheck="false"
              maxlength="14"
              oninput={() => (accessCode = accessCode.toUpperCase())}
            />
          </div>
          <span class="field-hint">
            <Smartphone size={11} /> A tester code works on <strong>one device only</strong> and starts
            your 3-month free trial on the first device you use.
            <a href="/tester">Register your details first</a>
          </span>
        </div>
      {/if}

      {#if isSignUp}
        <!-- Mobile Number -->
        <div class="form-group">
          <label for="mobile">Mobile Number <span class="req">*</span></label>
          <input 
            type="tel" 
            id="mobile" 
            bind:value={mobile} 
            placeholder="+234 801 234 5678" 
            required 
            disabled={loading}
          />
        </div>

        <!-- Date of Birth Selector -->
        <div class="form-group">
          <label for="dob">Date of Birth <span class="req">*</span></label>
          <input 
            type="date" 
            id="dob" 
            bind:value={dob} 
            required 
            disabled={loading}
          />
        </div>

        <!-- State of Residence -->
        <div class="form-group">
          <label for="stateOfResidence">State of Residence <span class="req">*</span></label>
          <select 
            id="stateOfResidence" 
            bind:value={stateOfResidence} 
            required 
            disabled={loading}
          >
            <option value="" disabled selected>Select your state</option>
            {#each NIGERIAN_STATES as st}
              <option value={st}>{st}</option>
            {/each}
          </select>
        </div>

        <!-- Consent Checkbox -->
        <div class="form-group consent-group">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              bind:checked={consentAccepted} 
              required 
              disabled={loading}
            />
            <span class="consent-text">
              I accept the Terms &amp; Conditions and agree to stake responsibly as an intelligent punter. <span class="req">*</span>
            </span>
          </label>
        </div>
      {/if}

      <button type="submit" class="submit-btn" disabled={loading}>
        {#if loading}
          <span class="spinner"></span>
        {:else}
          {#if isSignUp}
            <UserPlus size={18} /> Submit &amp; Proceed to Payment (₦5,000 / ₦10,000)
          {:else}
            <LogIn size={18} /> Log In to PulseOdds
          {/if}
        {/if}
      </button>
    </form>

    <div class="auth-footer">
      {#if isSignUp}
        Already have an account? <a href="/auth?mode=login">Log in</a>
      {:else}
        Don't have an account? <a href="/auth?mode=signup">Sign up</a>
      {/if}
      <div class="tester-cta">
        <a href="/tester">Have a tester access code? Register here →</a>
      </div>
    </div>
  </div>
</div>

<style>
  .auth-root {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: radial-gradient(circle at top right, color-mix(in srgb, var(--c-orange) 12%, transparent), transparent 50%),
                radial-gradient(circle at bottom left, color-mix(in srgb, var(--c-rally) 12%, transparent), transparent 50%);
  }
  
  .auth-card {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 24px;
    padding: 32px 36px;
    width: 100%;
    max-width: 460px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.18);
    backdrop-filter: blur(16px);
  }

  .auth-top-nav {
    margin-bottom: 20px;
  }

  .back-home-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-muted);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    transition: all var(--t-base);
  }

  .back-home-btn:hover {
    color: var(--c-orange);
    border-color: var(--c-orange);
    background: color-mix(in srgb, var(--c-orange) 8%, var(--c-bg));
  }
  
  .brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 18px;
    margin-bottom: 16px;
    color: var(--c-text);
  }
  
  .pulse-icon {
    font-size: 24px;
    filter: drop-shadow(0 0 8px var(--c-orange));
  }
  
  .auth-header {
    text-align: center;
    margin-bottom: 28px;
  }
  
  .auth-header h2 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 800;
    color: var(--c-text);
  }
  
  .subtitle {
    margin: 0;
    color: var(--c-muted);
    font-size: 13.5px;
    line-height: 1.5;
  }
  
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: color-mix(in srgb, var(--c-red) 15%, transparent);
    color: var(--c-red);
    border: 1px solid color-mix(in srgb, var(--c-red) 30%, transparent);
    border-radius: 12px;
    margin-bottom: 24px;
    font-size: 13.5px;
    font-weight: 600;
  }
  
  .form-group {
    margin-bottom: 18px;
  }
  
  label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--c-text-2);
  }

  .req {
    color: var(--c-orange);
  }
  
  input[type="text"],
  input[type="email"],
  input[type="tel"],
  input[type="date"],
  input[type="password"],
  select {
    width: 100%;
    padding: 12px 16px;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    color: var(--c-text);
    font-size: 14.5px;
    font-family: inherit;
    outline: none;
    transition: border-color var(--t-base), box-shadow var(--t-base);
  }
  
  input:focus, select:focus {
    border-color: var(--c-orange);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-orange) 20%, transparent);
  }

  .password-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-wrapper input {
    padding-right: 46px;
  }

  .eye-btn {
    position: absolute;
    right: 10px;
    background: transparent;
    border: none;
    color: var(--c-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    min-height: 30px;
    padding: 4px;
    border-radius: 6px;
    transition: color var(--t-fast);
  }

  .eye-btn:hover {
    color: var(--c-orange);
  }

  .consent-group {
    margin-top: 22px;
    margin-bottom: 24px;
  }

  .optional {
    margin-left: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-orange) 14%, transparent);
    color: var(--c-orange);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .code-input {
    position: relative;
    display: flex;
    align-items: center;
  }
  .code-input > :global(svg) {
    position: absolute;
    left: 13px;
    color: var(--c-muted);
    pointer-events: none;
  }
  .code-input input {
    padding-left: 38px !important;
    letter-spacing: 0.08em;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-weight: 700;
    text-transform: uppercase;
  }

  .field-hint {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin-top: 7px;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--c-muted);
  }
  .field-hint a {
    color: var(--c-orange);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
  .field-hint a:hover { text-decoration: underline; }

  .tester-cta {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--c-border);
    font-size: 12.5px;
  }
  .tester-cta a { color: var(--c-muted); font-weight: 700; text-decoration: none; }
  .tester-cta a:hover { color: var(--c-orange); text-decoration: underline; }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--c-text-2);
    line-height: 1.45;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-top: 1px;
    accent-color: var(--c-orange);
    cursor: pointer;
    flex-shrink: 0;
  }
  
  .submit-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: var(--c-brand-gradient, linear-gradient(135deg, #bef264 0%, #c2410c 100%));
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 15.5px;
    font-weight: 800;
    cursor: pointer;
    transition: transform var(--t-base), opacity var(--t-base), box-shadow var(--t-base);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--c-orange) 40%, transparent);
  }
  
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 22px color-mix(in srgb, var(--c-orange) 50%, transparent);
  }
  
  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .auth-footer {
    margin-top: 24px;
    text-align: center;
    font-size: 13.5px;
    color: var(--c-muted);
  }
  
  .auth-footer a {
    color: var(--c-orange);
    text-decoration: none;
    font-weight: 700;
  }
  
  .auth-footer a:hover {
    text-decoration: underline;
  }
  
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 480px) {
    .auth-card {
      padding: 24px 20px;
    }
  }
</style>
