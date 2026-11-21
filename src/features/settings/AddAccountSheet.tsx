import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { BottomSheet, Button, ListCard, ListItem, useToast } from '@/components/ui';
import { PatternSheet } from '@/features/accounts/CardFaceSettings';
import { patternFor } from '@/lib/cardFace';
import { insertAccount, RemoteError } from '@/data/remote/api';
import { StepAccount } from '@/features/setup/StepAccount';
import { accountFromDraft, type SetupDraft } from '@/features/setup/draft';
import { useT } from '@/i18n';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

type Draft = SetupDraft['account'];

/** Tambah akun/dompet (FR-ACC-1/2). Batas Free 4 akun ditegakkan server; di sini dijawab dengan paywall. */
export function AddAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { show } = useToast();
  const paywall = usePaywall();
  const { state, dispatch } = useStore();
  const { height } = useWindowDimensions();
  const blank = (): Draft => ({ name: '', type: 'tabungan', bank: 'cash', currency: state.mainCurrency, opening: null, creditLimit: null });
  const [draft, setDraft] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const nameOk = draft.name.trim().length > 0;

  const save = async () => {
    setTried(true);
    if (!nameOk || saving) return;
    setSaving(true);
    try {
      const account = await insertAccount(accountFromDraft(draft));
      dispatch({ type: 'account/add', account });
      show({ tone: 'success', title: t('settings.accounts.added', { name: account.name }) });
      setDraft(blank());
      setTried(false);
      onClose();
    } catch (e) {
      if (e instanceof RemoteError && /quota_accounts/.test(e.message)) {
        onClose();
        paywall(t('home.accountLimitReason'));
      } else {
        show({ tone: 'error', title: t('settings.accounts.addFailed') });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('settings.accounts.addTitle')}>
      <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <StepAccount value={draft} mainCurrency={state.mainCurrency} nameError={tried && !nameOk} onChange={setDraft} />
        <ListCard>
          <ListItem title={t('acct.pattern.row')} subtitle={t(`acct.pattern.${patternFor(draft.type, draft.cardStyle)}`)} chevron onPress={() => setPicking(true)} />
        </ListCard>
      </ScrollView>
      <PatternSheet
        visible={picking}
        bank={draft.bank}
        type={draft.type}
        currency={draft.currency}
        balance={draft.opening ?? 0}
        current={draft.cardStyle}
        onClose={() => setPicking(false)}
        onSelect={(cardStyle) => {
          setDraft((d) => ({ ...d, cardStyle }));
          setPicking(false);
        }}
      />
      <Button label={saving ? t('settings.accounts.adding') : t('settings.accounts.addTitle')} fullWidth onPress={() => void save()} disabled={saving} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: space.lg, paddingBottom: space.lg } });
