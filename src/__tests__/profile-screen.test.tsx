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
const mockPick = jest.fn(async (..._a: unknown[]): Promise<string | null> => 'file:///tmp/a.jpg');
const mockSave = jest.fn(async (..._a: unknown[]) => 'u1/new.jpg');
const mockPreset = jest.fn(async (..._a: unknown[]) => 'preset:garis');
const mockRemove = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/features/settings/avatar', () => ({
  ...jest.requireActual('@/features/settings/avatar'),
  pickImage: (...a: unknown[]) => mockPick(...a),
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

beforeEach(() => [mockUpdate, mockPick, mockSave, mockRemove, mockPreset].forEach((m) => m.mockClear()));

describe('Pengaturan > Profil', () => {
  it('menampilkan nama, email, paket, dan info akun; paket Free tanpa badge PRO', async () => {
    await wrap(<ProfilScreen />);
    expect(screen.getAllByText('Rani Pratiwi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('rani.pratiwi@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Paket')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.queryByLabelText('Paket Premium aktif')).toBeNull();
    expect(screen.getByText('Email masuk')).toBeTruthy();
    expect(screen.getByText('Bergabung sejak')).toBeTruthy();
    // Belum ada foto: foto berlabel "Tambah foto", bukan "Ganti foto".
    expect(screen.getByLabelText('Tambah foto')).toBeTruthy();
    expect(screen.getByLabelText('Ubah sampul')).toBeTruthy();
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

  it('ganti foto dari galeri lalu hapus dengan konfirmasi', async () => {
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getByLabelText('Tambah foto'));
    await act(async () => fireEvent.press(screen.getByText('Pilih dari galeri')));
    expect(mockPick).toHaveBeenCalledWith('library', 'avatar');
    expect(mockSave).toHaveBeenCalledWith('u1', 'avatar', 'file:///tmp/a.jpg', null);
    expect(screen.getByText('Foto profil diperbarui')).toBeTruthy();
    expect(screen.getByLabelText('Ganti foto')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Ganti foto'));
    await fireEvent.press(screen.getByText('Hapus foto'));
    expect(screen.getByText('Hapus foto profil?')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getAllByText('Hapus foto').at(-1)!));
    expect(mockRemove).toHaveBeenCalledWith('u1', 'u1/new.jpg');
    expect(screen.getByText('Foto profil dihapus')).toBeTruthy();
  });

  it('batal memilih foto: tidak ada unggahan', async () => {
    mockPick.mockResolvedValueOnce(null);
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getByLabelText('Tambah foto'));
    await act(async () => fireEvent.press(screen.getByText('Pilih dari galeri')));
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('PRO: badge tampil di lingkaran foto untuk paket Premium', async () => {
    // Tema gelap sekalian: badge dan cincin kertas harus tetap tampil di kartu tinta terbalik.
    await wrap(<ProfilScreen />, { ...sampleState(), plan: 'premium' }, 'dark');
    expect(screen.getByLabelText('Paket Premium aktif')).toBeTruthy();
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('sampul: pilih preset, lalu unggah foto sampul sendiri', async () => {
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getByLabelText('Ubah sampul'));
    // Bawaan (null) = Tinta terpilih: mengetuknya lagi tidak menyimpan apa-apa.
    expect(screen.getByLabelText('Tinta').props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    await act(async () => fireEvent.press(screen.getByLabelText('Tinta')));
    expect(mockPreset).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Ubah sampul'));
    await act(async () => fireEvent.press(screen.getByLabelText('Garis')));
    expect(mockPreset).toHaveBeenCalledWith('u1', 'garis', null);
    expect(screen.getByText('Sampul diperbarui')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Ubah sampul'));
    await act(async () => fireEvent.press(screen.getByText('Unggah foto sampul')));
    expect(mockPick).toHaveBeenCalledWith('library', 'cover');
    // Preset sebelumnya tidak punya berkas untuk dibuang.
    expect(mockSave).toHaveBeenCalledWith('u1', 'cover', 'file:///tmp/a.jpg', null);
  });
});
