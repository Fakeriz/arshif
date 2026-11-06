import { Check } from 'lucide-react-native';
import { useState } from 'react';

import { BottomSheet, Icon, ListItem } from '@/components/ui';
import { RateSheet } from '@/features/fx/RateSheet';
import { hasRate } from '@/lib/fx';
import { CURRENCIES, PINNED_CURRENCIES, currencyMeta } from '@/lib/money';
import { currencyName, useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';

const ALL = [...PINNED_CURRENCIES, ...Object.keys(CURRENCIES).filter((c) => !(PINNED_CURRENCIES as readonly string[]).includes(c))];

/**
 * Pemilih mata uang (IDR/MYR/TRY/USD dipin di atas, FR-FX-1). Mata uang tanpa kurs harian dan tanpa
 * "Kurs saya" tetap bisa dipilih, tapi pengguna diminta mengisi kursnya dulu (FR-FX-4).
 */
export function CurrencySheet({ visible, value, onSelect, onClose, title }: { visible: boolean; value: string; onSelect: (code: string) => void; onClose: () => void; title?: string }) {
  const { colors } = useTheme();
  const t = useT();
  const { state, dispatch } = useStore();
  const [needRate, setNeedRate] = useState<string | null>(null);
  // Dihitung saat dibuka: tabel kurs baru terisi setelah data dimuat.
  const order = visible ? ALL : [];
  return (
    <>
      <BottomSheet visible={visible && needRate === null} onClose={onClose} title={title ?? t('shell.currencySheet.title')}>
        {order.map((code, i) => {
          const m = currencyMeta(code);
          const rated = hasRate(code);
          return (
            <ListItem
              key={code}
              title={`${m.code} · ${currencyName(t, code)}`}
              subtitle={rated ? m.symbol : t('acct.rates.needSub')}
              trailing={code === value ? <Icon icon={Check} color={colors.accentText} /> : undefined}
              divider={i < order.length - 1}
              onPress={() => {
                if (!rated) return setNeedRate(code);
                onSelect(code);
                onClose();
              }}
            />
          );
        })}
      </BottomSheet>
      <RateSheet
        key={needRate ?? 'none'}
        visible={needRate !== null}
        code={needRate}
        main={state.mainCurrency}
        onClose={() => {
          setNeedRate(null);
          onClose();
        }}
        onSave={(rate) => {
          dispatch({ type: 'userRate/save', rate });
          onSelect(rate.code);
        }}
      />
    </>
  );
}
