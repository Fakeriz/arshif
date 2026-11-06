import { RefreshCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Chip, Dialog, Input, Skeleton } from '@/components/ui';
import { adminBroadcast, adminBroadcastCount, adminFxStatus, type BroadcastSegment } from '@/data/remote/api';
import { FnError, invokeFn } from '@/data/remote/functions';
import { radius, space } from '@/theme/tokens';

import { FUNCTIONS, FxSyncResponse } from '../../../supabase/functions/_shared/contracts';
import { copy } from './copy';
import { ago, date, dateTime } from './format';
import { DataState, Panel, Refreshing, Rows, useLoad } from './parts';

/** FR-ADM-3: status sinkronisasi kurs terakhir + sinkron manual (fx-sync dengan token admin). */
export function FxSection() {
  const f = copy.fx;
  const load = useLoad(adminFxStatus, []);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);

  const sync = async () => {
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
  };

  return (
    <DataState load={load} loadingLabel={f.loading} errorTitle={f.error} skeleton={<Skeleton height={220} radius={radius.lg} />}>
      {(s) => {
        const last = s.runs[0];
        return (
          <View style={styles.gap}>
            <Panel right={<Refreshing on={load.loading} />}>
              <View style={styles.facts}>
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
                <AppText variant="body">
                  {`${f.latest}: ${s.latest_rate_date ? f.latestValue(date(`${s.latest_rate_date}T12:00:00`), s.codes) : f.none}`}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {f.source}
                </AppText>
              </View>
              {notice && (
                <AppText variant="body" tone={notice.tone} accessibilityRole="alert">
                  {notice.text}
                </AppText>
              )}
              <View style={styles.actions}>
                <Button label={busy ? f.syncing : f.sync} icon={RefreshCw} loading={busy} disabled={busy} onPress={() => void sync()} />
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
                          {[f.trigger[r.trigger], r.rate_date ? f.latestValue(date(`${r.rate_date}T12:00:00`), r.codes ?? 0) : null, r.error].filter(Boolean).join(' · ')}
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

/** FR-ADM-3: notifikasi in-app ke segmen pengguna (atau satu email untuk uji). */
export function BroadcastSection() {
  const b = copy.broadcast;
  const [segment, setSegment] = useState<BroadcastSegment>('email');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    setCount(null);
    setCountError(false);
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

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const n = await adminBroadcast(segment, title.trim(), message.trim(), email.trim());
      setNotice({ tone: 'positive', text: b.sent(n) });
      setTitle('');
      setMessage('');
      setTouched(false);
    } catch {
      setNotice({ tone: 'negative', text: b.failed });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <Panel>
      <AppText variant="body" tone="secondary">
        {b.intro}
      </AppText>
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
      <Input label={b.title} value={title} onChangeText={setTitle} placeholder={b.titlePlaceholder} maxLength={80} error={touched ? titleError : undefined} />
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
      <AppText variant="caption" tone={countError ? 'negative' : 'secondary'} accessibilityLiveRegion="polite">
        {countError ? b.countFailed : count === null ? b.counting : b.recipients(count)}
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
          disabled={busy || count === 0}
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
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  facts: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
