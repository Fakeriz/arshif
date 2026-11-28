import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { afterSheetClose } from '@/components/shell/HeaderActions';
import { usePaywall } from '@/components/shell/Paywall';
import { BottomSheet, Button, ListCard, ListItem, useToast } from '@/components/ui';
import { insertAccount, RemoteError } from '@/data/remote/api';
import { discardPrivate } from '@/data/remote/upload';
import { cardStyleSummary, PatternSheet } from '@/features/accounts/CardFaceSettings';
import { CameraDeniedError, cropCardImage, pickImage, uploadCardPhotoDraft } from '@/features/settings/avatar';
import { CropModal } from '@/features/settings/CropModal';
import { StepAccount } from '@/features/setup/StepAccount';
import { accountFromDraft, type SetupDraft } from '@/features/setup/draft';
import { useT } from '@/i18n';
import type { Rect, Size } from '@/lib/crop';
import { useStore } from '@/state/AppStore';
import { space } from '@/theme/tokens';

type Draft = SetupDraft['account'];

/** Tambah akun/dompet (FR-ACC-1/2). Batas Free 4 akun ditegakkan server; di sini dijawab dengan paywall. */
export function AddAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { show } = useToast();
  const paywall = usePaywall();
  const { state, dispatch, userId } = useStore();
  const { height } = useWindowDimensions();
  const blank = (): Draft => ({ name: '', type: 'tabungan', bank: 'cash', currency: state.mainCurrency, opening: null, creditLimit: null });
  const [draft, setDraft] = useState<Draft>(blank);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);
  const [cropping, setCropping] = useState<({ uri: string } & Size) | null>(null);
  const nameOk = draft.name.trim().length > 0;

  const photoFailed = () => show({ tone: 'error', title: t('acct.pattern.photoFailed'), message: t('settings.profile.tryAgain') });

  const startPickPhoto = () => {
    setPicking(false);
    afterSheetClose(() => {
      if (!userId) return;
      void pickImage('library')
        .then((picked) => {
          if (picked) setCropping(picked);
        })
        .catch((e) => {
          if (e instanceof CameraDeniedError) {
            show({ tone: 'warning', title: t('settings.profile.cameraDenied'), message: t('settings.profile.cameraDeniedMessage') });
          } else {
            photoFailed();
          }
        });
    });
  };

  const confirmCrop = async (source: string, rect: Rect) => {
    setCropping(null);
    try {
      const uri = await cropCardImage(source, rect);
      setDraftPhotoUri(uri);
    } catch {
      photoFailed();
    }
  };

  const save = async () => {
    setTried(true);
    if (!nameOk || saving) return;
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let nextDraft = draft;
      if (draftPhotoUri && userId) {
        const up = await uploadCardPhotoDraft(userId, draftPhotoUri);
        uploadedPath = up.path;
        nextDraft = { ...draft, cardStyle: up.cardStyle };
      }
      const account = await insertAccount(accountFromDraft(nextDraft));
      dispatch({ type: 'account/add', account });
      show({ tone: 'success', title: t('settings.accounts.added', { name: account.name }) });
      setDraft(blank());
      setDraftPhotoUri(null);
      setTried(false);
      onClose();
    } catch (e) {
      if (uploadedPath) await discardPrivate('avatars', uploadedPath);
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
        <StepAccount value={draft} mainCurrency={state.mainCurrency} nameError={tried && !nameOk} previewUri={draftPhotoUri} onChange={setDraft} />
        <ListCard>
          <ListItem
            title={t('acct.pattern.row')}
            subtitle={cardStyleSummary(t, draft.type, draft.cardStyle, Boolean(draftPhotoUri))}
            chevron
            onPress={() => setPicking(true)}
          />
        </ListCard>
      </ScrollView>
      <PatternSheet
        visible={picking}
        bank={draft.bank}
        type={draft.type}
        currency={draft.currency}
        balance={draft.opening ?? 0}
        current={draft.cardStyle}
        previewUri={draftPhotoUri}
        busy={saving}
        onClose={() => setPicking(false)}
        onPickPhoto={startPickPhoto}
        onRemovePhoto={() => {
          setDraftPhotoUri(null);
          setDraft((d) => ({ ...d, cardStyle: undefined }));
          setPicking(false);
        }}
        onSelect={(cardStyle) => {
          setDraftPhotoUri(null);
          setDraft((d) => ({ ...d, cardStyle }));
          setPicking(false);
        }}
      />
      {cropping ? (
        <CropModal
          image={cropping}
          shape="card"
          onCancel={() => setCropping(null)}
          onConfirm={(rect) => void confirmCrop(cropping.uri, rect)}
        />
      ) : null}
      <Button label={saving ? t('settings.accounts.adding') : t('settings.accounts.addTitle')} fullWidth onPress={() => void save()} disabled={saving} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: space.lg, paddingBottom: space.lg } });
