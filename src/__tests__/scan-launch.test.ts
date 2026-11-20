import { Platform } from 'react-native';

const mockLaunch = jest.fn();
const mockLibrary = jest.fn();
const mockDoc = jest.fn();
jest.mock('expo-image-picker', () => ({ launchCameraAsync: (...a: unknown[]) => mockLaunch(...a), launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: unknown[]) => mockDoc(...a) }));

import { openCapture, openScan, pickReceipts, takePendingPick } from '@/features/capture/scanLaunch';

describe('openCapture: kamera web dibuka di dalam ketukan', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
    mockLaunch.mockReset();
    takePendingPick();
  });

  it('web + Scan: kamera dibuka sebelum pindah layar, fotonya diambil sekali oleh layar Scan', () => {
    Platform.OS = 'web';
    const order: string[] = [];
    mockLaunch.mockImplementation(() => (order.push('camera'), Promise.resolve({ canceled: true, assets: null })));
    openCapture('/scan', () => order.push('go'));
    expect(order).toEqual(['camera', 'go']);
    expect(takePendingPick()).not.toBeNull();
    expect(takePendingPick()).toBeNull();
  });

  it('web + layar lain, atau native: tidak membuka kamera', () => {
    Platform.OS = 'web';
    const go = jest.fn();
    openCapture('/voice', go);
    Platform.OS = 'android';
    openCapture('/scan', go);
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(go).toHaveBeenCalledTimes(2);
    expect(takePendingPick()).toBeNull();
  });
});

describe('sumber struk dari sheet Scan struk', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
    jest.resetAllMocks();
    takePendingPick();
  });
  const img = (n: number) => Array.from({ length: n }, (_, i) => ({ uri: `file://${i}.jpg`, width: 1000 }));

  it('Beberapa struk: maks 3 (atau sisa kuota), kelebihan dari web dibuang', async () => {
    mockLibrary.mockResolvedValue({ canceled: false, assets: img(5) });
    expect(await pickReceipts('multi')).toHaveLength(3);
    expect(mockLibrary).toHaveBeenLastCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 3 }));
    expect(await pickReceipts('multi', 2)).toHaveLength(2);
    expect(await pickReceipts('gallery')).toEqual([{ uri: 'file://0.jpg', width: 1000 }]);
  });

  it('PDF ditandai pdf; batal = kosong', async () => {
    mockDoc.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://s.pdf' }] }).mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickReceipts('pdf')).toEqual([{ uri: 'file://s.pdf', pdf: true }]);
    expect(await pickReceipts('pdf')).toEqual([]);
    expect(mockDoc).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
  });

  it('web: pemilih dibuka di dalam ketukan sebelum pindah layar; native: layar Scan yang membuka', () => {
    Platform.OS = 'web';
    mockDoc.mockResolvedValue({ canceled: true, assets: null });
    const go = jest.fn();
    openScan('pdf', go);
    expect(mockDoc).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith('/scan?src=pdf');
    expect(takePendingPick()).not.toBeNull();
    Platform.OS = 'ios';
    openScan('multi', go);
    expect(mockLibrary).not.toHaveBeenCalled();
    expect(takePendingPick()).toBeNull();
  });
});
