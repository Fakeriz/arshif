import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { GridCell, GridRow } from '@/components/shell/DesktopGrid';
import { afterSheetClose } from '@/components/shell/HeaderActions';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Badge, BankCard, Button, Card, EmptyState, ListCard, ListItem, ProgressBar, Skeleton, useToast } from '@/components/ui';
import { CardDetailsCard, cardStyleSummary, PatternSheet } from '@/features/accounts/CardFaceSettings';
import { AnnualFeeSheet, CreditLimitSheet } from '@/features/accounts/sheets';
import { UtilizationBlock } from '@/features/accounts/UtilizationBlock';
import { CameraDeniedError, cropCardImage, pickImage, saveAccountCardPhoto } from '@/features/settings/avatar';
import { BankPickerSheet } from '@/features/settings/BankPickerSheet';
import { CropModal } from '@/features/settings/CropModal';
import { useDesktop } from '@/hooks/useDesktop';
import { bankName, useI18n } from '@/i18n';
import { CALENDARS } from '@/i18n/calendar';
import { feeStatus, isCreditType, markFeePaid, unmarkFeePaid } from '@/lib/credit';
import type { Rect, Size } from '@/lib/crop';
import { parseYMD, shortDate, todayYmd } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Account, AnnualFee } from '@/data/types';
import { useStore } from '@/state/AppStore';
import { useCreditUtilization, useLedger } from '@/state/derived';
import { useLoadState } from '@/state/loadState';
import { useRetry } from '@/state/useRetry';
import { layout, radius, space } from '@/theme/tokens';

type Sheet = 'bank' | 'limit' | 'fee' | 'style' | null;

/** Detail akun: desain kartu, limit + utilisasi (kartu/grup), iuran tahunan (FR-ACC-3/6/7/8). */
export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const load = useLoadState();
  const retry = useRetry();
  const { state, dispatch, userId, applyLocal } = useStore();
  const { accounts, transactions } = useLedger();
  const utilization = useCreditUtilization();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropping, setCropping] = useState<({ uri: string } & Size) | null>(null);
  const { show } = useToast();
  const { width: windowW } = useWindowDimensions();
  const desktop = useDesktop();
  const account = accounts.find((a) => a.id === id);

  if (load !== 'ready') {
    return (
      <Screen>
        <ScreenHeader title={t('acct.detail.title')} />
        {load === 'error' ? (
          <EmptyState kind="error" title={t('acct.common.loadErrorTitle')} message={t('acct.common.loadErrorMessage')} actionLabel={t('common.retry')} onAction={retry} />
        ) : (
          <View style={styles.skeleton} accessibilityLabel={t('acct.common.loading')} aria-busy>
            <Skeleton height={190} radius={radius.lg} />
            <Skeleton height={140} radius={radius.lg} />
          </View>
        )}
      </Screen>
    );
  }
  if (!account) {
    return (
      <Screen>
        <ScreenHeader title={t('acct.detail.title')} />
        <EmptyState title={t('acct.detail.notFoundTitle')} message={t('acct.detail.notFoundMessage')} actionLabel={t('acct.detail.toSettings')} onAction={() => router.replace('/pengaturan')} />
      </Screen>
    );
  }

  const credit = isCreditType(account.type);
  const u = utilization(account.id);
  const group = state.limitGroups.find((g) => g.id === account.limitGroupId);
  const patch = (p: Partial<Pick<Account, 'creditLimit' | 'limitGroupId' | 'annualFee'>>) =>
    dispatch({ type: 'account/credit', id: account.id, patch: { creditLimit: account.creditLimit, limitGroupId: account.limitGroupId, annualFee: account.annualFee, ...p } });

  const photoFailed = () => show({ tone: 'error', title: t('acct.pattern.photoFailed'), message: t('settings.profile.tryAgain') });

  const startPickPhoto = () => {
    setSheet(null);
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

  const uploadCardPhoto = async (source: string, rect: Rect) => {
    setCropping(null);
    if (!userId) return;
    setPhotoBusy(true);
    let uri: string;
    try {
      uri = await cropCardImage(source, rect);
    } catch {
      setPhotoBusy(false);
      photoFailed();
      return;
    }
    setPhotoPreview(uri);
    try {
      const nextStyle = await saveAccountCardPhoto(userId, account.id, uri, account.cardStyle);
      applyLocal({ type: 'account/setCardStyle', id: account.id, cardStyle: nextStyle });
      show({ tone: 'success', title: t('acct.pattern.saved') });
    } catch {
      photoFailed();
    } finally {
      setPhotoPreview(null);
      setPhotoBusy(false);
    }
  };

  const cardSide = (
    <>
      <View style={styles.preview}>
        <BankCard
          bank={account.bank}
          accountType={t(`domain.accountType.${account.type}`)}
          type={account.type}
          last4={account.last4}
          holder={account.holder}
          expiry={account.expiry}
          balance={account.balance}
          currency={account.currency}
          hidden={state.hideBalance}
          cardStyle={account.cardStyle}
          previewUri={photoPreview}
          width={Math.min(windowW, layout.maxContentWidth) - space.lg * 2}
        />
      </View>
      {/* Tanpa ikon: properti akun ini. */}
      <ListCard>
        <ListItem title={t('acct.detail.type')} trailing={t(`domain.accountType.${account.type}`)} divider />
        <ListItem title={t('acct.detail.currency')} trailing={account.currency} divider />
        <ListItem title={t('acct.detail.design')} subtitle={bankName(t, account.bank)} chevron divider onPress={() => setSheet('bank')} />
        <ListItem title={t('acct.pattern.row')} subtitle={cardStyleSummary(t, account.type, account.cardStyle, Boolean(photoPreview))} chevron onPress={() => setSheet('style')} />
      </ListCard>
    </>
  );
  const detailSide = (
    <>
      <CardDetailsCard account={account} onChange={(patch) => dispatch({ type: 'account/setCardDetails', id: account.id, patch })} />

      {credit && (
        <Card>
          <View style={styles.head}>
            <AppText variant="h3" style={styles.flex}>
              {t('acct.limit.title')}
            </AppText>
            <Button label={account.creditLimit ? t('acct.limit.edit') : t('acct.limit.set')} variant="secondary" size="sm" onPress={() => setSheet('limit')} />
          </View>
          {u ? (
            <UtilizationBlock u={u} />
          ) : (
            <AppText variant="caption" tone="secondary">
              {t('acct.limit.none')}
            </AppText>
          )}
          {group && account.creditLimit ? (
            <AppText variant="caption" tone="muted">
              {t('acct.limit.ownLimit', { amount: formatMoney(account.creditLimit, account.currency) })}
            </AppText>
          ) : null}
          <ListItem
            title={group ? t('acct.group.memberOf', { name: group.name }) : t('acct.group.join')}
            subtitle={group ? t('acct.group.manageSub') : t('acct.group.joinSub')}
            subtitleLines={2}
            chevron
            onPress={() => router.push('/akun/grup')}
          />
        </Card>
      )}

      {account.type === 'kartu_kredit' && (
        <FeeCard
          fee={account.annualFee}
          accountId={account.id}
          currency={account.currency}
          transactions={transactions}
          lang={lang}
          onEdit={() => setSheet('fee')}
          onChange={(annualFee) => patch({ annualFee })}
        />
      )}
    </>
  );

  return (
    <Screen wide={desktop}>
      <ScreenHeader title={account.name} />
      {desktop ? (
        // Desktop: kartu dan propertinya di kiri, rincian kartu, limit, dan iuran di kanan.
        <GridRow style={styles.top}>
          <GridCell span={6}>{cardSide}</GridCell>
          <GridCell span={6} order={1}>
            {detailSide}
          </GridCell>
        </GridRow>
      ) : (
        <>
          {cardSide}
          {detailSide}
        </>
      )}

      <PatternSheet
        visible={sheet === 'style'}
        bank={account.bank}
        type={account.type}
        currency={account.currency}
        balance={account.balance}
        current={account.cardStyle}
        previewUri={photoPreview}
        busy={photoBusy}
        onClose={() => setSheet(null)}
        onPickPhoto={startPickPhoto}
        onRemovePhoto={() => {
          dispatch({ type: 'account/setCardStyle', id: account.id, cardStyle: null });
          setSheet(null);
          show({ tone: 'success', title: t('acct.pattern.saved') });
        }}
        onSelect={(cardStyle) => {
          dispatch({ type: 'account/setCardStyle', id: account.id, cardStyle });
          setSheet(null);
          show({ tone: 'success', title: t('acct.pattern.saved') });
        }}
      />
      {cropping ? (
        <CropModal
          image={cropping}
          shape="card"
          onCancel={() => setCropping(null)}
          onConfirm={(rect) => void uploadCardPhoto(cropping.uri, rect)}
        />
      ) : null}
      <BankPickerSheet
        account={sheet === 'bank' ? account : null}
        balance={account.balance}
        onClose={() => setSheet(null)}
        onSelect={(bank) => dispatch({ type: 'account/setBank', id: account.id, bank })}
      />
      <CreditLimitSheet
        key={`limit-${sheet === 'limit'}`}
        visible={sheet === 'limit'}
        currency={account.currency}
        initial={account.creditLimit}
        onClose={() => setSheet(null)}
        onSave={(creditLimit) => patch({ creditLimit })}
      />
      <AnnualFeeSheet
        key={`fee-${sheet === 'fee'}`}
        visible={sheet === 'fee'}
        currency={account.currency}
        initial={account.annualFee}
        onClose={() => setSheet(null)}
        onSave={(annualFee) => patch({ annualFee })}
        onRemove={account.annualFee ? () => patch({ annualFee: undefined }) : undefined}
      />
    </Screen>
  );
}

function FeeCard({ fee, accountId, currency, transactions, lang, onEdit, onChange }: {
  fee: AnnualFee | undefined; accountId: string; currency: string; transactions: Parameters<typeof feeStatus>[1]; lang: ReturnType<typeof useI18n>['lang'];
  onEdit: () => void; onChange: (fee: AnnualFee) => void;
}) {
  const { t } = useI18n();
  const today = todayYmd();
  if (!fee) {
    return (
      <Card>
        <AppText variant="h3">{t('acct.fee.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('acct.fee.none')}
        </AppText>
        <Button label={t('acct.fee.set')} variant="secondary" size="md" onPress={onEdit} />
      </Card>
    );
  }
  const s = feeStatus({ id: accountId, annualFee: fee }, transactions, today);
  const dateLong = (d: string) => {
    const p = parseYMD(d);
    return `${p.d} ${CALENDARS[lang].months[p.m - 1]} ${p.y}`;
  };
  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="h3" style={styles.flex}>
          {t('acct.fee.title')}
        </AppText>
        <Button label={t('acct.fee.edit')} variant="secondary" size="sm" onPress={onEdit} />
      </View>
      <ListItem title={t('acct.fee.amount')} trailing={formatMoney(fee.amount, currency)} divider />
      <ListItem title={t('acct.fee.billedOn')} trailing={`${fee.day} ${CALENDARS[lang].months[fee.month - 1]}`} divider />
      <ListItem title={t('acct.fee.next')} trailing={shortDate(s.nextDate, lang)} />
      <View style={styles.status}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{t('acct.fee.cycle', { date: dateLong(s.lastDate) })}</AppText>
          <AppText variant="caption" tone="secondary">
            {s.paid ? t('acct.fee.paidNote') : t('acct.fee.unpaidNote')}
          </AppText>
        </View>
        <Badge label={s.paid ? t('acct.fee.paid') : t('acct.fee.unpaid')} tone={s.paid ? 'positive' : 'warning'} />
      </View>
      <Button
        label={s.paid ? t('acct.fee.unmark') : t('acct.fee.mark')}
        variant={s.paid ? 'ghost' : 'secondary'}
        size="md"
        fullWidth
        onPress={() => onChange(s.paid ? unmarkFeePaid(fee, s.lastDate) : markFeePaid(fee, s.lastDate))}
      />
      {s.progress !== null && s.remaining !== null && fee.waiverThreshold ? (
        <View style={styles.waiver}>
          <AppText variant="bodyStrong">{s.remaining > 0 ? t('acct.fee.waiverLeft', { amount: formatMoney(s.remaining, currency) }) : t('acct.fee.waiverDone')}</AppText>
          <ProgressBar value={s.progress} tone="positive" accessibilityLabel={t('acct.fee.waiverA11y', { pct: Math.round(s.progress * 100) })} />
          <AppText variant="caption" tone="muted">
            {t('acct.fee.waiverSpent', { spent: formatMoney(s.spent, currency), threshold: formatMoney(fee.waiverThreshold, currency), date: shortDate(s.lastDate, lang) })}
          </AppText>
        </View>
      ) : (
        <AppText variant="caption" tone="muted">
          {t('acct.fee.noThreshold')}
        </AppText>
      )}
      <View style={styles.history}>
        <AppText variant="caption" tone="secondary" accessibilityRole="header">
          {t('acct.fee.history')}
        </AppText>
        {fee.paid.length === 0 ? (
          <AppText variant="caption" tone="muted">
            {t('acct.fee.historyEmpty')}
          </AppText>
        ) : (
          [...fee.paid].reverse().map((d) => (
            <AppText key={d} variant="body">
              {dateLong(d)}
            </AppText>
          ))
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start' },
  skeleton: { gap: space.lg },
  preview: { alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  flex: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.md },
  waiver: { gap: space.xs, marginTop: space.lg },
  history: { gap: space.xs, marginTop: space.lg },
});
