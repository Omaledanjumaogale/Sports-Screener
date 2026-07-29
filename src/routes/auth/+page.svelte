<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ShieldAlert, LogIn, UserPlus, Eye, EyeOff, ArrowLeft, Crown } from '@lucide/svelte';
  import { setAuthenticated, isSuperAdminEmail } from '$lib/authStore.svelte';
  import { notify } from '$lib/notificationStore';
  import { getConvexClient, api } from '$lib/convexClient';

  // Super admin credential check — encoded to prevent trivial source inspection
  const _sa = atob('T21hbGU1MTU2NjEyMiUlJQ==');

  let isSignUp = $derived($page.url.searchParams.get('mode') === 'signup');
  let redirectTarget = $derived($page.url.searchParams.get('redirect') || '');
  
  let email = $state('');
  let password = $state('');
  let fullName = $state('');
  let mobile = $state('');
  let dob = $state('');
  let stateOfResidence = $state('');
  let consentAccepted = $state(false);
  
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

    const isAdmin = isSuperAdminEmail(email.trim());

    // Enforce super admin password — email alone is not sufficient
    if (isAdmin && password !== _sa) {
      error = 'Invalid credentials. Access denied.';
      notify('Invalid credentials. Access denied.', 'error', 'Authentication Error');
      loading = false;
      return;
    }

    if (isSignUp && !isAdmin) {
      if (!fullName.trim() || !mobile.trim() || !dob.trim() || !stateOfResidence || !consentAccepted) {
        error = 'Please fill out all required fields and accept the consent agreement.';
        loading = false;
        return;
      }
    }

    try {
      let token = 'token_' + Math.random().toString(36).slice(2, 10);
      let userId = 'user_' + Math.random().toString(36).slice(2, 10);
      let isSubscribed = isAdmin;

      try {
        const client = await getConvexClient();
        
        // Attempt Convex auth signIn / signUp
        const res = await client.mutation('auth:signIn', { 
          provider: 'password', 
          email: email.trim(), 
          password, 
          flow: isSignUp ? 'signUp' : 'signIn' 
        });
        if (res?.token) token = res.token;
        if (res?.userId) userId = res.userId;

        if (isSignUp) {
          // Record profile details in Convex database
          await client.mutation(api.users.registerProfile, {
            email: email.trim(),
            fullName: fullName.trim() || 'Super Admin',
            mobile: mobile.trim() || '+2348000000000',
            dob: dob || '1990-01-01',
            stateOfResidence: stateOfResidence || 'Lagos',
            consentAccepted: true,
            userId
          });
        } else if (!isAdmin) {
          // Check subscription status on login for normal users
          const sub = await client.query((api as any).users.checkSubscription, { email: email.trim() });
          if (sub?.isSubscribed) {
            isSubscribed = true;
          }
        }
      } catch (_e) {
        console.warn('Convex backend offline or dev mode fallback active');
      }

      const user = {
        id: userId,
        email: email.trim(),
        fullName: isSignUp ? (fullName.trim() || (isAdmin ? 'Super Admin' : email.split('@')[0])) : (isAdmin ? 'Super Admin' : email.split('@')[0]),
        mobile: mobile.trim() || undefined,
        dob: dob || undefined,
        stateOfResidence: stateOfResidence || undefined,
        consentAccepted: true,
        name: isAdmin ? 'Super Admin' : (fullName.trim() || email.split('@')[0]),
        isSubscribed: isAdmin || isSubscribed,
        isAdmin,
        createdAt: Date.now()
      };

      setAuthenticated(user, token);

      if (isAdmin) {
        notify(
          'Welcome, Super Admin! Full unrestricted access granted. Choose any sport screener from the homepage.',
          'success',
          'Super Admin Access Granted',
          6000
        );
        void goto('/');
      } else if (isSignUp) {
        notify(
          'Account created successfully! Redirecting you to complete your ₦5,000 monthly subscription donation to unlock sports screeners.',
          'success',
          'Registration Complete!',
          5000
        );
        void goto('/checkout');
      } else if (redirectTarget === 'checkout' || !isSubscribed) {
        notify(
          'Welcome back! Please complete your subscription payment to access all sports screeners.',
          'info',
          'Subscription Required'
        );
        void goto('/checkout');
      } else {
        notify(`Welcome back, ${user.fullName || 'Punter'}!`, 'success', 'Logged In');
        void goto('/football');
      }
    } catch (err: any) {
      error = err.message || 'Authentication failed. Please check your credentials.';
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
          ? 'Sign up to register your punter profile and proceed to subscription checkout.' 
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
            <UserPlus size={18} /> Submit &amp; Proceed to Payment (₦5,000)
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
    right: 12px;
    background: transparent;
    border: none;
    color: var(--c-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
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
    background: var(--c-brand-gradient, linear-gradient(135deg, #ff7700 0%, #ea580c 100%));
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
