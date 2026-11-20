import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CardArt } from '@/components/ui/CardArt';
import { BANKS, getBank } from '@/constants/banks';
import { CARD_PRODUCTS } from '@/data/cardProducts';
import { CardStylePicker, artVariant } from '@/features/accounts/CardStylePicker';
import { I18nProvider } from '@/i18n';
import { countryCounts, groupCatalog, kindsIn } from '@/lib/cardCatalog';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('katalog kartu', () => {
  it('setiap produk bersumber (https), banknya ada di pemilih bank, id unik', () => {
    const keys = new Set(BANKS.map((b) => b.key));
    expect(CARD_PRODUCTS.length).toBeGreaterThan(0);
    expect(CARD_PRODUCTS.every((p) => keys.has(p.bank) && /^https:\/\//.test(p.source))).toBe(true);
    expect(new Set(CARD_PRODUCTS.map((p) => p.id)).size).toBe(CARD_PRODUCTS.length);
  });
  it('custom art hanya untuk paylater; nama produk tidak diawali nama bank', () => {
    expect(CARD_PRODUCTS.every((p) => !!p.customArt === (p.kind === 'paylater'))).toBe(true);
    // Paylater e-wallet sengaja mempertahankan mereknya ("GoPay Later (Custom Art)", seperti referensi).
    expect(CARD_PRODUCTS.filter((p) => !p.customArt && p.name.startsWith(`${getBank(p.bank).name} `))).toEqual([]);
  });
  it('jumlah per negara dihitung dari data dan totalnya cocok', () => {
    const c = countryCounts();
    expect(c.all).toBe(CARD_PRODUCTS.length);
    expect(c.ID + c.MY + c.TR).toBe(c.all);
    expect(countryCounts([{ id: 'x', bank: 'bca', name: 'A', kind: 'debit', scheme: null, source: 'https://x' }])).toEqual({ all: 1, ID: 1, MY: 0, TR: 0 });
  });
  it('tab hanya jenis yang punya kartu di negara itu; pencarian cocok nama bank atau produk, tanpa beda aksen', () => {
    const fx = [
      { id: 'a', bank: 'isbank', name: 'Maximum Kart', kind: 'credit' as const, scheme: null, source: 'https://x' },
      { id: 'b', bank: 'bca', name: 'Paspor BCA GPN Blue', kind: 'debit' as const, scheme: 'gpn' as const, source: 'https://x' },
      { id: 'c', bank: 'akulaku', name: 'PayLater', kind: 'paylater' as const, scheme: null, customArt: true, source: 'https://x' },
    ];
    expect(kindsIn('TR', fx)).toEqual(['credit']);
    expect(kindsIn('all', fx)).toEqual(['credit', 'debit', 'paylater']);
    expect(groupCatalog({ country: 'all', kind: 'credit', query: 'is bankasi' }, fx).map((g) => g.bank)).toEqual(['isbank']);
    expect(groupCatalog({ country: 'ID', kind: 'debit', query: 'paspor' }, fx)[0].products.map((p) => p.id)).toEqual(['b']);
    expect(groupCatalog({ country: 'ID', kind: 'debit', query: 'zzz' }, fx)).toEqual([]);
  });
  it('pola artwork tetap per produk', () => {
    expect(artVariant('bca-credit-visa-batman')).toBe(artVariant('bca-credit-visa-batman'));
    expect(new Set(CARD_PRODUCTS.map((p) => artVariant(p.id))).size).toBeGreaterThan(1);
  });
});

const wrap = async (ui: React.ReactElement, mode: 'dark' | 'light' = 'dark') => {
  await act(async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <I18nProvider initialLang="id">
          <ThemeProvider initialMode={mode}>{ui}</ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>,
    );
  });
};

describe('artwork kartu', () => {
  it('bank tanpa logo di idn-finlogos (Malaysia): nama bank tampil sebagai teks bersama label produk', async () => {
    await wrap(<CardArt bank="maybank" width={200} label="Visa Infinite" scheme="visa" />);
    expect(screen.getByText('Maybank')).toBeTruthy();
    expect(screen.getByText('Visa Infinite')).toBeTruthy();
    expect(screen.getByLabelText('Visa')).toBeTruthy();
  });
});

describe('Pilih Tampilan Kartu', () => {
  const layoutGrid = async () => {
    // Grid diukur lewat onLayout; di tes diberi lebar seperti layar 390 px.
    await act(async () => {
      fireEvent(screen.getByTestId('card-grid'), 'layout', { nativeEvent: { layout: { width: 358, height: 100, x: 0, y: 0 } } });
    });
  };

  it('centang nonaktif sampai memilih; pilih lalu centang = terapkan; X = tutup tanpa perubahan', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    await wrap(<CardStylePicker bank="bca" currentId={null} onApply={onApply} onClose={onClose} />);
    await layoutGrid();
    expect(screen.getByText('Pilih Tampilan Kartu')).toBeTruthy();
    const apply = screen.getByLabelText('Terapkan tampilan kartu');
    await act(async () => {
      fireEvent.press(apply);
    });
    expect(onApply).not.toHaveBeenCalled();
    const first = CARD_PRODUCTS.find((p) => p.bank === 'bca' && p.kind === 'credit')!;
    await act(async () => {
      fireEvent.press(screen.getByLabelText(`${first.name}, BCA`));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Terapkan tampilan kartu'));
    });
    expect(onApply).toHaveBeenCalledWith(first.id);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tutup tanpa mengubah'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('grup per bank dengan jumlah dari katalog; bar bawah menampilkan desain bawaan bank', async () => {
    await wrap(<CardStylePicker bank="bca" currentId={null} onApply={jest.fn()} onClose={jest.fn()} />);
    await layoutGrid();
    const bcaCredit = CARD_PRODUCTS.filter((p) => p.bank === 'bca' && p.kind === 'credit').length;
    expect(screen.getAllByText(String(bcaCredit)).length).toBeGreaterThan(0);
    expect(screen.getByText('Desain bawaan bank')).toBeTruthy();
  });

  it('tab Paylater: produk custom art diberi akhiran "(Custom Art)"', async () => {
    await wrap(<CardStylePicker bank="bca" currentId={null} onApply={jest.fn()} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Paylater'));
    });
    await layoutGrid();
    expect(screen.getByText('GoPay Later (Custom Art)')).toBeTruthy();
  });

  it('menu negara: jumlah per negara dari data; Turki tanpa tab Paylater', async () => {
    await wrap(<CardStylePicker bank="bca" currentId={null} onApply={jest.fn()} onClose={jest.fn()} />, 'light');
    const c = countryCounts();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Negara: Indonesia. Ganti negara'));
    });
    expect(screen.getByLabelText(`Semua negara, ${c.all}`)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText(`Turki, ${c.TR}`));
    });
    expect(screen.getByLabelText('Negara: Turki. Ganti negara')).toBeTruthy();
    expect(screen.queryByLabelText('Paylater')).toBeNull();
  });

  it('kartu yang sedang dipakai tampil di bar bawah dengan tombol Atur', async () => {
    const cur = CARD_PRODUCTS.find((p) => p.bank === 'bca' && p.kind === 'debit')!;
    await wrap(<CardStylePicker bank="bca" currentId={cur.id} onApply={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getAllByText(cur.name).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Atur')).toBeTruthy();
  });
});
