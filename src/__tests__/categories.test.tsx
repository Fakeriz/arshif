import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import KategoriScreen from '@/app/pengaturan/kategori';
import { IconGrid } from '@/components/ui';
import { Ellipsis } from 'lucide-react-native';
import { ToastProvider } from '@/components/ui';
import { categoriesFor, categoryIcon, getCategory, parseCategorySettings, setUserCategories, EMPTY_CATEGORY_SETTINGS } from '@/constants/categories';
import { sampleState } from '@/data/sample-state';
import { I18nProvider, makeT, categoryLabel } from '@/i18n';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { normalizeStatement } from '../../supabase/functions/_shared/normalize';
import { statementPrompt } from '../../supabase/functions/_shared/prompts';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));

const KOPI = { key: 'u_kopisusu', name: 'Kopi', icon: 'Coffee', type: 'expense' as const, bucket: 'wants' as const };
afterEach(() => setUserCategories(EMPTY_CATEGORY_SETTINGS));

describe('registri kategori', () => {
  it('kategori buatan punya nama, ikon, dan bucket; kunci tak dikenal jatuh ke Lainnya', () => {
    setUserCategories({ custom: [KOPI], hidden: [] });
    const t = makeT('id');
    expect(getCategory('u_kopisusu')).toMatchObject({ key: 'u_kopisusu', bucket: 'wants', name: 'Kopi' });
    expect(categoryLabel(t, 'u_kopisusu')).toBe('Kopi');
    expect(getCategory('u_tidakada').key).toBe('other');
  });

  it('picker: bawaan yang disembunyikan dan buatan yang dihapus tidak tampil, kecuali sedang terpilih', () => {
    setUserCategories({ custom: [{ ...KOPI, deleted: true }], hidden: ['food'] });
    const keys = categoriesFor('expense').map((c) => c.key);
    expect(keys).not.toContain('food');
    expect(keys).not.toContain('u_kopisusu');
    expect(keys).toContain('other');
    expect(categoriesFor('expense', 'u_kopisusu').map((c) => c.key)).toContain('u_kopisusu');
    expect(categoriesFor('income').map((c) => c.key)).toEqual(['salary', 'investment_income', 'freelance', 'other']);
  });

  it('data rusak dari database = kosong; nama ikon dari database tidak bisa membaca properti objek', () => {
    expect(parseCategorySettings({ custom: [{ key: 'BAD KEY', name: 'x' }], hidden: [] })).toEqual(EMPTY_CATEGORY_SETTINGS);
    expect(parseCategorySettings(null)).toEqual(EMPTY_CATEGORY_SETTINGS);
    expect(categoryIcon('constructor')).toBe(categoryIcon('tidak-ada'));
  });
});

describe('AI memakai kategori buatan', () => {
  it('kunci buatan hanya diterima bila dikirim di request; nama masuk prompt sebagai data JSON', () => {
    const raw = { pages: 1, currency: 'IDR', rows: [{ date: '2026-11-01', description: 'KOPI KENANGAN', type: 'expense', amount: '25000', currency: 'IDR', categoryKey: 'u_kopisusu' }] };
    expect(normalizeStatement(raw, 'IDR').rows[0]!.categoryKey).toBe('other');
    expect(normalizeStatement(raw, 'IDR', ['u_kopisusu']).rows[0]!.categoryKey).toBe('u_kopisusu');
    expect(statementPrompt('IDR', [{ key: 'u_kopisusu', name: 'Kopi "susu"', type: 'expense' }])).toContain('name="Kopi \\"susu\\""');
  });
});

function Probe() {
  const { state } = useStore();
  return <Text testID="probe">{JSON.stringify(state.categories)}</Text>;
}

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">
          <ToastProvider>
            <AppStoreProvider preset={sampleState()}>
              {ui}
              <Probe />
            </AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );
const saved = () => JSON.parse(String(screen.getByTestId('probe').props.children)) as { custom: { name: string; deleted?: boolean }[]; hidden: string[] };

describe('menu Kategori', () => {
  it('tambah kategori sendiri, hapus (tetap tersimpan sebagai deleted), sembunyikan bawaan', async () => {
    await wrap(<KategoriScreen />);
    await fireEvent.press(screen.getByLabelText('Kategori baru'));
    await fireEvent.changeText(screen.getByLabelText('Nama'), 'Kopi');
    await fireEvent.press(screen.getByText('Simpan kategori'));
    expect(saved().custom).toMatchObject([{ name: 'Kopi', type: 'expense', bucket: 'wants', icon: 'Ellipsis' }]);
    expect(screen.getByText('Kopi')).toBeTruthy();

    await fireEvent.press(screen.getByText('Kopi'));
    await fireEvent.press(screen.getByText('Hapus kategori'));
    await act(async () => fireEvent.press(screen.getAllByText('Hapus kategori').at(-1)!));
    expect(saved().custom[0]!.deleted).toBe(true);

    await fireEvent.press(screen.getByLabelText('Tampilkan Makan & Minum di pilihan'));
    expect(saved().hidden).toEqual(['food']);
  });
});

describe('IconGrid', () => {
  it('titik halaman mengikuti geser; terpilih = lingkaran aksen terisi', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ key: `k${i}`, icon: Ellipsis, label: `Ikon ${i}` }));
    await wrap(<IconGrid items={items} value="k0" onChange={jest.fn()} accessibilityLabel="Ikon" />);
    // 360 px = 6 kolom x 2 baris = 12 per halaman -> 2 halaman.
    await fireEvent(screen.getByLabelText('Ikon'), 'layout', { nativeEvent: { layout: { width: 360, height: 200 } } });
    expect(screen.getByLabelText('Halaman 1 dari 2').props.accessibilityState.selected).toBe(true);
    await fireEvent.scroll(screen.getByTestId('icon-grid-pages'), { nativeEvent: { contentOffset: { x: 360, y: 0 } } });
    expect(screen.getByLabelText('Halaman 2 dari 2').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Ikon 0').props.accessibilityState.selected).toBe(true);
  });
});
