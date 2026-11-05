import { annularSector, donutSlices, healthBand, niceCeil, polar } from '@/lib/chart';

describe('donutSlices', () => {
  it('membagi proporsional dan share total = 1', () => {
    const slices = donutSlices([50, 30, 20], 0);
    expect(slices.map((s) => s.share)).toEqual([0.5, 0.3, 0.2]);
    expect(slices[0]).toMatchObject({ start: 0, end: 180 });
    expect(slices[2].end).toBeCloseTo(360);
  });

  it('nilai 0/negatif tidak mendapat sudut, semua nol → share 0', () => {
    expect(donutSlices([0, 10])[0].share).toBe(0);
    expect(donutSlices([10, 0])[0]).toMatchObject({ start: 0, end: 360, share: 1 });
    expect(donutSlices([0, 0]).every((s) => s.share === 0)).toBe(true);
    expect(donutSlices([-5, 5])[0].share).toBe(0);
  });

  it('memberi celah hanya jika ada lebih dari satu segmen aktif', () => {
    const [a, b] = donutSlices([1, 1], 4);
    expect(a.start).toBe(2);
    expect(b.start).toBe(182);
  });
});

describe('geometri', () => {
  it('polar: 0° = jam 12, 90° = jam 3', () => {
    const top = polar(50, 50, 10, 0);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(40);
    const right = polar(50, 50, 10, 90);
    expect(right.x).toBeCloseTo(60);
    expect(right.y).toBeCloseTo(50);
  });

  it('annularSector menghasilkan path tertutup dengan flag large-arc yang benar', () => {
    expect(annularSector(50, 50, 40, 28, 0, 90)).toMatch(/^M .* A 40 40 0 0 1 .* Z$/);
    expect(annularSector(50, 50, 40, 28, 0, 270)).toContain('A 40 40 0 1 1');
    // lingkaran penuh tidak boleh menghasilkan busur kosong
    expect(annularSector(50, 50, 40, 28, 0, 360)).toContain('A 40 40 0 1 1');
  });
});

describe('healthBand', () => {
  it.each([
    [0, 'attention'],
    [39, 'attention'],
    [40, 'fair'],
    [69, 'fair'],
    [70, 'good'],
    [84, 'good'],
    [85, 'excellent'],
    [100, 'excellent'],
    [140, 'excellent'],
    [-3, 'attention'],
  ])('skor %d → %s', (score, label) => {
    expect(healthBand(score).key).toBe(label);
  });
});

describe('niceCeil', () => {
  it.each([
    [0, 1],
    [7, 10],
    [18, 20],
    [23, 25],
    [4_300_000, 5_000_000],
    [12_000_000, 20_000_000],
    [100, 100],
  ])('%d → %d', (max, expected) => {
    expect(niceCeil(max)).toBe(expected);
  });
});
