import { useT } from '@/i18n';
import type { TypeVariant } from '@/theme/tokens';

import type { TextTone } from './AppText';
import { RollingNumber } from './RollingNumber';

export type CountdownProps = { /** Sisa waktu dalam detik. */ seconds: number; variant?: TypeVariant; tone?: TextTone };

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Hitung mundur mm:ss dengan digit bergulir turun. Presentasional: pemanggil yang mengurangi `seconds`. */
export function Countdown({ seconds, variant = 'amountHero', tone = 'primary' }: CountdownProps) {
  const t = useT();
  const text = formatClock(seconds);
  return <RollingNumber value={text} variant={variant} tone={tone} direction={-1} accessibilityLabel={t('common.ui.timeLeft', { time: text })} />;
}
