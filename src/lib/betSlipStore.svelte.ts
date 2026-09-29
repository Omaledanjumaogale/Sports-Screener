// ── Bet slip store ────────────────────────────────────────────────────────────
// Reactive store for the user's accumulative bet slip plus its saved history.
// Items are added from the research & analysis summary surfaces across fixtures
// and sports; the OPEN slip persists to Convex (authenticated or sessionId) and
// can be sealed into the history so later fixtures keep a fresh slip while the
// sealed one is graded from the finished scorelines.

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

export interface ArchivedSlip {
  id: string;
  label: string;
  sealedAt: number;
  items: BetSlipItem[];
}

let items = $state<BetSlipItem[]>([]);
let archived = $state<ArchivedSlip[]>([]);
let loaded = $state(false);
let saving = $state(false);

export function betSlipCount(): number {
  return items.length;
}

export function betSlipItems(): BetSlipItem[] {
  return items;
}

export function archivedSlips(): ArchivedSlip[] {
  return archived;
}

export function isInSlip(matchId: string, selection: string): boolean {
  return items.some((i) => i.matchId === matchId && i.selection === selection);
}

export function totalOdds(): number {
  return items.reduce((acc, i) => acc * i.odds, 1);
}

// A leg is "settled" as soon as its fixture's final score is known (the grade
// may still be absent for markets a plain scoreline cannot settle).
export function settledCount(): number {
  return items.filter((i) => i.finalScore).length;
}

export function wonCount(): number {
  return items.filter((i) => i.grade === 'win').length;
}

export function loseCount(): number {
  return items.filter((i) => i.grade === 'loss').length;
}

export function openCount(): number {
  return items.filter((i) => !i.finalScore).length;
}

export function finishedCount(): number {
  return items.filter((i) => !!i.finalScore).length;
}

async function persist(): Promise<void> {
  if (saving) return;
  saving = true;
  try {
    await callConvex('betSlips:saveSlip', { sessionId: getSessionId(), items });
  } catch {
    /* offline — items stay in the reactive store, retried on next change */
  } finally {
    saving = false;
  }
}

export async function addToSlip(item: BetSlipItem): Promise<void> {
  if (isInSlip(item.matchId, item.selection)) return;
  items = [...items, item];
  await persist();
}

export async function removeFromSlip(matchId: string, selection: string): Promise<void> {
  items = items.filter((i) => !(i.matchId === matchId && i.selection === selection));
  await persist();
}

export async function clearSlip(): Promise<void> {
  items = [];
  await persist();
}

// ── History ───────────────────────────────────────────────────────────────────
// Seal the current open slip into the history (label defaults to its date) and
// start a fresh open slip. Sealed slips keep grading from the score sync.
export async function archiveCurrentSlip(label?: string): Promise<void> {
  if (items.length === 0) return;
  const text = label?.trim() || new Date().toLocaleDateString('en-GB');
  try {
    await callConvex('betSlips:archiveSlip', { sessionId: getSessionId(), label: text });
    items = [];
    await loadSlips(true);
  } catch {
    /* non-fatal */
  }
}

export async function deleteArchivedSlip(id: string): Promise<void> {
  try {
    await callConvex('betSlips:deleteSlipById', { sessionId: getSessionId(), id });
    archived = archived.filter((s) => s.id !== id);
  } catch {
    /* non-fatal */
  }
}

export async function loadSlip(): Promise<void> {
  if (loaded) return;
  await loadSlips(false);
}

export async function loadSlips(force = false): Promise<void> {
  if (loaded && !force) return;
  try {
    const res = await queryConvex<{
      open?: { items?: BetSlipItem[] } | null;
      archived?: ArchivedSlip[];
    } | null>('betSlips:listSlips', { sessionId: getSessionId() });
    items = res?.open?.items ?? [];
    archived = res?.archived ?? [];
  } catch {
    /* offline — keep whatever is in the reactive store */
  } finally {
    loaded = true;
  }
}

function slipLines(list: BetSlipItem[]): string {
  return list
    .map((i, idx) => {
      const grade = i.grade ? ` [${i.grade.toUpperCase()}]` : i.finalScore ? ` [FT ${i.finalScore}]` : '';
      return `${idx + 1}. ${i.homeTeam} vs ${i.awayTeam} (${i.league})\n   ${i.selection} @ ${i.odds.toFixed(2)} (${i.publishedPct}%)${grade}`;
    })
    .join('\n');
}

export function buildWhatsAppText(): string {
  const lines = slipLines(items);
  const combined = items.length > 1 ? `\nCombined odds: ${totalOdds().toFixed(2)}` : '';
  return `⚡ PulseOdds Bet Slip\n${'─'.repeat(24)}\n${lines}${combined}\n${'─'.repeat(24)}\nBeat the bookies 📊`;
}

export function whatsappShareUrl(): string {
  return `https://wa.me/?text=${encodeURIComponent(buildWhatsAppText())}`;
}

export function whatsAppShareUrlFor(list: BetSlipItem[], title = 'PulseOdds Bet Slip'): string {
  return `https://wa.me/?text=${encodeURIComponent(`⚡ ${title}\n${'─'.repeat(24)}\n${slipLines(list)}\n${'─'.repeat(24)}`)}`;
}
