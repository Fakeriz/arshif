import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Chip, Input, Tabs } from '@/components/ui';
import { categoriesFor } from '@/constants/categories';
import type { Account } from '@/data/types';
import { categoryLabel, useT } from '@/i18n';
import type { SmartLogRuleAction, SmartLogRuleInput } from '@/lib/smartlog/rules';
import { space } from '@/theme/tokens';

export type RuleSheetProps = {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  initialPattern?: string;
  initialAction?: SmartLogRuleAction;
  initialCategoryKey?: string;
  initialToAccountId?: string | null;
  onSave(input: SmartLogRuleInput): Promise<void>;
};

/** Sheet pembuat aturan Smart Log untuk kategorisasi merchant atau transfer antar dompet sendiri. */
export function RuleSheet({
  visible,
  onClose,
  accounts,
  initialPattern = '',
  initialAction = 'categorize',
  initialCategoryKey = 'food',
  initialToAccountId = null,
  onSave,
}: RuleSheetProps) {
  const t = useT();
  const [pattern, setPattern] = useState(initialPattern);
  const [action, setAction] = useState<SmartLogRuleAction>(initialAction);
  const [categoryKey, setCategoryKey] = useState(initialCategoryKey);
  const [toAccountId, setToAccountId] = useState<string | null>(initialToAccountId ?? accounts[0]?.id ?? null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = pattern.trim();
  const patternBad = trimmed.length < 2 || trimmed.length > 60;
  const targetBad = action === 'transfer' && !toAccountId;
  const expenseCategories = categoriesFor('expense', categoryKey);

  const submit = async () => {
    setTried(true);
    if (patternBad || targetBad || busy) return;
    setBusy(true);
    try {
      await onSave({
        pattern: trimmed,
        action,
        categoryKey: action === 'transfer' ? 'savings' : categoryKey,
        toAccountId: action === 'transfer' ? toAccountId : null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('slog.rules.sheetTitle')} subtitle={t('slog.rules.sheetSub')}>
      <View style={styles.body}>
        <Input
          label={t('slog.rules.patternLabel')}
          placeholder={t('slog.rules.patternPlaceholder')}
          value={pattern}
          onChangeText={setPattern}
          error={tried && patternBad ? t('slog.rules.patternError') : undefined}
        />
        <Tabs
          accessibilityLabel={t('slog.rules.actionLabel')}
          value={action}
          onChange={setAction}
          items={[
            { key: 'categorize', label: t('slog.rules.actionCategorize') },
            { key: 'transfer', label: t('slog.rules.actionTransfer') },
          ]}
        />
        {action === 'categorize' ? (
          <View style={styles.section}>
            <AppText variant="caption" tone="secondary">
              {t('slog.rules.categoryLabel')}
            </AppText>
            <View style={styles.chips}>
              {expenseCategories.map((c) => (
                <Chip key={c.key} label={categoryLabel(t, c.key)} selected={categoryKey === c.key} onPress={() => setCategoryKey(c.key)} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <AppText variant="caption" tone="secondary">
              {t('slog.rules.toAccountLabel')}
            </AppText>
            {accounts.length === 0 ? (
              <AppText variant="caption" tone="warning">
                {t('slog.automation.noAccounts')}
              </AppText>
            ) : (
              <View style={styles.chips}>
                {accounts.map((a) => (
                  <Chip key={a.id} label={`${a.name} · ${a.currency}`} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
                ))}
              </View>
            )}
            {tried && targetBad && (
              <AppText variant="caption" tone="negative">
                {t('slog.rules.toAccountError')}
              </AppText>
            )}
          </View>
        )}
        <Button label={t('slog.rules.save')} fullWidth loading={busy} disabled={busy || (action === 'transfer' && accounts.length === 0)} onPress={() => void submit()} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  section: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
