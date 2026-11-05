import {
  Briefcase,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Ellipsis,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

import type { CategoryHue } from '@/theme/tokens';

export type Bucket = 'needs' | 'wants' | 'savings';

export type CategoryDef = {
  key: string;
  icon: LucideIcon;
  hue: CategoryHue;
  bucket: Bucket | null;
};

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
  { key: 'bank', icon: Landmark, hue: 'slate', bucket: 'needs' },
  { key: 'other', icon: Ellipsis, hue: 'slate', bucket: 'wants' },
];

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));

export function getCategory(key: string): CategoryDef {
  return byKey.get(key) ?? byKey.get('other')!;
}
