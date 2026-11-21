import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BankCard, BottomSheet, Button, Icon, Input, ListCard, ListItem, PressableScale, Toggle } from '@/components/ui';
import type { Account, AccountType } from '@/data/types';
import { useT } from '@/i18n';
import { cleanExpiry, cleanHolder, cleanLast4, hasChip, HOLDER_MAX, patternFor, PATTERNS, type Pattern } from '@/lib/cardFace';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Pilih motif kartu (pengganti katalog artwork): 5 motif dari contoh di atas warna bank, pratinjau kartu asli. */
export function PatternSheet({ visible, bank, type, currency, balance, current, onSelect, onClose }: {
  visible: boolean;
  bank: string;
  type: AccountType;
  currency: string;
  balance: number;
  current?: string;
  onSelect: (pattern: Pattern) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const [gridW, setGridW] = useState(0);
  const selected = patternFor(type, current);
  // Dua kolom selebar grid yang terukur, dikurangi bingkai pilihan (2 garis + 2 jarak tiap sisi).
  const cardW = Math.floor((gridW - space.md) / 2) - 8;
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('acct.pattern.title')} subtitle={t('acct.pattern.sub')} scrollable>
      <View testID="pattern-grid" style={styles.grid} accessibilityRole="radiogroup" onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {gridW > 0 && PATTERNS.map((p) => {
          const on = p === selected;
          return (
            <PressableScale
              key={p}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t(`acct.pattern.${p}`)}
              onPress={() => onSelect(p)}
              focusRadius={radius.md}
              containerStyle={[styles.cell, { width: cardW + 8 }]}
            >
              <View style={[styles.frame, { borderColor: on ? colors.text : 'transparent' }]}>
                <BankCard bank={bank} accountType={t(`domain.accountType.${type}`)} type={type} balance={balance} currency={currency} cardStyle={p} width={cardW} />
                {on ? (
                  <View style={[styles.check, { backgroundColor: colors.surface }]}>
                    <Icon icon={Check} color={colors.text} size={12} />
                  </View>
                ) : null}
              </View>
              <AppText variant="caption" tone={on ? 'primary' : 'secondary'} style={styles.center}>
                {t(`acct.pattern.${p}`)}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
}

type Field = 'last4' | 'holder' | 'expiry';
const CLEAN: Record<Field, (v: string) => string | null> = { last4: cleanLast4, holder: cleanHolder, expiry: cleanExpiry };

/**
 * Detail opsional di wajah kartu: tiap baris punya sakelar. Nyala = isian dibuka dan tampil di kartu setelah disimpan;
 * mati = dikosongkan dan tidak tampil. Tunai tanpa detail (kartu menulis "Uang di dompet"); masa berlaku hanya kartu bank.
 */
export function CardDetailsCard({ account, onChange }: { account: Account; onChange: (patch: Partial<Record<Field, string | null>>) => void }) {
  const t = useT();
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  if (account.type === 'cash') return null;

  const fields: Field[] = hasChip(account.type) ? ['last4', 'holder', 'expiry'] : ['last4', 'holder'];
  const shown: Record<Field, string | undefined> = { last4: account.last4 ? `•••• ${account.last4}` : undefined, holder: account.holder, expiry: account.expiry };
  const open = (f: Field) => {
    setDraft(account[f] ?? '');
    setTried(false);
    setEditing(f);
  };
  const clean = editing ? CLEAN[editing](draft) : null;
  const save = () => {
    setTried(true);
    if (!editing || !clean) return;
    onChange({ [editing]: clean });
    setEditing(null);
  };

  return (
    <>
      <AppText variant="caption" tone="muted" style={styles.groupLabel}>
        {t('acct.cardDetails.hint')}
      </AppText>
      <ListCard>
        {fields.map((f, i) => {
          const on = !!account[f];
          return (
            <ListItem
              key={f}
              title={t(`acct.cardDetails.${f}`)}
              subtitle={shown[f] ?? t('acct.cardDetails.off')}
              trailing={
                <Toggle
                  value={on}
                  accessibilityLabel={t('acct.cardDetails.toggleA11y', { field: t(`acct.cardDetails.${f}`) })}
                  onChange={(v) => (v ? open(f) : onChange({ [f]: null }))}
                />
              }
              divider={i < fields.length - 1}
              onPress={on ? () => open(f) : undefined}
            />
          );
        })}
      </ListCard>
      <BottomSheet visible={editing !== null} onClose={() => setEditing(null)} title={editing ? t(`acct.cardDetails.${editing}`) : ''}>
        {editing ? (
          <View style={styles.form}>
            <Input
              label={t(`acct.cardDetails.${editing}Label`)}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              keyboardType={editing === 'holder' ? 'default' : 'number-pad'}
              autoCapitalize={editing === 'holder' ? 'characters' : 'none'}
              maxLength={editing === 'last4' ? 4 : editing === 'expiry' ? 5 : HOLDER_MAX + 10}
              placeholder={editing === 'expiry' ? 'MM/YY' : undefined}
              returnKeyType="done"
              onSubmitEditing={save}
              error={tried && !clean ? t(`acct.cardDetails.${editing}Invalid`) : undefined}
            />
            <Button label={t('common.save')} fullWidth onPress={save} />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingBottom: space.lg },
  cell: { gap: space.xs },
  frame: { borderWidth: 2, borderRadius: radius.md, padding: 2 },
  // Pojok kanan bawah: tidak menutupi saldo di strip atas kartu.
  check: { position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  groupLabel: { paddingHorizontal: space.xs },
  form: { gap: space.lg, paddingBottom: space.lg },
});
