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
  label: string;
  icon: LucideIcon;
  hue: CategoryHue;
  bucket: Bucket | null;
};

/** Kategori bawaan. Pengguna bisa menambah kategori kustom (FR-SET-2) di Fase 1–2. */
export const CATEGORIES: CategoryDef[] = [
  { key: 'groceries', label: 'Belanja Harian', icon: ShoppingCart, hue: 'jade', bucket: 'needs' },
  { key: 'food', label: 'Makan & Minum', icon: Utensils, hue: 'saffron', bucket: 'needs' },
  { key: 'transport', label: 'Transportasi', icon: Bus, hue: 'sky', bucket: 'needs' },
  { key: 'fuel', label: 'Bensin & Parkir', icon: Car, hue: 'slate', bucket: 'needs' },
  { key: 'housing', label: 'Tempat Tinggal', icon: House, hue: 'clay', bucket: 'needs' },
  { key: 'utilities', label: 'Listrik & Air', icon: Zap, hue: 'olive', bucket: 'needs' },
  { key: 'phone', label: 'Pulsa & Internet', icon: Smartphone, hue: 'teal', bucket: 'needs' },
  { key: 'health', label: 'Kesehatan', icon: HeartPulse, hue: 'rose', bucket: 'needs' },
  { key: 'education', label: 'Pendidikan', icon: GraduationCap, hue: 'plum', bucket: 'needs' },
  { key: 'hangout', label: 'Nongkrong', icon: Coffee, hue: 'coral', bucket: 'wants' },
  { key: 'shopping', label: 'Belanja', icon: Shirt, hue: 'rose', bucket: 'wants' },
  { key: 'entertainment', label: 'Hiburan', icon: Film, hue: 'plum', bucket: 'wants' },
  { key: 'travel', label: 'Liburan', icon: Plane, hue: 'sky', bucket: 'wants' },
  { key: 'gift', label: 'Hadiah & Donasi', icon: Gift, hue: 'coral', bucket: 'wants' },
  { key: 'bills', label: 'Tagihan', icon: Receipt, hue: 'olive', bucket: 'needs' },
  { key: 'savings', label: 'Tabungan', icon: PiggyBank, hue: 'jade', bucket: 'savings' },
  { key: 'debt', label: 'Cicilan & Utang', icon: CreditCard, hue: 'clay', bucket: 'savings' },
  { key: 'salary', label: 'Gaji', icon: Briefcase, hue: 'jade', bucket: null },
  { key: 'investment_income', label: 'Hasil Usaha', icon: TrendingUp, hue: 'teal', bucket: null },
  { key: 'bank', label: 'Bank & Biaya Admin', icon: Landmark, hue: 'slate', bucket: 'needs' },
  { key: 'other', label: 'Lainnya', icon: Ellipsis, hue: 'slate', bucket: 'wants' },
];

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));

export function getCategory(key: string): CategoryDef {
  return byKey.get(key) ?? byKey.get('other')!;
}
