import { clampOffset, cropRect } from '@/lib/crop';

const img = { w: 4000, h: 3000 };
const square = { w: 300, h: 300 };
const wide = { w: 360, h: 120 };

describe('crop', () => {
  it('zoom 1 tanpa geser = potong tengah terbesar', () => {
    expect(cropRect(img, square, 1, 0, 0)).toEqual({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(cropRect(img, wide, 1, 0, 0)).toEqual({ originX: 0, originY: 833, width: 4000, height: 1333 });
  });
  it('zoom 2 = separuh ukuran, tetap di tengah', () => {
    expect(cropRect(img, square, 2, 0, 0)).toEqual({ originX: 1250, originY: 750, width: 1500, height: 1500 });
  });
  it('geser ke kanan di layar = potongan bergeser ke kiri gambar, dijepit di tepi', () => {
    // Skala tampil 0.1 (zoom 1): geser 50 px layar = 500 px gambar; maks geser = (400-300)/2 = 50.
    expect(cropRect(img, square, 1, 50, 0).originX).toBe(0);
    expect(cropRect(img, square, 1, 999, 0).originX).toBe(0);
    expect(cropRect(img, square, 1, -999, 0).originX).toBe(1000);
    expect(clampOffset(img, square, 1, 999, 999)).toEqual({ tx: 50, ty: 0 });
  });
});
