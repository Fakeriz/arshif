export type SmartLogRuleAction = 'categorize' | 'transfer';

export type SmartLogRule = {
  id: string;
  pattern: string;
  action: SmartLogRuleAction;
  categoryKey: string;
  toAccountId: string | null;
};

export type SmartLogRuleInput = Omit<SmartLogRule, 'id'>;

/** Cocokkan aturan Smart Log berdasarkan substring case-insensitive terpanjang di merchant atau kutipan notifikasi. */
export function matchSmartLogRule(rules: SmartLogRule[], merchant: string, excerpt?: string | null): SmartLogRule | null {
  if (!rules.length) return null;
  const hay = `${merchant ?? ''} ${excerpt ?? ''}`.toLowerCase();
  const candidates = rules
    .map((r) => ({ rule: r, needle: r.pattern.trim().toLowerCase() }))
    .filter((x) => x.needle.length >= 2 && hay.includes(x.needle))
    .sort((a, b) => b.needle.length - a.needle.length);
  return candidates[0]?.rule ?? null;
}
