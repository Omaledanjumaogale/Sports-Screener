// src/lib/payments.ts
// Single source of truth for PulseOdds subscription plans, prices and the
// official Flutterwave checkout/payment links used across the app.

export type PlanTier = 'punter' | 'master';

export const PLAN_TIERS: PlanTier[] = ['punter', 'master'];

export const PLAN_AMOUNT: Record<PlanTier, number> = {
  punter: 5000,
  master: 10000
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  punter: 'Punter Pass',
  master: 'Master Punter Pass'
};

// ₦10,000 Master Pass web-checkout link (a0jwn1nokemx). Overridable via env for
// local testing; the default is the official link confirmed for the Master tier.
export const MASTER_PAYMENT_LINK: string =
  (import.meta as any)?.env?.VITE_FLW_MASTER_PAYMENT_LINK || 'https://flutterwave.com/pay/a0jwn1nokemx';

// ₦5,000 Punter Pass web-checkout link (ndypongylu8q).
export const PUNTER_PAYMENT_LINK: string =
  (import.meta as any)?.env?.VITE_FLW_PAYMENT_LINK || 'https://flutterwave.com/pay/ndypongylu8q';

export const PAYMENT_LINK: Record<PlanTier, string> = {
  punter: PUNTER_PAYMENT_LINK,
  master: MASTER_PAYMENT_LINK
};

export const FLW_PUBLIC_KEY: string =
  (import.meta as any)?.env?.VITE_FLW_PUBLIC_KEY || 'FLWPUBK-3d7724be-0c38-4ba7-bbb0-6bfab94637b1-X';

export function amountFor(tier: PlanTier): number {
  return PLAN_AMOUNT[tier] ?? PLAN_AMOUNT.punter;
}

export function labelFor(tier: PlanTier): string {
  return PLAN_LABEL[tier] ?? PLAN_LABEL.punter;
}

export function linkFor(tier: PlanTier): string {
  return PAYMENT_LINK[tier] ?? PAYMENT_LINK.punter;
}