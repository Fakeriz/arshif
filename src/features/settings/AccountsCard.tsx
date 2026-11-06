import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Plus } from 'lucide-react-native';

import { AppText, Button, Card, ListItem } from '@/components/ui';
import { getBank } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import { isCreditType } from '@/lib/credit';
import { useAccounts, useStore } from '@/state/AppStore';
import { radius, space } from '@/theme/tokens';

import { AddAccountSheet } from './AddAccountSheet';

/** Daftar akun dengan swatch warna bank; ketuk untuk detail akun (desain kartu, limit, grup, iuran tahunan). */
export function AccountsCard() {
  const t = useT();
  const router = useRouter();
  const { state } = useStore();
  const accounts = useAccounts();
  const [adding, setAdding] = useState(false);
  const credits = accounts.filter((a) => isCreditType(a.type)).length;

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
            divider={i < accounts.length - 1 || credits >= 2}
            onPress={() => router.push({ pathname: '/akun/[id]', params: { id: a.id } })}
          />
        );
      })}
      {credits >= 2 && (
        <ListItem
          title={t('acct.group.title')}
          subtitle={state.limitGroups.length ? t('acct.group.rowCount', { count: state.limitGroups.length }) : t('acct.group.rowSub')}
          subtitleLines={2}
          chevron
          onPress={() => router.push('/akun/grup')}
        />
      )}
      <Button label={t('settings.accounts.addTitle')} icon={Plus} variant="ghost" size="md" fullWidth onPress={() => setAdding(true)} />
      <AddAccountSheet visible={adding} onClose={() => setAdding(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xxs, paddingHorizontal: space.xs, paddingTop: space.xs },
  swatch: { width: 40, height: 28, borderRadius: radius.sm },
});
