import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, ListItem } from '@/components/ui';
import { getBank } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import { useAccounts, useStore } from '@/state/AppStore';
import { radius, space } from '@/theme/tokens';

import { BankPickerSheet } from './BankPickerSheet';

/** Daftar akun dengan swatch warna bank; ketuk untuk memilih desain kartu (FR-ACC-2). Pratinjau di sheet langsung berubah, jadi tidak perlu toast. */
export function AccountsCard() {
  const t = useT();
  const { dispatch } = useStore();
  const accounts = useAccounts();
  const [editing, setEditing] = useState<string | null>(null);
  const account = accounts.find((a) => a.id === editing) ?? null;

  return (
    <Card padding="md">
      <View style={styles.head}>
        <AppText variant="h3">{t('settings.accounts.title')}</AppText>
        <AppText variant="caption" tone="muted">
          {t('settings.accounts.hint')}
        </AppText>
      </View>
      {accounts.map((a, i) => {
        const bank = getBank(a.bank);
        return (
          <ListItem
            key={a.id}
            title={a.name}
            subtitle={`${bankName(t, a.bank)} · ${t(`domain.accountType.${a.type}`)}`}
            leading={<View style={[styles.swatch, { backgroundColor: bank.color }]} />}
            chevron
            divider={i < accounts.length - 1}
            onPress={() => setEditing(a.id)}
          />
        );
      })}
      <BankPickerSheet
        account={account}
        balance={account?.balance ?? 0}
        onClose={() => setEditing(null)}
        onSelect={(bank) => {
          if (!account) return;
          dispatch({ type: 'account/setBank', id: account.id, bank });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xxs, paddingHorizontal: space.xs, paddingTop: space.xs },
  swatch: { width: 40, height: 28, borderRadius: radius.sm },
});
