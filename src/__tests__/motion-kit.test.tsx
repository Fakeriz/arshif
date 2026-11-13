import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { Accordion, Button, Calendar, Checkbox, OtpInput, RadioList, RollingNumber, Select, Slider, StepList, Stepper, UploadProgress, dateKey } from '@/components/ui';
import { formatClock } from '@/components/ui/Countdown';
import { ThemeProvider } from '@/theme/ThemeProvider';

const wrap = (ui: ReactElement) => render(<ThemeProvider initialMode="dark">{ui}</ThemeProvider>);

describe('Motion kit — perilaku', () => {
  it('Stepper menambah, mengurang, dan berhenti di batas', async () => {
    const onChange = jest.fn();
    await wrap(<Stepper value={1} min={1} max={2} onChange={onChange} accessibilityLabel="Anggota" />);
    await fireEvent.press(screen.getByLabelText('Tambah'));
    expect(onChange).toHaveBeenCalledWith(2);
    await fireEvent.press(screen.getByLabelText('Kurangi'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('RollingNumber membacakan nilai utuh, bukan per digit', async () => {
    await wrap(<RollingNumber value="Rp 1.500.000" />);
    expect(screen.getByLabelText('Rp 1.500.000')).toBeTruthy();
  });

  it('Checkbox tetap melaporkan nilai kebalikannya', async () => {
    const onChange = jest.fn();
    await wrap(<Checkbox checked={false} onChange={onChange} accessibilityLabel="Tunai" />);
    await fireEvent.press(screen.getByLabelText('Tunai'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('RadioList hanya memanggil onChange untuk pilihan baru', async () => {
    const onChange = jest.fn();
    await wrap(<RadioList accessibilityLabel="Mata uang" value="IDR" onChange={onChange} items={[{ key: 'IDR', label: 'Rupiah' }, { key: 'MYR', label: 'Ringgit' }]} />);
    await fireEvent.press(screen.getByLabelText('Rupiah'));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Ringgit'));
    expect(onChange).toHaveBeenCalledWith('MYR');
  });

  it('Select membuka menu lalu memilih', async () => {
    const onChange = jest.fn();
    await wrap(<Select label="Kelompokkan" value="a" onChange={onChange} items={[{ key: 'a', label: 'Kategori' }, { key: 'b', label: 'Akun' }]} />);
    expect(screen.queryByLabelText('Akun')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Kelompokkan, Kategori'));
    await fireEvent.press(await screen.findByLabelText('Akun'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Slider bisa digeser lewat aksi aksesibilitas dan tidak melewati batas', async () => {
    const onChange = jest.fn();
    await wrap(<Slider value={30} max={30} onChange={onChange} accessibilityLabel="Tabungan" />);
    const slider = screen.getByLabelText('Tabungan');
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenCalledWith(29);
  });

  it('OtpInput meneruskan teks mentah dan menampilkan error', async () => {
    const onChangeText = jest.fn();
    await wrap(<OtpInput label="Kode 6 digit" value="12" onChangeText={onChangeText} error="Kode salah" />);
    await fireEvent.changeText(screen.getByLabelText('Kode 6 digit'), '12 34 56');
    expect(onChangeText).toHaveBeenCalledWith('12 34 56');
    expect(screen.getByText('Kode salah')).toBeTruthy();
  });

  it('Calendar memilih tanggal dan berpindah bulan', async () => {
    const onChange = jest.fn();
    await wrap(<Calendar value={new Date(2026, 10, 26)} onChange={onChange} today={new Date(2026, 10, 10)} />);
    expect(screen.getByText('November 2026')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Rabu, 18 November 2026'));
    expect(dateKey(onChange.mock.calls[0][0])).toBe('2026-11-18');
    await fireEvent.press(screen.getByLabelText('Bulan berikutnya'));
    expect(await screen.findByText('Desember 2026')).toBeTruthy();
  });

  it('Calendar menolak tanggal di luar rentang', async () => {
    const onChange = jest.fn();
    await wrap(<Calendar value={null} onChange={onChange} today={new Date(2026, 10, 10)} minDate={new Date(2026, 10, 10)} />);
    await fireEvent.press(screen.getByLabelText('Senin, 9 November 2026'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('StepList menampilkan langkah berjalan lalu "Selesai"', async () => {
    const view = await wrap(<StepList steps={['Foto struk', 'Cek jumlah']} done={1} />);
    expect(screen.getByText('Langkah 2 dari 2')).toBeTruthy();
    await view.rerender(<ThemeProvider initialMode="dark"><StepList steps={['Foto struk', 'Cek jumlah']} done={2} /></ThemeProvider>);
    expect(screen.getByText('Selesai')).toBeTruthy();
  });

  it('Accordion membuka satu jawaban dan menutupnya lagi', async () => {
    const onChange = jest.fn();
    await wrap(<Accordion items={[{ key: 'a', title: 'Tanya A', body: 'Jawab A' }, { key: 'b', title: 'Tanya B', body: 'Jawab B' }]} value="a" onChange={onChange} />);
    expect(screen.getByText('Jawab A')).toBeTruthy();
    expect(screen.queryByText('Jawab B')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Tanya A'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('Button `done` tidak bisa ditekan lagi', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Tersimpan" done onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Tersimpan'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('UploadProgress membacakan persen lalu status selesai', async () => {
    const view = await wrap(<UploadProgress fileName="struk.jpg" progress={0.42} />);
    expect(screen.getByLabelText('struk.jpg, Mengunggah 42%')).toBeTruthy();
    await view.rerender(<ThemeProvider initialMode="dark"><UploadProgress fileName="struk.jpg" progress={1} /></ThemeProvider>);
    expect(screen.getByLabelText('struk.jpg, Terunggah')).toBeTruthy();
  });

  it('formatClock: mm:ss, jam bila perlu, tidak pernah negatif', () => {
    expect(formatClock(47 * 60 + 12)).toBe('47:12');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('00:00');
  });
});
