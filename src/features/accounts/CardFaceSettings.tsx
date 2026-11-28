import { Check, ImagePlus, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BankCard, BottomSheet, Button, Chip, Icon, IconTile, Input, ListCard, ListItem, PressableScale, Toggle } from '@/components/ui';
import type { Account, AccountType } from '@/data/types';
import { useT, type TFunction } from '@/i18n';
import {
  cleanExpiry,
  cleanHolder,
  cleanLast4,
  FINISHES,
  formatCardStyle,
  hasChip,
  HOLDER_MAX,
  parseCardStyle,
  PATTERNS,
  type CardFinish,
} from '@/lib/cardFace';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

/** Ringkasan singkat tampilan kartu saat ini untuk baris "Motif kartu". */
export function cardStyleSummary(t: TFunction, type: AccountType, cardStyle?: string | null, hasDraftPhoto = false): string {
  const parsed = parseCardStyle(type, cardStyle);
  if (hasDraftPhoto || parsed.kind === 'photo') return t('acct.pattern.customPhoto');
  if (parsed.finish === 'bank') return t(`acct.pattern.${parsed.pattern}`);
  return `${t(`acct.finish.${parsed.finish}`)} · ${t(`acct.pattern.${parsed.pattern}`)}`;
}

/** Pilih foto kartu pribadi, material finish, atau salah satu dari 13 motif vektor dengan pratinjau kartu asli. */
export function PatternSheet({
  visible,
  bank,
  type,
  currency,
  balance,
  current,
  previewUri,
  busy,
  onSelect,
  onPickPhoto,
  onRemovePhoto,
  onClose,
}: {
  visible: boolean;
  bank: string;
  type: AccountType;
  currency: string;
  balance: number;
  current?: string;
  previewUri?: string | null;
  busy?: boolean;
  onSelect: (cardStyle: string) => void;
  onPickPhoto?: () => void;
  onRemovePhoto?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  const [gridW, setGridW] = useState(0);
  const parsed = parseCardStyle(type, current);
  const activeFinish: CardFinish = parsed.kind === 'art' ? parsed.finish : 'bank';
  const [finish, setFinish] = useState<CardFinish>(activeFinish);
  useEffect(() => {
    if (visible) setFinish(activeFinish);
  }, [visible, activeFinish]);

  const isPhoto = Boolean(previewUri) || parsed.kind === 'photo';
  // Dua kolom selebar grid yang terukur, dikurangi bingkai pilihan (2 garis + 2 jarak tiap sisi).
  const cardW = Math.floor((gridW - space.md) / 2) - 8;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('acct.pattern.title')} subtitle={t('acct.pattern.sub')} scrollable>
      <View style={styles.sheet}>
        {onPickPhoto ? (
          <ListCard>
            <ListItem
              leading={<IconTile icon={ImagePlus} tone="neutral" />}
              title={t('acct.pattern.uploadPhoto')}
              subtitle={t('acct.pattern.uploadSub')}
              chevron
              divider={Boolean(isPhoto && onRemovePhoto)}
              onPress={busy ? undefined : onPickPhoto}
            />
            {isPhoto && onRemovePhoto ? (
              <ListItem
                leading={<IconTile icon={Trash2} tone="negative" />}
                title={t('acct.pattern.removePhoto')}
                onPress={busy ? undefined : onRemovePhoto}
              />
            ) : null}
          </ListCard>
        ) : null}

        <View style={styles.finishBlock}>
          <AppText variant="caption" tone="secondary">
            {t('acct.pattern.finishLabel')}
          </AppText>
          <View style={styles.chips}>
            {FINISHES.map((f) => (
              <Chip key={f} label={t(`acct.finish.${f}`)} selected={finish === f} onPress={() => setFinish(f)} />
            ))}
          </View>
        </View>

        <View testID="pattern-grid" style={styles.grid} accessibilityRole="radiogroup" onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
          {gridW > 0 &&
            PATTERNS.map((p) => {
              const on = !previewUri && parsed.kind === 'art' && parsed.finish === finish && parsed.pattern === p;
              const styleValue = formatCardStyle(finish, p);
              return (
                <PressableScale
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={t(`acct.pattern.${p}`)}
                  onPress={() => onSelect(styleValue)}
                  focusRadius={radius.md}
                  containerStyle={[styles.cell, { width: cardW + 8 }]}
                >
                  <View style={[styles.frame, { borderColor: on ? colors.text : 'transparent' }]}>
                    <BankCard
                      bank={bank}
                      accountType={t(`domain.accountType.${type}`)}
                      type={type}
                      balance={balance}
                      currency={currency}
                      cardStyle={styleValue}
                      width={cardW}
                    />
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
  // Field terakhir tetap disimpan saat sheet menutup, supaya judul/isian tidak hilang di tengah animasi tutup.
  const [field, setField] = useState<Field>('last4');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  if (account.type === 'cash') return null;

  const fields: Field[] = hasChip(account.type) ? ['last4', 'holder', 'expiry'] : ['last4', 'holder'];
  const shown: Record<Field, string | undefined> = { last4: account.last4 ? `•••• ${account.last4}` : undefined, holder: account.holder, expiry: account.expiry };
  const open = (f: Field) => {
    setDraft(account[f] ?? '');
    setTried(false);
    setField(f);
    setEditing(true);
  };
  const clean = CLEAN[field](draft);
  const save = () => {
    setTried(true);
    if (!clean) return;
    onChange({ [field]: clean });
    setEditing(false);
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
      <BottomSheet visible={editing} onClose={() => setEditing(false)} title={t(`acct.cardDetails.${field}`)}>
        <View style={styles.form}>
          <Input
            label={t(`acct.cardDetails.${field}Label`)}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            keyboardType={field === 'holder' ? 'default' : 'number-pad'}
            autoCapitalize={field === 'holder' ? 'characters' : 'none'}
            maxLength={field === 'last4' ? 4 : field === 'expiry' ? 5 : HOLDER_MAX + 10}
            placeholder={field === 'expiry' ? 'MM/YY' : undefined}
            returnKeyType="done"
            onSubmitEditing={save}
            error={tried && !clean ? t(`acct.cardDetails.${field}Invalid`) : undefined}
          />
          <Button label={t('common.save')} fullWidth onPress={save} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: space.lg },
  finishBlock: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingBottom: space.lg },
  cell: { gap: space.xs },
  frame: { borderWidth: 2, borderRadius: radius.md, padding: 2 },
  // Pojok kanan bawah: tidak menutupi saldo di strip atas kartu.
  check: { position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  groupLabel: { paddingHorizontal: space.xs },
  form: { gap: space.lg, paddingBottom: space.lg },
});
