import { catalogFor, LANGS, translate, type Lang } from '@/i18n';
import type { Catalog } from '@/i18n/types';

// Tanpa @types/node: ambil fs lewat jest dengan tipe minimal yang dipakai di sini.
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(p: string): string[];
  readFileSync(p: string, enc: 'utf8'): string;
  statSync(p: string): { isDirectory(): boolean };
}>('fs');
const join = (...parts: string[]) => parts.join('/');

/** Ratakan katalog jadi { "a.b.c": "teks" }. */
function flatten(node: Catalog, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const flat = Object.fromEntries(LANGS.map((l) => [l.key, flatten(catalogFor(l.key) as unknown as Catalog)])) as Record<Lang, Record<string, string>>;
const idKeys = Object.keys(flat.id).sort();
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const others = LANGS.filter((l) => l.key !== 'id').map((l) => l.key);

describe('katalog i18n', () => {
  it('ada teks Indonesia sebagai sumber', () => expect(idKeys.length).toBeGreaterThan(300));

  it.each(others)('%s punya kunci yang sama persis dengan id', (lang) => {
    expect(Object.keys(flat[lang]).sort()).toEqual(idKeys);
  });

  it.each(LANGS.map((l) => l.key))('%s: tidak ada teks kosong, em dash, atau sisa {} rusak', (lang) => {
    for (const [key, text] of Object.entries(flat[lang])) {
      expect([key, text.trim().length > 0]).toEqual([key, true]);
      expect([key, text.includes('—')]).toEqual([key, false]);
      expect([key, /\{[^}\w]|\{\}/.test(text)]).toEqual([key, false]);
    }
  });

  it.each(others)('%s memakai placeholder yang sama dengan id', (lang) => {
    for (const key of idKeys) {
      expect([key, placeholders(flat[lang][key])]).toEqual([key, placeholders(flat.id[key])]);
    }
  });

  it('setiap kunci _one punya pasangan bentuk biasa', () => {
    for (const key of idKeys.filter((k) => k.endsWith('_one'))) {
      expect(flat.id[key.slice(0, -4)]).toBeDefined();
    }
  });
});

describe('translate', () => {
  it('menyisipkan nilai', () => {
    expect(translate('id', 'common.currency', { name: 'Ringgit Malaysia' })).toBe('Mata uang Ringgit Malaysia');
    expect(translate('tr', 'common.health.a11y', { score: 72, band: 'İyi' })).toBe('Finansal sağlık puanı 100 üzerinden 72, İyi');
  });

  it('memilih bentuk tunggal hanya saat count = 1', () => {
    const one = idKeys.find((k) => k.endsWith('_one'));
    if (!one) return;
    const base = one.slice(0, -4);
    const vars = Object.fromEntries(placeholders(flat.en[base]).map((p) => [p, p === 'count' ? 1 : 'x']));
    expect(translate('en', base as never, { ...vars, count: 1 })).toBe(translate('en', one as never, { ...vars, count: 1 }));
    expect(translate('en', base as never, { ...vars, count: 2 })).not.toBe(translate('en', one as never, { ...vars, count: 2 }));
  });

  it('kunci tak dikenal tidak pernah menghasilkan layar kosong', () => {
    expect(translate('en', 'tidak.ada' as never)).toBe('tidak.ada');
  });
});

/** Penjaga regresi: teks UI tidak boleh ditulis langsung di JSX lagi (kecuali Lembar Desain dev). */
describe('tidak ada teks UI yang ditulis langsung', () => {
  const root = join(__dirname, '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  ['app', 'components', 'features'].forEach((d) => walk(join(root, d)));
  const scanned = files.filter((f) => !f.includes('design-sheet') && !f.endsWith('design.tsx'));
  const ALLOWED = new Set(['Arshif', 'PRO']);

  it.each(scanned.map((f) => [f.slice(root.length + 1), f]))('%s', (_, file) => {
    const src = readFileSync(file, 'utf8');
    const jsxText = [...src.matchAll(/>\s*([A-Za-zÀ-ž][A-Za-zÀ-ž ,.!?]{2,})\s*</g)].map((m) => m[1].trim()).filter((s) => !ALLOWED.has(s));
    const props = [...src.matchAll(/(?:accessibilityLabel|label|title|subtitle|message|placeholder|confirmLabel|actionLabel)="([^"]*[a-z]{3}[^"]*)"/g)].map((m) => m[1]);
    expect([...jsxText, ...props]).toEqual([]);
  });
});
