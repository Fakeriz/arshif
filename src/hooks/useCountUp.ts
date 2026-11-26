import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

const IS_TEST = typeof process !== 'undefined' && Boolean(process.env?.JEST_WORKER_ID);

/**
 * Tween integer dari nilai sebelumnya ke `target` (minor units tetap integer).
 * Instan bila reduced motion aktif, `enabled` false, nilai tidak berubah, atau di lingkungan test.
 */
export function useCountUp(target: number, enabled: boolean, duration = 600): number {
  const reduced = useReducedMotion();
  const instant = !enabled || reduced || IS_TEST || !Number.isFinite(target) || duration <= 0;
  const [value, setValue] = useState(instant ? target : 0);
  const fromRef = useRef(value);

  useEffect(() => {
    if (instant) {
      if (fromRef.current !== target) {
        fromRef.current = target;
        setValue(target);
      }
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    let last = from;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (target - from) * eased);
      if (next !== last) {
        last = next;
        fromRef.current = next;
        setValue(next);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, instant, duration]);

  return instant ? target : value;
}
