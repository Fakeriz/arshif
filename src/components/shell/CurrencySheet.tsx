import { Check } from 'lucide-react-native';

import { BottomSheet, Icon, ListItem } from '@/components/ui';
import { hasRate } from '@/lib/fx';
import { CURRENCIES, PINNED_CURRENCIES, currencyMeta } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';

/** IDR/MYR/TRY/USD dipin di atas (FR-FX-1). Hanya mata uang yang punya kurs yang ditawarkan. */
const ORDER = [...PINNED_CURRENCIES, ...Object.keys(CURRENCIES).filter((c) => !(PINNED_CURRENCIES as readonly string[]).includes(c))].filter((c) => hasRate(c));

export function CurrencySheet({ visible, value, onSelect, onClose }: { visible: boolean; value: string; onSelect: (code: string) => void; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih mata uang">
      {ORDER.map((code, i) => {
        const m = currencyMeta(code);
        return (
          <ListItem
            key={code}
            title={`${m.code} · ${m.name}`}
            subtitle={m.symbol}
            trailing={code === value ? <Icon icon={Check} color={colors.accentText} /> : undefined}
            divider={i < ORDER.length - 1}
            onPress={() => {
              onSelect(code);
              onClose();
            }}
          />
        );
      })}
    </BottomSheet>
  );
}

