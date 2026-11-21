import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, ListCard, ListItem } from '@/components/ui';
import { getBank } from '@/constants/banks';
import { bankName, useT } from '@/i18n';
import { isCreditType } from '@/lib/credit';
import { useStore } from '@/state/AppStore';
import { useLedger } from '@/state/derived';
import { radius, space } from '@/theme/tokens';

/** Daftar akun dengan swatch warna bank; ketuk untuk detail akun (desain kartu, limit, grup, iuran tahunan). */
export function AccountsCard() {
  const t = useT();
  const router = useRouter();
  const { state } = useStore();
  const accounts = useLedger().accounts;
  const credits = accounts.filter((a) => isCreditType(a.type)).length;

  return (
    <>
      {/* Judul "Akun & kartu" ada di header; tambah akun = ikon + di kanan atas. Swatch = warna bank (entitas beridentitas). */}
      <AppText variant="caption" tone="muted" style={styles.head}>
        {t('settings.accounts.hint')}
      </AppText>
      <ListCard>
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
      </ListCard>
    </>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.xs },
  swatch: { width: 40, height: 28, borderRadius: radius.sm },
});
