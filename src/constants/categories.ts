import {
  Baby,
  Banknote,
  Beer,
  Bike,
  Book,
  Briefcase,
  Building,
  Bus,
  Car,
  Cat,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Droplets,
  Dumbbell,
  Ellipsis,
  Film,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HandCoins,
  HandHeart,
  Heart,
  HeartPulse,
  House,
  IceCreamCone,
  Landmark,
  Laptop,
  Leaf,
  Package,
  ParkingMeter,
  PartyPopper,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Ticket,
  TrainFront,
  TrendingUp,
  Tv,
  Umbrella,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import { z } from 'zod';

import type { CategoryHue } from '@/theme/tokens';

export type Bucket = 'needs' | 'wants' | 'savings';

export type CategoryDef = {
  key: string;
  icon: LucideIcon;
  hue: CategoryHue;
  bucket: Bucket | null;
  /** Hanya kategori buatan pengguna: nama yang diketik (kategori bawaan memakai label i18n). */
  name?: string;
};

export type TxKind = 'expense' | 'income';

/** Kategori buatan pengguna, disimpan di profiles.categories. deleted = dihapus dari menu dan picker, transaksi lama tetap tampil. */
export type CustomCategory = { key: string; name: string; icon: string; type: TxKind; bucket: Bucket | null; deleted?: boolean };
/** hidden = kunci kategori bawaan yang disembunyikan dari picker. */
export type CategorySettings = { custom: CustomCategory[]; hidden: string[] };
export const EMPTY_CATEGORY_SETTINGS: CategorySettings = { custom: [], hidden: [] };
export const MAX_CUSTOM_CATEGORIES = 40;

const Settings = z.object({
  custom: z
    .array(
      z.object({
        key: z.string().regex(/^u_[a-z]{4,30}$/),
        name: z.string().trim().min(1).max(24),
        icon: z.string().max(32),
        type: z.enum(['expense', 'income']),
        bucket: z.enum(['needs', 'wants', 'savings']).nullable(),
        deleted: z.boolean().optional(),
      }),
    )
    .max(200),
  hidden: z.array(z.string().regex(/^[a-z_]{1,32}$/)).max(50),
});

/** profiles.categories dari database (data pengguna): bentuk rusak = kosong, bukan crash. */
export function parseCategorySettings(raw: unknown): CategorySettings {
  const r = Settings.safeParse(raw);
  return r.success ? r.data : EMPTY_CATEGORY_SETTINGS;
}

/** Kategori buatan yang boleh dipilih AI (yang belum dihapus): kunci, nama, jenis. */
export function aiCategories(s: CategorySettings): { key: string; name: string; type: TxKind }[] {
  return s.custom.filter((c) => !c.deleted).slice(0, MAX_CUSTOM_CATEGORIES).map(({ key, name, type }) => ({ key, name, type }));
}

/** Kunci baru "u_" + 10 huruf acak (aturan kolom category_key: huruf kecil dan "_"). */
export function newCategoryKey(): string {
  return `u_${Array.from({ length: 10 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')}`;
}

/** Ikon yang bisa dipilih untuk kategori buatan (nama disimpan sebagai teks). Impor eksplisit: tidak membawa seluruh set lucide ke bundle. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ShoppingCart,
  ShoppingBag,
  Utensils,
  Coffee,
  Pizza,
  Beer,
  Wine,
  IceCreamCone,
  Bus,
  Car,
  Bike,
  Fuel,
  ParkingMeter,
  TrainFront,
  Plane,
  House,
  Building,
  Hammer,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Smartphone,
  Tv,
  Gamepad2,
  Film,
  Ticket,
  Book,
  GraduationCap,
  HeartPulse,
  Pill,
  Stethoscope,
  Dumbbell,
  Baby,
  Dog,
  Cat,
  Shirt,
  Scissors,
  Gift,
  PartyPopper,
  Heart,
  HandHeart,
  Receipt,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
  Coins,
  Banknote,
  TrendingUp,
  Briefcase,
  HandCoins,
  Laptop,
  Package,
  Wrench,
  Leaf,
  Umbrella,
  Ellipsis,
};
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function categoryIcon(name: string): LucideIcon {
  // hasOwn: nama dari database; "constructor"/"toString" tidak boleh terbaca sebagai ikon.
  return Object.hasOwn(CATEGORY_ICONS, name) ? CATEGORY_ICONS[name]! : Ellipsis;
}

/** Kategori bawaan. Label per bahasa: `domain.category.<key>` di katalog i18n. Pengguna bisa menambah kategori kustom (FR-SET-2) di Fase 1–2. */
export const CATEGORIES: CategoryDef[] = [
  { key: 'groceries', icon: ShoppingCart, hue: 'jade', bucket: 'needs' },
  { key: 'food', icon: Utensils, hue: 'saffron', bucket: 'needs' },
  { key: 'transport', icon: Bus, hue: 'sky', bucket: 'needs' },
  { key: 'fuel', icon: Car, hue: 'slate', bucket: 'needs' },
  { key: 'housing', icon: House, hue: 'clay', bucket: 'needs' },
  { key: 'utilities', icon: Zap, hue: 'olive', bucket: 'needs' },
  { key: 'phone', icon: Smartphone, hue: 'teal', bucket: 'needs' },
  { key: 'health', icon: HeartPulse, hue: 'rose', bucket: 'needs' },
  { key: 'education', icon: GraduationCap, hue: 'plum', bucket: 'needs' },
  { key: 'hangout', icon: Coffee, hue: 'coral', bucket: 'wants' },
  { key: 'shopping', icon: Shirt, hue: 'rose', bucket: 'wants' },
  { key: 'entertainment', icon: Film, hue: 'plum', bucket: 'wants' },
  { key: 'travel', icon: Plane, hue: 'sky', bucket: 'wants' },
  { key: 'gift', icon: Gift, hue: 'coral', bucket: 'wants' },
  { key: 'bills', icon: Receipt, hue: 'olive', bucket: 'needs' },
  { key: 'savings', icon: PiggyBank, hue: 'jade', bucket: 'savings' },
  { key: 'debt', icon: CreditCard, hue: 'clay', bucket: 'savings' },
  { key: 'salary', icon: Briefcase, hue: 'jade', bucket: null },
  { key: 'investment_income', icon: TrendingUp, hue: 'teal', bucket: null },
  { key: 'freelance', icon: HandCoins, hue: 'saffron', bucket: null },
  { key: 'bank', icon: Landmark, hue: 'slate', bucket: 'needs' },
  { key: 'other', icon: Ellipsis, hue: 'slate', bucket: 'wants' },
];

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));
/** Kategori bawaan untuk pemasukan; sisanya pengeluaran ('other' ada di keduanya). */
const INCOME_KEYS = ['salary', 'freelance', 'investment_income', 'other'];
const HUES: CategoryHue[] = ['saffron', 'coral', 'rose', 'plum', 'sky', 'teal', 'jade', 'olive', 'clay', 'slate'];

/**
 * Kategori pengguna untuk getCategory/categoryLabel yang dipanggil di banyak tempat tanpa akses state.
 * Diisi AppStore setiap state kategori berubah (setUserCategories).
 */
let user = { custom: new Map<string, CategoryDef & { type: TxKind; deleted: boolean }>(), hidden: new Set<string>() };

export function setUserCategories(s: CategorySettings): void {
  user = {
    custom: new Map(
      s.custom.map((c) => {
        // Warna tetap per kunci, dari palet kategori yang sama.
        const hue = HUES[[...c.key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % HUES.length]!;
        return [c.key, { key: c.key, icon: categoryIcon(c.icon), hue, bucket: c.type === 'income' ? null : c.bucket, name: c.name, type: c.type, deleted: !!c.deleted }];
      }),
    ),
    hidden: new Set(s.hidden),
  };
}

export function getCategory(key: string): CategoryDef {
  return byKey.get(key) ?? user.custom.get(key) ?? byKey.get('other')!;
}

export function isBuiltinCategory(key: string): boolean {
  return byKey.has(key);
}

/** Kategori bawaan untuk satu jenis transaksi, termasuk yang disembunyikan (untuk menu Kategori). */
export function builtinFor(type: TxKind): CategoryDef[] {
  return CATEGORIES.filter((c) => (type === 'income' ? INCOME_KEYS.includes(c.key) : c.key === 'other' || !INCOME_KEYS.includes(c.key)));
}

/** Pilihan di picker: bawaan yang tidak disembunyikan + buatan pengguna yang tidak dihapus. `keep` = nilai sekarang, selalu ikut. */
export function categoriesFor(type: TxKind, keep?: string | null): CategoryDef[] {
  const custom = [...user.custom.values()].filter((c) => c.type === type && !c.deleted);
  const list = [...builtinFor(type).filter((c) => !user.hidden.has(c.key)), ...custom];
  return keep && !list.some((c) => c.key === keep) && (byKey.has(keep) || user.custom.has(keep)) ? [...list, getCategory(keep)] : list;
}

/** Semua kategori yang bisa punya data (bawaan + buatan pengguna, termasuk yang dihapus): budget, filter. */
export function allCategories(): CategoryDef[] {
  return [...CATEGORIES, ...user.custom.values()];
}
