import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfilScreen from '@/app/pengaturan/profil';
import { ToastProvider } from '@/components/ui';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider } from '@/state/AppStore';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
// Store contoh tidak punya pengguna: userId dipasang supaya jalur simpan ikut diuji.
jest.mock('@/state/AppStore', () => {
  const actual = jest.requireActual('@/state/AppStore');
  return { ...actual, useStore: () => ({ ...actual.useStore(), userId: 'u1' }) };
});
const mockUpdate = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/data/remote/api', () => ({ ...jest.requireActual('@/data/remote/api'), updateProfile: (...a: unknown[]) => mockUpdate(...a), avatarUrl: async () => 'https://x/a.jpg' }));
const PICKED = { uri: 'file:///tmp/raw.jpg', w: 4000, h: 3000 };
const mockPick = jest.fn(async (..._a: unknown[]): Promise<typeof PICKED | null> => PICKED);
const mockCrop = jest.fn(async (..._a: unknown[]) => 'file:///tmp/cropped.jpg');
const mockSave = jest.fn(async (..._a: unknown[]) => 'u1/new.jpg');
const mockPreset = jest.fn(async (..._a: unknown[]) => 'preset:garis');
const mockRemove = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/features/settings/avatar', () => ({
  ...jest.requireActual('@/features/settings/avatar'),
  pickImage: (...a: unknown[]) => mockPick(...a),
  cropImage: (...a: unknown[]) => mockCrop(...a),
  saveImage: (...a: unknown[]) => mockSave(...a),
  setCoverPreset: (...a: unknown[]) => mockPreset(...a),
  removeAvatar: (...a: unknown[]) => mockRemove(...a),
}));

const wrap = (ui: ReactNode, preset = sampleState(), mode: 'light' | 'dark' = 'light') =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode={mode}>
          <ToastProvider>
            <AppStoreProvider preset={preset}>{ui}</AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

const EDIT = 'Ubah foto profil dan sampul';
// Baris menu aksi dijalankan setelah menu menutup (afterSheetClose, native): tunggu sebentar.
const tapMenu = async (label: string) =>
  act(async () => {
    fireEvent.press(screen.getByLabelText(label));
    await new Promise((res) => setTimeout(res, 400));
  });
const openMenu = async () => fireEvent.press(screen.getByLabelText(EDIT));

jest.setTimeout(15_000);

beforeEach(() => [mockUpdate, mockPick, mockCrop, mockSave, mockRemove, mockPreset].forEach((m) => m.mockClear()));

describe('Pengaturan > Profil', () => {
  it('nama + email di kartu, tanpa baris email ganda; Free tanpa ikon Pro', async () => {
    await wrap(<ProfilScreen />);
    expect(screen.getAllByText('Rani Pratiwi').length).toBeGreaterThan(0);
    // Email hanya sekali (di bawah nama), tidak diulang sebagai baris daftar.
    expect(screen.getAllByText('rani.pratiwi@example.com')).toHaveLength(1);
    expect(screen.queryByText('Email masuk')).toBeNull();
    expect(screen.getByText('Paket')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.queryByLabelText('Paket Pro aktif')).toBeNull();
    expect(screen.getByText('Bergabung sejak')).toBeTruthy();
    // Satu tombol (pensil di sampul) untuk foto profil + sampul.
    expect(screen.getByLabelText(EDIT)).toBeTruthy();
    await openMenu();
    expect(screen.getByLabelText('Foto profil dari galeri')).toBeTruthy();
    expect(screen.getByLabelText('Unggah foto sampul')).toBeTruthy();
    // Belum ada foto: tidak ada baris hapus.
    expect(screen.queryByLabelText('Hapus foto profil')).toBeNull();
  });

  it('Pro: ikon mahkota di lingkaran foto, baris Paket menulis tanggal akhir', async () => {
    await wrap(<ProfilScreen />, { ...sampleState(), plan: 'premium', premiumUntil: '2026-12-21T00:00:00Z' }, 'dark');
    expect(screen.getByLabelText('Paket Pro aktif')).toBeTruthy();
    expect(screen.getByText(/^Pro aktif sampai 21 Des/)).toBeTruthy();
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('ubah nama: disimpan ke profil, nama baru tampil; >80 karakter ditolak', async () => {
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getByText('Nama tampilan'));
    const input = screen.getByDisplayValue('Rani Pratiwi');
    await fireEvent.changeText(input, 'a'.repeat(81));
    expect(screen.getByText('Maksimal 80 karakter')).toBeTruthy();
    await fireEvent.changeText(input, '  Rani   P. ');
    await act(async () => fireEvent.press(screen.getByText('Simpan')));
    expect(mockUpdate).toHaveBeenCalledWith('u1', { display_name: 'Rani P.' });
    expect(screen.getAllByText('Rani P.').length).toBeGreaterThan(0);
    expect(screen.getByText('Nama disimpan')).toBeTruthy();
  });

  it('ubah nama gagal: toast error, nama lama tetap', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('down'));
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getByText('Nama tampilan'));
    await fireEvent.changeText(screen.getByDisplayValue('Rani Pratiwi'), 'Budi');
    await act(async () => fireEvent.press(screen.getByText('Simpan')));
    expect(screen.getByText('Nama belum tersimpan')).toBeTruthy();
    expect(screen.queryByText('Budi')).toBeNull();
  });

  it('foto: pilih dari galeri -> crop lingkaran -> unggah; lalu hapus dengan konfirmasi', async () => {
    await wrap(<ProfilScreen />);
    await openMenu();
    await tapMenu('Foto profil dari galeri');
    expect(mockPick).toHaveBeenCalledWith('library');
    // Crop terbuka; belum ada unggahan sebelum "Gunakan".
    expect(screen.getByText('Atur foto profil')).toBeTruthy();
    expect(mockSave).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Gunakan')));
    // Zoom 1 tanpa geser = potong tengah persegi terbesar dari 4000x3000.
    expect(mockCrop).toHaveBeenCalledWith(PICKED.uri, { originX: 500, originY: 0, width: 3000, height: 3000 }, 'avatar');
    expect(mockSave).toHaveBeenCalledWith('u1', 'avatar', 'file:///tmp/cropped.jpg', null);
    expect(screen.getByText('Foto profil diperbarui')).toBeTruthy();

    await openMenu();
    await tapMenu('Hapus foto profil');
    expect(screen.getByText('Hapus foto profil?')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getAllByText('Hapus foto profil').at(-1)!));
    expect(mockRemove).toHaveBeenCalledWith('u1', 'u1/new.jpg');
    expect(screen.getByText('Foto profil dihapus')).toBeTruthy();
  });

  it('batal di layar crop: tidak ada unggahan', async () => {
    await wrap(<ProfilScreen />);
    await openMenu();
    await tapMenu('Foto profil dari galeri');
    await fireEvent.press(screen.getByText('Batal'));
    expect(screen.queryByText('Atur foto profil')).toBeNull();
    expect(mockCrop).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('sampul: pilih preset, lalu unggah foto sampul sendiri dengan crop 2:1', async () => {
    await wrap(<ProfilScreen />);
    await openMenu();
    // Bawaan (null) = Tinta terpilih: mengetuknya lagi tidak menyimpan apa-apa.
    expect(screen.getByLabelText('Tinta').props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    await tapMenu('Tinta');
    expect(mockPreset).not.toHaveBeenCalled();
    await openMenu();
    await tapMenu('Garis');
    expect(mockPreset).toHaveBeenCalledWith('u1', 'garis', null);
    expect(screen.getByText('Sampul diperbarui')).toBeTruthy();

    await openMenu();
    await tapMenu('Unggah foto sampul');
    expect(screen.getByText('Atur sampul')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Gunakan')));
    expect(mockCrop).toHaveBeenCalledWith(PICKED.uri, { originX: 0, originY: 500, width: 4000, height: 2000 }, 'cover');
    // Preset sebelumnya tidak punya berkas untuk dibuang.
    expect(mockSave).toHaveBeenCalledWith('u1', 'cover', 'file:///tmp/cropped.jpg', null);
  });
});
