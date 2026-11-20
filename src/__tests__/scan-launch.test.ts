import { Platform } from 'react-native';

const mockLaunch = jest.fn();
const mockLibrary = jest.fn();
const mockDoc = jest.fn();
jest.mock('expo-image-picker', () => ({ launchCameraAsync: (...a: unknown[]) => mockLaunch(...a), launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: unknown[]) => mockDoc(...a) }));

import { clearPendingPick, pendingPick, pickReceipts, startScan } from '@/features/capture/scanLaunch';

describe('sumber struk dari sheet Scan struk', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
    jest.resetAllMocks();
    clearPendingPick();
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

  it('pemilih dibuka dulu (sinkron, di dalam ketukan); layar Scan baru dibuka setelah berkas dipilih', async () => {
    Platform.OS = 'web';
    const order: string[] = [];
    mockDoc.mockImplementation(() => (order.push('picker'), Promise.resolve({ canceled: false, assets: [{ uri: 'blob:s' }] })));
    startScan('pdf', () => order.push('go'));
    expect(order).toEqual(['picker']);
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(['picker', 'go']);
    expect(pendingPick()?.source).toBe('pdf');
    expect(await pendingPick()!.files).toEqual([{ uri: 'blob:s', pdf: true }]);
  });

  it('batal di pemilih: layar Scan tidak dibuka (tetap di layar asal)', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: null });
    const go = jest.fn();
    startScan('multi', go);
    await new Promise((r) => setTimeout(r, 0));
    expect(go).not.toHaveBeenCalled();
    expect(pendingPick()).toBeNull();
  });
});
