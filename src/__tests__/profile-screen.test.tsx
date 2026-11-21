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
const mockRemove = jest.fn(async (..._a: unknown[]) => undefined);
jest.mock('@/features/settings/avatar', () => ({
  ...jest.requireActual('@/features/settings/avatar'),
  pickAvatar: (...a: unknown[]) => mockPick(...a),
  saveAvatar: (...a: unknown[]) => mockSave(...a),
  removeAvatar: (...a: unknown[]) => mockRemove(...a),
}));

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">
          <ToastProvider>
            <AppStoreProvider preset={sampleState()}>{ui}</AppStoreProvider>
          </ToastProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => [mockUpdate, mockPick, mockSave, mockRemove].forEach((m) => m.mockClear()));

describe('Pengaturan > Profil', () => {
  it('menampilkan nama, email, paket, dan info akun', async () => {
    await wrap(<ProfilScreen />);
    expect(screen.getAllByText('Rani Pratiwi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('rani.pratiwi@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Paket Free')).toBeTruthy();
    expect(screen.getByText('Email masuk')).toBeTruthy();
    expect(screen.getByText('Bergabung sejak')).toBeTruthy();
    // Belum ada foto: tombol "Tambah foto", bukan "Ganti foto".
    expect(screen.getAllByText('Tambah foto').length).toBeGreaterThan(0);
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
    await fireEvent.press(screen.getAllByText('Tambah foto').at(-1)!);
    await act(async () => fireEvent.press(screen.getByText('Pilih dari galeri')));
    expect(mockPick).toHaveBeenCalledWith('library');
    expect(mockSave).toHaveBeenCalledWith('u1', 'file:///tmp/a.jpg', null);
    expect(screen.getByText('Foto profil diperbarui')).toBeTruthy();
    expect(screen.getAllByText('Ganti foto').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getAllByText('Ganti foto').at(-1)!);
    await fireEvent.press(screen.getByText('Hapus foto'));
    expect(screen.getByText('Hapus foto profil?')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getAllByText('Hapus foto').at(-1)!));
    expect(mockRemove).toHaveBeenCalledWith('u1', 'u1/new.jpg');
    expect(screen.getByText('Foto profil dihapus')).toBeTruthy();
  });

  it('batal memilih foto: tidak ada unggahan', async () => {
    mockPick.mockResolvedValueOnce(null);
    await wrap(<ProfilScreen />);
    await fireEvent.press(screen.getAllByText('Tambah foto').at(-1)!);
    await act(async () => fireEvent.press(screen.getByText('Pilih dari galeri')));
    expect(mockSave).not.toHaveBeenCalled();
  });
});
