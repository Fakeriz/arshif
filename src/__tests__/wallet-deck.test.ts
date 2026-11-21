import { deckPose, mod, ringDist, rubber, snapTarget } from '@/lib/walletDeck';

describe('tumpukan dompet', () => {
  it('posisi berputar: mod dan jarak melingkar', () => {
    expect(mod(-1, 5)).toBe(4);
    expect(ringDist(0, 4, 5)).toBe(1);
    expect(ringDist(2, 0, 5)).toBe(2);
  });
  it('kartu depan tegak penuh; lapis belakang lebih kecil, naik, miring, lebih gelap', () => {
    const front = deckPose(0, 5, 360, 216);
    expect(front).toMatchObject({ x: 0, scale: 1, rotate: -0, shade: 0, opacity: 1 });
    const back = deckPose(1, 5, 360, 216);
    expect(back.scale).toBeCloseTo(0.95);
    expect(back.y).toBeLessThan(front.y);
    expect(back.rotate).toBeLessThan(0);
    expect(back.z).toBeLessThan(front.z);
    // Lapis ke-4 dan seterusnya hilang (hanya 3 lapis terlihat).
    expect(deckPose(4, 6, 360, 216).opacity).toBe(0);
  });
  it('kartu yang digeser keluar memudar lalu masuk dari belakang', () => {
    expect(deckPose(4.75, 5, 360, 216).x).toBeLessThan(0);
    expect(deckPose(4.5, 5, 360, 216).opacity).toBe(0);
  });
  it('lepas geser: maju/mundur paling jauh satu kartu', () => {
    expect(snapTarget(2, 2.3, 0)).toBe(2);
    expect(snapTarget(2, 2.3, 5)).toBe(3);
    expect(snapTarget(2, 3.9, 20)).toBe(3);
    expect(snapTarget(2, 1.6, -1)).toBe(1);
  });
  it('karet makin berat dan dibatasi', () => {
    expect(Math.abs(rubber(-1000, 28))).toBeLessThan(28);
    expect(rubber(10, 28)).toBeGreaterThan(0);
  });
});
