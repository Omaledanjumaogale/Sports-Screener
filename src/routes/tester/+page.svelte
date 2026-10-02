<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { convexSignIn, convexSignOut, getConvexClient, api, convexErrorMessage } from '$lib/convexClient';
  import { setUnauthenticated } from '$lib/authStore.svelte';
  let code = $state($page.url.searchParams.get('code') ?? '');
  let fullName = $state(''); let email = $state(''); let password = $state('');
  let mobile = $state(''); let region = $state(''); let consent = $state(false);
  let existing = $state(false); let busy = $state(false); let error = $state('');
  async function register(event: SubmitEvent) {
    event.preventDefault(); if (busy) return; busy = true; error = '';
    try {
      const client = await getConvexClient();
      const check = await client.mutation(api.testerCodes.checkCode, { code });
      if (!check.found || ['suspended', 'revoked'].includes(check.status)) throw new Error('This code is unavailable. Contact the administrator.');
      const auth = await convexSignIn({ email: email.trim().toLowerCase(), password, flow: existing ? 'signIn' : 'signUp' });
      if (!auth?.token) throw new Error('Could not authenticate your personal account.');
      const result = await client.mutation(api.testerCodes.register, { code, fullName, actualEmail: email.trim().toLowerCase(), mobile, stateOfResidence: region, consentAccepted: consent });
      if (!result.ok) throw new Error(result.message);
      await convexSignOut(); setUnauthenticated();
      await goto(`/auth?mode=login&code=${encodeURIComponent(code.toUpperCase())}`);
    } catch (reason) {
      error = convexErrorMessage(reason, 'Registration failed. If your account was created, select the existing-account option and retry.');
      await convexSignOut().catch(() => {}); setUnauthenticated();
    } finally { busy = false; }
  }
</script>
<svelte:head><title>Personal tester registration | PulseOdds</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main class="registration">
  <a href="/">← Back to home</a><p class="eyebrow">PulseOdds / Tester access</p>
  <h1>Your account. Your trial.</h1>
  <p>Use your personal email and password. An issued code grants a 90-day trial starting at first activation. Existing testers can claim their legacy code with the personal email previously registered. The original trial expiry is preserved.</p>
  <p>National identification numbers are no longer collected. Contact an administrator when changing devices.</p>
  <form onsubmit={register}>
    <label>Issued access code<input bind:value={code} required maxlength="32" autocomplete="off" /></label>
    <label>Full name<input bind:value={fullName} required minlength="3" maxlength="120" autocomplete="name" /></label>
    <label>Personal email<input type="email" bind:value={email} required maxlength="254" autocomplete="email" /></label>
    <label>Password<input type="password" bind:value={password} required minlength="8" maxlength="256" autocomplete={existing ? 'current-password' : 'new-password'} /></label>
    <label>Mobile number<input type="tel" bind:value={mobile} required maxlength="24" autocomplete="tel" /></label>
    <label>State or region<input bind:value={region} required maxlength="100" autocomplete="address-level1" /></label>
    <label class="check"><input type="checkbox" bind:checked={existing} /> I already have a personal account</label>
    <label class="check"><input type="checkbox" bind:checked={consent} required /> I accept the terms and consent to storing these account details for trial administration.</label>
    {#if error}<p role="alert" class="error">{error}</p>{/if}
    <button disabled={busy}>{busy ? 'Registering…' : 'Register personal tester account'}</button>
  </form>
  <a href="/auth">Already registered? Sign in</a>
</main>
<style>
  .registration{max-width:640px;margin:40px auto;padding:28px;background:var(--c-bg-2);border:1px solid var(--c-border);border-radius:24px;color:var(--c-text)}
  h1{font-size:clamp(2rem,5vw,3rem);line-height:1.1}p{line-height:1.65}.eyebrow{color:var(--brand)}form{display:grid;gap:16px;margin:28px 0}label{display:grid;gap:7px;font-weight:600}input{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid var(--c-border);background:var(--c-bg);color:var(--c-text);font:inherit}.check{display:flex;align-items:flex-start;font-weight:400}.check input{width:auto;margin-top:4px}button{padding:14px;border:0;border-radius:12px;background:var(--brand);color:var(--c-bg);font:inherit;font-weight:700}.error{color:var(--c-error)}a{color:var(--accent2)}@media(max-width:640px){.registration{margin:16px;padding:20px}}
</style>
