import { Bell, RefreshCw, Search, TrendingUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Badge, Button, Chip, Dialog, Icon, Input, ProgressBar, Skeleton } from '@/components/ui';
import { adminBroadcast, adminBroadcastCount, adminFxStatus, type AdminFxStatus, type BroadcastSegment } from '@/data/remote/api';
import { FnError, invokeFn } from '@/data/remote/functions';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { FUNCTIONS, FxSyncResponse } from '../../../supabase/functions/_shared/contracts';
import {
  CORRIDOR_CURRENCIES,
  fetchAdminOpsOverview,
  fetchLatestFxRates,
  fetchLiveAssetPrices,
  triggerAssetPricesSync,
  type AdminOpsOverview,
  type AdminRecentBroadcast,
  type AssetPricesSyncResult,
  type FxRateRow,
  type LiveAssetPriceRow,
} from './adminApi';
import { copy } from './copy';
import { ago, date, dateTime, formatRate, msLabel, num } from './format';
import { DataState, HeroInkPanel, Panel, Refreshing, Rows, SectionToolbar, useLoad } from './parts';

type FxBundle = {
  status: AdminFxStatus;
  rates: FxRateRow[];
  assets: LiveAssetPriceRow[];
  ops: AdminOpsOverview | null;
};

const ASSET_MARKETS = ['ALL', 'IDX', 'US', 'CRYPTO', 'GOLD'] as const;
type AssetMarketFilter = (typeof ASSET_MARKETS)[number];
const CORRIDOR_SET = new Set<string>(CORRIDOR_CURRENCIES);

/** FR-ADM-3: status sinkronisasi kurs terakhir + tabel kurs aktif + kesehatan harga aset + sinkron manual. */
export function FxSection({
  autoSyncFxSeq = 0,
  autoSyncAssetsSeq = 0,
}: {
  autoSyncFxSeq?: number;
  autoSyncAssetsSeq?: number;
}) {
  const f = copy.fx;
  const load = useLoad<FxBundle>(async () => {
    const [status, assets, ops] = await Promise.all([
      adminFxStatus(),
      fetchLiveAssetPrices(),
      fetchAdminOpsOverview(),
    ]);
    const rates = await fetchLatestFxRates(status.latest_rate_date);
    return { status, rates, assets, ops };
  }, []);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetNotice, setAssetNotice] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);
  const [lastAssetResult, setLastAssetResult] = useState<AssetPricesSyncResult | null>(null);

  const [rateQuery, setRateQuery] = useState('');
  const [rateScope, setRateScope] = useState<'corridor' | 'all'>('corridor');
  const [marketFilter, setMarketFilter] = useState<AssetMarketFilter>('ALL');

  const lastFxTrigger = useRef(0);
  const lastAssetTrigger = useRef(0);

  const sync = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await invokeFn(FUNCTIONS.fxSync, {}, FxSyncResponse);
      setNotice({ tone: 'positive', text: f.synced(date(`${r.date}T12:00:00`), r.codes) });
    } catch (e) {
      setNotice({ tone: 'negative', text: e instanceof FnError && e.code === 'forbidden' ? copy.gate.forbiddenTitle : f.syncFailed });
    } finally {
      setBusy(false);
      load.reload();
    }
  }, [f, load]);

  const syncAssets = useCallback(async () => {
    setAssetBusy(true);
    setAssetNotice(null);
    try {
      const r = await triggerAssetPricesSync();
      setLastAssetResult(r);
      setAssetNotice({ tone: 'positive', text: f.assetsSynced(r.updated, r.symbols, r.failed.length) });
    } catch (e) {
      setAssetNotice({ tone: 'negative', text: e instanceof FnError && e.code === 'forbidden' ? copy.gate.forbiddenTitle : f.assetsSyncFailed });
    } finally {
      setAssetBusy(false);
      load.reload();
    }
  }, [f, load]);

  useEffect(() => {
    if (autoSyncFxSeq > 0 && autoSyncFxSeq !== lastFxTrigger.current) {
      lastFxTrigger.current = autoSyncFxSeq;
      void sync();
    }
  }, [autoSyncFxSeq, sync]);

  useEffect(() => {
    if (autoSyncAssetsSeq > 0 && autoSyncAssetsSeq !== lastAssetTrigger.current) {
      lastAssetTrigger.current = autoSyncAssetsSeq;
      void syncAssets();
    }
  }, [autoSyncAssetsSeq, syncAssets]);

  return (
    <DataState
      load={load}
      loadingLabel={f.loading}
      errorTitle={f.error}
      skeleton={
        <View style={styles.gap}>
          <Skeleton height={200} radius={radius.card} />
          <Skeleton height={200} radius={radius.lg} />
        </View>
      }
    >
      {({ status: s, rates, assets, ops }) => {
        const last = s.runs[0];
        const idrRow = rates.find((r) => r.code === 'IDR');
        const idrPerUsd = idrRow?.per_usd ?? null;
        const rq = rateQuery.trim().toUpperCase();
        const visibleRates = rates.filter((r) => {
          if (rq) return r.code.includes(rq);
          if (rateScope === 'corridor') return CORRIDOR_SET.has(r.code);
          return true;
        });

        const marketCounts: Record<AssetMarketFilter, number> = {
          ALL: assets.length,
          IDX: assets.filter((a) => a.symbol.startsWith('IDX:')).length,
          US: assets.filter((a) => a.symbol.startsWith('US:')).length,
          CRYPTO: assets.filter((a) => a.symbol.startsWith('CRYPTO:')).length,
          GOLD: assets.filter((a) => a.symbol.startsWith('GOLD:')).length,
        };
        const visibleAssets = assets.filter((a) => marketFilter === 'ALL' || a.symbol.startsWith(`${marketFilter}:`));

        const assetRuns = ops?.asset_runs ?? [];

        return (
          <View style={styles.gap}>
            <SectionToolbar updatedAt={load.updatedAt} loading={load.loading && load.data !== null} onReload={load.reload} />

            <HeroInkPanel>
              <View style={styles.line}>
                <View style={[styles.flex, styles.facts]}>
                  <AppText variant="caption" tone="secondary">
                    {f.lastRun}
                  </AppText>
                  {last ? (
                    <View style={styles.line}>
                      <AppText variant="h2" style={styles.flex}>
                        {ago(last.ran_at)}
                      </AppText>
                      <Badge label={last.ok ? f.ok : f.failed} tone={last.ok ? 'positive' : 'negative'} />
                    </View>
                  ) : (
                    <AppText variant="body" tone="secondary">
                      {f.noRuns}
                    </AppText>
                  )}
                </View>
                <Refreshing on={load.loading} />
              </View>

              <AppText variant="body" numeric>
                {`${f.latest}: ${s.latest_rate_date ? f.latestValue(date(`${s.latest_rate_date}T12:00:00`), s.codes) : f.none}`}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {f.source}
              </AppText>

              {notice && (
                <AppText variant="body" tone={notice.tone} accessibilityRole="alert">
                  {notice.text}
                </AppText>
              )}
              {assetNotice && (
                <AppText variant="body" tone={assetNotice.tone} accessibilityRole="alert">
                  {assetNotice.text}
                </AppText>
              )}

              <View style={styles.actions}>
                <Button label={busy ? f.syncing : f.sync} icon={RefreshCw} loading={busy} disabled={busy} onPress={() => void sync()} />
                <Button
                  label={assetBusy ? f.syncingAssets : f.syncAssets}
                  icon={TrendingUp}
                  variant="secondary"
                  loading={assetBusy}
                  disabled={assetBusy}
                  onPress={() => void syncAssets()}
                />
              </View>
            </HeroInkPanel>

            <Panel
              title={f.ratesTitle}
              right={rates.length > 0 ? <Badge label={`${num(rates.length)} kode`} tone="neutral" /> : undefined}
            >
              <View style={styles.chips}>
                <Chip label={f.ratesCorridor} selected={rateScope === 'corridor' && !rq} onPress={() => setRateScope('corridor')} />
                <Chip label={f.ratesAll} selected={rateScope === 'all' || Boolean(rq)} onPress={() => setRateScope('all')} />
              </View>
              <Input label={f.ratesSearch} value={rateQuery} onChangeText={setRateQuery} icon={Search} autoCapitalize="characters" autoCorrect={false} />
              {visibleRates.length === 0 ? (
                <AppText variant="body" tone="secondary">
                  {f.ratesEmpty}
                </AppText>
              ) : (
                <Rows>
                  {visibleRates.map((r) => {
                    const toIdr = idrPerUsd && r.code !== 'IDR' && r.per_usd > 0 ? idrPerUsd / r.per_usd : null;
                    return (
                      <View key={r.code} style={styles.line}>
                        <AppText variant="bodyStrong" style={styles.codeCol}>
                          {r.code}
                        </AppText>
                        <AppText variant="caption" tone="secondary" numeric style={styles.flex}>
                          {f.perUsd(formatRate(r.per_usd))}
                        </AppText>
                        {toIdr !== null && (
                          <AppText variant="bodyStrong" numeric>
                            {f.toIdr(r.code, formatRate(toIdr))}
                          </AppText>
                        )}
                      </View>
                    );
                  })}
                </Rows>
              )}
            </Panel>

            <Panel title={f.assetsTitle} right={<Badge label={f.assetSymbols(assets.length)} tone="neutral" />}>
              <View style={styles.chips}>
                {ASSET_MARKETS.map((m) => (
                  <Chip
                    key={m}
                    label={f.assetMarkets[m]}
                    count={marketCounts[m]}
                    selected={marketFilter === m}
                    onPress={() => setMarketFilter(m)}
                  />
                ))}
              </View>
              {visibleAssets.length === 0 ? (
                <AppText variant="body" tone="secondary">
                  {f.assetsEmpty}
                </AppText>
              ) : (
                <Rows>
                  {visibleAssets.slice(0, 25).map((a) => (
                    <View key={a.symbol} style={styles.line}>
                      <View style={[styles.flex, styles.facts]}>
                        <AppText variant="bodyStrong">{a.symbol}</AppText>
                        <AppText variant="caption" tone="secondary" numeric>
                          {ago(a.quoted_at ?? a.fetched_at)}
                        </AppText>
                      </View>
                      <Badge label={a.source} tone="neutral" />
                      <AppText variant="bodyStrong" numeric>
                        {`${formatRate(a.price)} ${a.currency}`}
                      </AppText>
                    </View>
                  ))}
                </Rows>
              )}

              <View style={styles.subBlock}>
                <AppText variant="overline" tone="muted">
                  {f.assetRunsTitle}
                </AppText>
                {lastAssetResult && lastAssetResult.providers.length > 0 ? (
                  <Rows>
                    {lastAssetResult.providers.map((p, idx) => (
                      <View key={`${p.source}-${idx}`} style={styles.line}>
                        <View style={[styles.flex, styles.facts]}>
                          <AppText variant="bodyStrong">{p.source}</AppText>
                          <AppText variant="caption" tone={p.error ? 'negative' : 'secondary'} numeric>
                            {[
                              `${num(p.updated)}/${num(p.symbols)}`,
                              p.ms !== undefined ? msLabel(p.ms) : null,
                              p.error,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </AppText>
                        </View>
                        <Badge label={p.error ? f.failed : f.ok} tone={p.error ? 'negative' : 'positive'} />
                      </View>
                    ))}
                  </Rows>
                ) : assetRuns.length > 0 ? (
                  <Rows>
                    {assetRuns.map((r, idx) => (
                      <View key={`${r.ran_at}-${r.source}-${idx}`} style={styles.line}>
                        <View style={[styles.flex, styles.facts]}>
                          <AppText variant="body">{`${r.source} · ${dateTime(r.ran_at)}`}</AppText>
                          <AppText variant="caption" tone={r.ok ? 'secondary' : 'negative'} numeric>
                            {[
                              f.trigger[r.trigger] ?? r.trigger,
                              `${num(r.updated)}/${num(r.symbols)}`,
                              r.duration_ms !== null ? msLabel(r.duration_ms) : null,
                              r.failed_count > 0 ? `${r.failed_count} gagal` : null,
                              r.error,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </AppText>
                        </View>
                        <Badge label={r.ok ? f.ok : f.failed} tone={r.ok ? 'positive' : 'negative'} />
                      </View>
                    ))}
                  </Rows>
                ) : (
                  <AppText variant="caption" tone="secondary">
                    {f.assetRunsEmpty}
                  </AppText>
                )}
              </View>
            </Panel>

            {s.runs.length > 0 && (
              <Panel title={f.history}>
                <Rows>
                  {s.runs.map((r) => (
                    <View key={r.ran_at} style={styles.line}>
                      <View style={[styles.flex, styles.facts]}>
                        <AppText variant="body">{dateTime(r.ran_at)}</AppText>
                        <AppText variant="caption" tone={r.ok ? 'secondary' : 'negative'}>
                          {[f.trigger[r.trigger], r.rate_date ? f.latestValue(date(`${r.rate_date}T12:00:00`), r.codes ?? 0) : null, r.error]
                            .filter(Boolean)
                            .join(' · ')}
                        </AppText>
                      </View>
                      <Badge label={r.ok ? f.ok : f.failed} tone={r.ok ? 'positive' : 'negative'} />
                    </View>
                  ))}
                </Rows>
              </Panel>
            )}
          </View>
        );
      }}
    </DataState>
  );
}

const SEGMENTS: BroadcastSegment[] = ['all', 'free', 'premium', 'email'];

/** FR-ADM-3: notifikasi in-app ke segmen pengguna (atau satu email untuk uji) dengan templat, pratinjau langsung, dan riwayat. */
export function BroadcastSection({ initialEmail }: { initialEmail?: string }) {
  const b = copy.broadcast;
  const { width } = useWindowDimensions();
  const wide = width >= 880;
  const [segment, setSegment] = useState<BroadcastSegment>('email');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);
  const [sessionHistory, setSessionHistory] = useState<AdminRecentBroadcast[]>([]);

  const ops = useLoad(fetchAdminOpsOverview, []);

  useEffect(() => {
    if (initialEmail) {
      setSegment('email');
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    let live = true;
    setCount(null);
    setCountError(false);
    if (segment === 'email' && !email.trim()) return;
    const id = setTimeout(() => {
      adminBroadcastCount(segment, email.trim())
        .then((n) => live && setCount(n))
        .catch(() => live && setCountError(true));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [segment, email]);

  const titleError = title.trim().length < 1 || title.trim().length > 80 ? b.invalidTitle : undefined;
  const messageError = message.trim().length < 1 || message.trim().length > 300 ? b.invalidMessage : undefined;
  const emailError = segment === 'email' && !email.trim() ? b.invalidEmail : undefined;
  const valid = !titleError && !messageError && !emailError && (count ?? 0) > 0;

  const historyItems = useMemo(() => {
    const server = ops.data?.recent_broadcasts ?? [];
    const seen = new Set<string>();
    const out: AdminRecentBroadcast[] = [];
    for (const item of [...sessionHistory, ...server]) {
      const key = `${item.title}::${item.message}::${item.recipients}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out.slice(0, 8);
  }, [sessionHistory, ops.data]);

  const send = async () => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    setBusy(true);
    setNotice(null);
    try {
      const n = await adminBroadcast(segment, cleanTitle, cleanMessage, email.trim());
      setNotice({ tone: 'positive', text: b.sent(n) });
      setSessionHistory((prev) => [{ sent_at: new Date().toISOString(), title: cleanTitle, message: cleanMessage, recipients: n }, ...prev]);
      setTitle('');
      setMessage('');
      setTouched(false);
      ops.reload();
    } catch {
      setNotice({ tone: 'negative', text: b.failed });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const composer = (
    <Panel>
      <AppText variant="body" tone="secondary">
        {b.intro}
      </AppText>

      <View style={styles.facts}>
        <View style={styles.line}>
          <AppText variant="caption" tone="secondary" style={styles.flex}>
            {b.templatesLabel}
          </AppText>
          {(title.length > 0 || message.length > 0) && (
            <Button
              label={b.clearDraft}
              variant="ghost"
              size="sm"
              onPress={() => {
                setTitle('');
                setMessage('');
                setTouched(false);
              }}
            />
          )}
        </View>
        <View style={styles.chips}>
          {b.templates.map((tpl) => (
            <Chip
              key={tpl.key}
              label={tpl.label}
              selected={title === tpl.title && message === tpl.message}
              onPress={() => {
                setTitle(tpl.title);
                setMessage(tpl.message);
                setTouched(false);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.facts}>
        <AppText variant="caption" tone="secondary">
          {b.segment}
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={b.segment}>
          {SEGMENTS.map((s) => (
            <Chip key={s} label={b.segments[s]} selected={segment === s} onPress={() => setSegment(s)} />
          ))}
        </View>
      </View>

      {segment === 'email' && (
        <Input
          label={b.email}
          value={email}
          onChangeText={setEmail}
          placeholder={b.emailPlaceholder}
          autoCapitalize="none"
          keyboardType="email-address"
          error={touched ? emailError : undefined}
        />
      )}

      <View style={styles.facts}>
        <Input
          label={b.title}
          value={title}
          onChangeText={setTitle}
          placeholder={b.titlePlaceholder}
          maxLength={80}
          hint={`${title.trim().length}/80`}
          error={touched ? titleError : undefined}
        />
        <ProgressBar value={Math.min(1, title.trim().length / 80)} tone={title.trim().length > 72 ? 'warning' : 'accent'} height={4} />
      </View>

      <View style={styles.facts}>
        <Input
          label={b.message}
          value={message}
          onChangeText={setMessage}
          placeholder={b.messagePlaceholder}
          maxLength={300}
          multiline
          error={touched ? messageError : undefined}
          hint={`${message.trim().length}/300`}
        />
        <ProgressBar value={Math.min(1, message.trim().length / 300)} tone={message.trim().length > 270 ? 'warning' : 'accent'} height={4} />
      </View>

      <AppText variant="caption" tone={countError ? 'negative' : 'secondary'} accessibilityLiveRegion="polite">
        {countError ? b.countFailed : segment === 'email' && !email.trim() ? b.invalidEmail : count === null ? b.counting : b.recipients(count)}
      </AppText>

      {notice && (
        <AppText variant="body" tone={notice.tone} accessibilityRole="alert">
          {notice.text}
        </AppText>
      )}

      <View style={styles.actions}>
        <Button
          label={count ? b.send(count) : b.sendDisabled}
          loading={busy}
          disabled={busy || !count}
          onPress={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        />
      </View>

      <Dialog
        visible={confirm}
        title={b.confirmTitle}
        message={b.confirm(count ?? 0, segment === 'email' ? email.trim() : b.segments[segment])}
        tone="warning"
        confirmLabel={b.send(count ?? 0)}
        cancelLabel={b.cancel}
        loading={busy}
        onConfirm={() => void send()}
        onCancel={() => setConfirm(false)}
      />
    </Panel>
  );

  const previewAndHistory = (
    <View style={styles.gap}>
      <HeroInkPanel>
        <BroadcastPreviewBody
          title={title.trim() || b.previewEmptyTitle}
          message={message.trim() || b.previewEmptyMessage}
          targetLabel={`Target: ${segment === 'email' && email.trim() ? email.trim() : b.segments[segment]}`}
          count={count ?? 0}
        />
      </HeroInkPanel>

      <Panel title={b.historyTitle} right={<Refreshing on={ops.loading && ops.data !== null} />}>
        {historyItems.length === 0 ? (
          <AppText variant="body" tone="secondary">
            {b.historyEmpty}
          </AppText>
        ) : (
          <Rows>
            {historyItems.map((h, idx) => (
              <View key={`${h.sent_at}-${idx}`} style={styles.facts}>
                <View style={styles.line}>
                  <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {h.title}
                  </AppText>
                  <Badge label={b.recipients(h.recipients)} tone="neutral" />
                </View>
                <AppText variant="body" tone="secondary">
                  {h.message}
                </AppText>
                <View style={styles.line}>
                  <AppText variant="caption" tone="muted" style={styles.flex}>
                    {dateTime(h.sent_at)}
                  </AppText>
                  <Button
                    label={b.reuse}
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      setTitle(h.title);
                      setMessage(h.message);
                      setTouched(false);
                    }}
                  />
                </View>
              </View>
            ))}
          </Rows>
        )}
      </Panel>
    </View>
  );

  if (wide) {
    return (
      <View style={styles.split}>
        <View style={styles.colMain}>{composer}</View>
        <View style={styles.colSide}>{previewAndHistory}</View>
      </View>
    );
  }
  return (
    <View style={styles.gap}>
      {composer}
      {previewAndHistory}
    </View>
  );
}

function BroadcastPreviewBody({
  title,
  message,
  targetLabel,
  count,
}: {
  title: string;
  message: string;
  targetLabel: string;
  count: number;
}) {
  const { colors } = useTheme();
  const b = copy.broadcast;
  return (
    <>
      <View style={styles.line}>
        <Icon icon={Bell} color={colors.text} size={18} />
        <AppText variant="overline" tone="secondary" style={styles.flex}>
          {b.previewTitle}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {b.previewJustNow}
        </AppText>
      </View>
      <View style={styles.facts}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="body" tone="secondary">
          {message}
        </AppText>
      </View>
      <View style={styles.chips}>
        <Badge label={targetLabel} tone="neutral" />
        <Badge label={b.recipients(count)} tone={count > 0 ? 'positive' : 'neutral'} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  facts: { gap: space.xs },
  subBlock: { gap: space.xs, paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  codeCol: { width: 52 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space.lg },
  colMain: { flex: 3, minWidth: 0 },
  colSide: { flex: 2, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
});
