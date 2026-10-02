/** Shared validation for provider verification and webhook settlement. */
export function verifiedPayment(data: any, expected?: { email?: string; reference?: string }) {
  const email = String(data?.customer?.email ?? '').trim().toLowerCase();
  const reference = String(data?.tx_ref ?? '').trim();
  const amount = Number(data?.amount);
  if (data?.status !== 'successful' || !email || !reference || !data?.id) throw new Error('Unsuccessful or incomplete transaction');
  if (String(data.currency).toUpperCase() !== 'NGN' || !Number.isFinite(amount) || ![5000, 10000].includes(amount)) throw new Error('Invalid plan amount or currency');
  if (expected?.email && email !== expected.email.trim().toLowerCase()) throw new Error('Payment customer mismatch');
  if (expected?.reference && reference !== expected.reference) throw new Error('Payment reference mismatch');
  return { email, txRef: reference, transactionId: String(data.id), amount, tier: amount === 10000 ? 'master' as const : 'punter' as const };
}

export async function validWebhookSignature(raw: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const expected = btoa(String.fromCharCode(...bytes));
  if (signature.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
