import { FileText, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, EmptyState, Icon, Input, PressableScale } from '@/components/ui';
import { sampleStatement } from '@/data/seed';
import { ProcessingView } from '@/features/capture/ProcessingView';
import { AccountPicker } from '@/features/transactions/pickers';
import { useDemoState } from '@/state/demo';
import { useLedger } from '@/state/derived';
import { useLimits } from '@/state/limits';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

type Phase = 'form' | 'processing' | 'failed';

export default function ImportScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const demo = useDemoState();
  const limits = useLimits();
  const paywall = usePaywall();
  const { accounts } = useLedger();
  const [phase, setPhase] = useState<Phase>(demo === 'loading' ? 'processing' : 'form');
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [picked, setPicked] = useState(false);
  const [password, setPassword] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (limits.importPdf) {
    return (
      <Screen>
        <ScreenHeader title="Import rekening koran" />
        <EmptyState kind="limit" title="Kuota import bulan ini habis" message="Paket Free mendapat 1 import PDF per bulan. Reset tanggal 1, atau upgrade untuk 10 import per bulan." actionLabel="Lihat Premium" onAction={() => paywall('Import PDF Free (1/bulan) sudah terpakai.')} />
      </Screen>
    );
  }

  const read = () => {
    setPhase('processing');
    if (demo === 'loading') return;
    timer.current = setTimeout(() => {
      if (demo === 'error') setPhase('failed');
      else router.replace({ pathname: '/import-review', params: { akun: accountId ?? '' } });
    }, 1600);
  };

  return (
    <Screen>
      <ScreenHeader title="Import rekening koran" />
      {phase === 'processing' ? (
        <View style={styles.center}>
          <ProcessingView title="Membaca rekening koran" message="AI membaca semua baris transaksi dan mencocokkannya dengan catatanmu. Kalau gagal, kuota tidak terpotong." />
        </View>
      ) : phase === 'failed' ? (
        <EmptyState kind="error" title="Berkas tidak bisa dibaca" message="Kuota import tidak terpotong. Pastikan PDF dari bank (bukan foto), tidak lebih dari 30 halaman, dan kata sandinya benar." actionLabel="Pilih ulang berkas" onAction={() => setPhase('form')} />
      ) : (
        <View style={styles.form}>
          <AccountPicker label="Masuk ke akun" accounts={accounts} value={accountId} onChange={setAccountId} />
          {picked ? (
            <Card>
              <View style={styles.file}>
                <View style={[styles.fileIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon icon={FileText} color={colors.accentText} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {sampleStatement.fileName}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {sampleStatement.sizeLabel}
                  </AppText>
                </View>
                <PressableScale accessibilityLabel="Hapus berkas" onPress={() => setPicked(false)} focusRadius={radius.full} style={styles.remove}>
                  <Icon icon={X} color={colors.textSecondary} />
                </PressableScale>
              </View>
            </Card>
          ) : (
            <Button label="Pilih berkas PDF" icon={FileText} variant="secondary" fullWidth onPress={() => setPicked(true)} />
          )}
          <Input label="Kata sandi PDF (kalau ada)" value={password} onChangeText={setPassword} secureTextEntry hint="Sebagian bank mengunci rekening koran dengan kata sandi." />
          <AppText variant="caption" tone="muted">
            Maksimal 15 MB atau 30 halaman. Berkas dihapus dari server 30 hari setelah import. Pemilihan berkas sungguhan aktif di Fase 2, di sini memakai berkas contoh.
          </AppText>
          <Button label="Baca rekening koran" fullWidth disabled={!picked || !accountId} onPress={read} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: space.x3 },
  form: { gap: space.xl },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  fileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
