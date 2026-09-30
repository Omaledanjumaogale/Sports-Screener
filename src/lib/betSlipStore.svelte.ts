// ── Bet slip store (multi-slip) ──────────────────────────────────────────────
// Users create NAMED bet slips, each an independent entity with its own title,
// stake, items, and post-match grading. Slips persist to Convex and coexist —
// saving one never touches another.
//
// Architecture:
//   • slips: SavedSlip[] — all persisted slips (from Convex listSlips)
//   • builder: { title, stake, items } — the slip currently being built/edited
//   • builderSlipId: string | null — null = building a NEW slip
//
// "Add to slip" in the match card pushes into the builder; "Save slip"
// persists the builder to Convex (create or update). Each saved slip is
// independent — saving one never overwrites another.

import { queryConvex, callConvex, getSessionId } from './convexClient';

export interface BetSlipItem {
  sportId: string;
  dayKey: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  marketTitle: string;
  selection: string;
  odds: number;
  publishedPct: number;
  kickoff: number;
  finalScore?: string;
  grade?: 'win' | 'loss' | 'push' | 'void';
}

export interface SavedSlip {
  _id: string;
  title: string;
  stake: number;
  userName?: string;
  items: BetSlipItem[];
  createdAt: number;
  updatedAt: number;
}

// ── Reactive state ───────────────────────────────────────────────────────────
let slips = $state<SavedSlip[]>([]);
let builderItems = $state<BetSlipItem[]>([]);
let builderTitle = $state('');
let builderStake = $state(0);
let builderSlipId = $state<string | null>(null);
let slipsLoaded = $state(false);

// ── Builder (the slip being built/edited) ────────────────────────────────────
export function builderItemCount(): number {
  return builderItems.length;
}

export function builderTotalOdds(): number {
  return builderItems.reduce((acc, i) => acc * i.odds, 1);
}

export function builderPotentialWin(): number {
  return builderTotalOdds() * builderStake;
}

export function builderGetTitle(): string {
  return builderTitle;
}

export function builderGetStake(): number {
  return builderStake;
}

export function builderGetItems(): BetSlipItem[] {
  return builderItems;
}

export function builderGetId(): string | null {
  return builderSlipId;
}

export function isInBuilder(matchId: string, selection: string): boolean {
  return builderItems.some((i) => i.matchId === matchId && i.selection === selection);
}

export function startNewBuilder(): void {
  builderSlipId = null;
  builderTitle = '';
  builderStake = 0;
  builderItems = [];
}

export function loadIntoBuilder(slip: SavedSlip): void {
  builderSlipId = slip._id;
  builderTitle = slip.title;
  builderStake = slip.stake;
  builderItems = [...slip.items];
}

export function setBuilderTitle(title: string): void {
  builderTitle = title;
}

export function setBuilderStake(stake: number): void {
  builderStake = stake;
}

export function addToBuilder(item: BetSlipItem): void {
  if (isInBuilder(item.matchId, item.selection)) return;
  builderItems = [...builderItems, item];
}

export function removeFromBuilder(matchId: string, selection: string): void {
  builderItems = builderItems.filter((i) => !(i.matchId === matchId && i.selection === selection));
}

// ── Persistence ──────────────────────────────────────────────────────────────
export async function saveBuilderSlip(): Promise<string | null> {
  if (builderItems.length === 0) return null;
  const title = builderTitle.trim() || `Bet Slip ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  try {
    if (builderSlipId) {
      await callConvex('betSlips:updateSlip', {
        slipId: builderSlipId,
        title,
        stake: builderStake,
        items: builderItems
      });
      return builderSlipId;
    }
    const slipId = await callConvex<string>('betSlips:createSlip', {
      sessionId: getSessionId(),
      title,
      stake: builderStake,
      items: builderItems
    });
    builderSlipId = slipId;
    return slipId;
  } catch {
    return null;
  }
}

// ── Saved slips (from Convex) ────────────────────────────────────────────────
export function savedSlips(): SavedSlip[] {
  return slips;
}

export async function loadSlips(): Promise<void> {
  try {
    const res = await queryConvex<SavedSlip[]>('betSlips:listSlips', { sessionId: getSessionId() });
    slips = Array.isArray(res) ? res : [];
    slipsLoaded = true;
  } catch {
    slipsLoaded = true;
  }
}

export async function deleteSavedSlip(slipId: string): Promise<void> {
  try {
    await callConvex('betSlips:deleteSlip', { slipId });
    slips = slips.filter((s) => s._id !== slipId);
  } catch { /* non-fatal */ }
}

export async function refreshSlips(): Promise<void> {
  await loadSlips();
}

// ── PDF / WhatsApp text builders (per slip) ──────────────────────────────────
export function buildSlipText(slip: { title: string; stake: number; items: BetSlipItem[]; userName?: string }): string {
  const total = slip.items.reduce((acc, i) => acc * i.odds, 1);
  const potential = total * slip.stake;
  const lines = slip.items.map((i, idx) =>
    `${idx + 1}. ${i.homeTeam} vs ${i.awayTeam} (${i.league})\n   ${i.selection} @ ${i.odds.toFixed(2)} (${i.publishedPct}%)${i.grade ? ` → ${i.grade.toUpperCase()}` : ''}${i.finalScore ? ` [FT ${i.finalScore}]` : ''}`
  );
  return `${slip.title}\n${'─'.repeat(28)}\n${lines.join('\n')}\n${'─'.repeat(28)}\nTotal odds: ${total.toFixed(2)}\nStake: ₦${slip.stake.toLocaleString()}\nPotential win: ₦${potential.toLocaleString()}\n${slip.userName ? `\n${slip.userName}` : ''}\npulseodds.ewinproject.org`;
}

export function slipWhatsAppUrl(slip: { title: string; stake: number; items: BetSlipItem[]; userName?: string }): string {
  return `https://wa.me/?text=${encodeURIComponent(buildSlipText(slip))}`;
}
