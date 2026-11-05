import { PRICES } from '@/lib/pricing';
import { QUOTA_WINDOW, QUOTAS, type QuotaKey } from '@/lib/quota';

// Tanpa @types/node: fs lewat jest.requireActual (bertipe any).
const fs = jest.requireActual('fs');
const path = jest.requireActual('path');
const dir = path.join(process.cwd(), 'supabase/migrations');
const sql: string = fs.readdirSync(dir).sort().map((f: string) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');

/** Ambil tuple ('plan', 'key', limit[, 'window']) dari insert plan_limits di semua migrasi. */
function planLimitSeeds(): { plan: string; key: string; limit: number | null; window: string | null }[] {
  const out: { plan: string; key: string; limit: number | null; window: string | null }[] = [];
  for (const m of sql.matchAll(/insert into public\.plan_limits[^;]*;/g)) {
    for (const t of m[0].matchAll(/\('(free|premium)', '(\w+)', (null|\d+)(?:, '(\w+)')?\)/g)) {
      out.push({ plan: t[1]!, key: t[2]!, limit: t[3] === 'null' ? null : Number(t[3]), window: t[4] ?? null });
    }
  }
  return out;
}

describe('cermin batas paket klien = seed server', () => {
  const seeds = planLimitSeeds();
  it('setiap batas klien ada di server dengan nilai sama', () => {
    for (const plan of ['free', 'premium'] as const) {
      for (const key of Object.keys(QUOTAS[plan]) as QuotaKey[]) {
        const row = seeds.find((s) => s.plan === plan && s.key === key);
        expect([key, plan, row?.limit]).toEqual([key, plan, QUOTAS[plan][key]]);
      }
    }
  });
  it('tidak ada batas server yang tidak dikenal klien', () => {
    for (const s of seeds) expect(Object.keys(QUOTAS.free)).toContain(s.key);
  });
  it('jenis batas (harian/bulanan/total/fitur) sama', () => {
    for (const s of seeds.filter((r) => r.window)) expect([s.key, QUOTA_WINDOW[s.key as QuotaKey]]).toEqual([s.key, s.window]);
    expect(sql).toMatch(/update public\.plan_limits set "window" = 'total' where key = 'accounts'/);
  });
});

describe('harga klien = tabel prices', () => {
  it('semua harga sama, tahunan = 10x bulanan', () => {
    const rows = [...sql.matchAll(/\('(monthly|yearly)', '([A-Z]{3})', (\d+), '(xendit|paddle)'\)/g)];
    expect(rows.length).toBe(6);
    for (const [, period, currency, amount] of rows) {
      expect([currency, period, Number(amount)]).toEqual([currency, period, PRICES[currency as keyof typeof PRICES][period as 'monthly']]);
    }
    for (const p of Object.values(PRICES)) expect(p.yearly).toBe(p.monthly * 10);
  });
  it('harga yang dikunci', () => {
    expect(PRICES).toEqual({ IDR: { monthly: 25000, yearly: 250000 }, MYR: { monthly: 690, yearly: 6900 }, USD: { monthly: 150, yearly: 1500 } });
  });
});
