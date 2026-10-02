<script lang="ts">
  import { getConvexClient, api, convexErrorMessage } from '$lib/convexClient';
  import { onMount } from 'svelte';
  let available = $state<boolean | null>(null);
  onMount(() => { void getConvexClient().then(client=>client.query('email:recoveryAvailability',{})).then(result=>available=!!result.available).catch(()=>available=false); });
  let email = $state('');
  let code = $state('');
  let password = $state('');
  let requested = $state(false);
  let completed = $state(false);
  let busy = $state(false);
  let error = $state('');
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !available) return;
    busy = true;
    error = '';
    try {
      const client = await getConvexClient();
      if (!requested) {
        await client.action(api.email.requestPasswordReset, { email: email.trim() });
        requested = true;
      } else {
        await client.action(api.email.completePasswordReset, { email: email.trim(), code: code.trim(), newPassword: password });
        completed = true;
      }
    } catch (err) {
      error = convexErrorMessage(err, 'Could not complete password recovery. Please retry or contact support.');
    } finally { busy = false; }
  }
</script>

<svelte:head><title>Recover your account | PulseOdds</title><meta name="robots" content="noindex" /></svelte:head>
<main class="recovery">
  <a href="/auth">← Back to login</a>
  <h1>{completed ? 'Password updated' : 'Recover your account'}</h1>
  {#if completed}
    <p>Your previous sessions have been ended. Sign in with your new password.</p>
    <a class="primary" href="/auth">Continue to login</a>
  {:else}
    <p>{requested ? 'If this account can receive recovery email, a code has been sent. Paste it below. It expires after 30 minutes.' : 'Enter your account email to request a recovery code.'}</p>
    {#if available===false}<p role="status">Email recovery is currently unavailable. Contact the administrator for account recovery.</p>{/if}
    <form onsubmit={submit}>
      <label for="recovery-email">Account email</label>
      <input id="recovery-email" type="email" bind:value={email} required maxlength="254" autocomplete="email" readonly={requested} />
      {#if requested}
        <label for="recovery-code">Recovery code</label>
        <input id="recovery-code" bind:value={code} required minlength="48" maxlength="48" autocomplete="one-time-code" />
        <label for="recovery-password">New password</label>
        <input id="recovery-password" type="password" bind:value={password} required minlength="8" maxlength="256" autocomplete="new-password" />
      {/if}
      {#if error}<p role="alert" class="error">{error}</p>{/if}
      <button type="submit" disabled={busy || !available}>{busy ? 'Please wait…' : requested ? 'Update password' : 'Send recovery code'}</button>
    </form>
  {/if}
</main>

<style>
  .recovery { width: min(440px, calc(100% - 32px)); margin: 8vh auto; padding: 28px; border: 1px solid var(--c-border); border-radius: 24px; background: var(--c-bg-2); }
  h1 { font-size: 28px; letter-spacing: -0.03em; }
  p { line-height: 1.65; color: var(--c-muted); }
  form { display: grid; gap: 12px; }
  label { font-weight: 600; margin-top: 12px; }
  input { width: 100%; box-sizing: border-box; min-height: 48px; padding: 12px; border-radius: 10px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text); font: inherit; }
  button, .primary { min-height: 48px; padding: 12px 18px; margin-top: 16px; background: var(--brand); color: #07120d; border: 0; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: wait; }
  a { color: var(--brand); }
  .error { color: #f87171; }
</style>
