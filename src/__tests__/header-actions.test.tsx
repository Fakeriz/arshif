import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pencil, Split, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HeaderActions, type HeaderAction } from '@/components/shell/HeaderActions';
import { I18nProvider } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initialLang="id">
        <ThemeProvider initialMode="light">{ui}</ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>,
  );

const action = (key: string, icon = Pencil, extra: Partial<HeaderAction> = {}): HeaderAction => ({ key, label: key, icon, onPress: jest.fn(), ...extra });

describe('HeaderActions: aksi layar di kanan atas', () => {
  it('maksimal 2 aksi: tombol ikon langsung, tanpa titik tiga', async () => {
    const edit = action('Edit');
    await wrap(<HeaderActions actions={[edit, action('Hapus', Trash2, { danger: true })]} />);
    expect(screen.queryByLabelText('Aksi lainnya')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(edit.onPress).toHaveBeenCalledTimes(1);
  });

  it('lebih dari 2 aksi: satu tombol titik tiga; ketuk baris menutup menu lalu menjalankan aksinya', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const split = action('Split bill', Split);
    await wrap(<HeaderActions actions={[split, action('Edit'), action('Hapus', Trash2, { danger: true })]} />);
    expect(screen.queryByLabelText('Split bill')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Aksi lainnya'));
    await fireEvent.press(screen.getByLabelText('Split bill'));
    // Native: aksi jalan setelah sheet tertutup (iOS menolak membuka Modal di atas Modal yang menutup).
    expect(split.onPress).not.toHaveBeenCalled();
    await act(() => new Promise((r) => setTimeout(r, 600)));
    expect(split.onPress).toHaveBeenCalledTimes(1);
  });

  it('Edit (pinned) tetap ikon sendiri di samping titik tiga; menu berisi sisanya', async () => {
    await wrap(<HeaderActions actions={[action('Split bill', Split), action('Edit', Pencil, { pinned: true }), action('Hapus', Trash2, { danger: true })]} />);
    expect(screen.getByLabelText('Edit')).toBeTruthy();
    expect(screen.queryByLabelText('Hapus')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Aksi lainnya'));
    expect(screen.getByLabelText('Hapus')).toBeTruthy();
    expect(screen.getAllByLabelText('Edit')).toHaveLength(1);
  });
});
