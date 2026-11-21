import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound, Lock, MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, EmptyState, Icon, Input, OtpInput, useToast } from '@/components/ui';
import { authErrorKey } from '@/features/auth/errors';
import { NewPassword } from '@/features/auth/password';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const RESEND_SECONDS = 60;

/**
 * Verifikasi kode 6 digit dari email. Sukses → sesi aktif, gerbang rute pindah otomatis.
 * type=signup: kode pendaftaran (daftar dengan kata sandi). type=recovery: lupa kata sandi, kode + kata sandi baru sekaligus.
 */
export default function VerifikasiScreen() {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const { email = '', type } = useLocalSearchParams<{ email?: string; type?: string }>();
  // Daftar dengan kata sandi saat konfirmasi email aktif: kodenya kode pendaftaran, bukan kode masuk.
  const signup = type === 'signup';
  const recovery = type === 'recovery';
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState<MsgKey | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MsgKey | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const submitted = useRef('');

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const verify = async (token: string) => {
    if (!/^\d{6}$/.test(token)) {
      setError('auth.verify.errorLength');
      return;
    }
    if (recovery && !NewPassword.safeParse(password).success) {
      setPwError('auth.signIn.errorPasswordRule');
      return;
    }
    if (busy || submitted.current === token) return;
    submitted.current = token;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: recovery ? 'recovery' : signup ? 'signup' : 'email' });
    // Sukses: tombol tetap memuat sampai gerbang rute pindah, supaya tidak sempat aktif lagi.
    if (err) {
      setBusy(false);
      submitted.current = '';
      setError(authErrorKey(err, 'verify'));
      return;
    }
    if (!recovery) return;
    // Kode benar = sesi aktif. Gerbang rute bisa memindahkan layar sebelum ini selesai, jadi hasilnya lewat toast global.
    const { error: upd } = await supabase.auth.updateUser({ password });
    show(upd ? { tone: 'error', title: t('auth.verify.resetFailed') } : { tone: 'success', title: t('auth.verify.resetDone') });
  };

  const onChange = (v: string) => {
    // Tempel atau autofill bisa membawa spasi/teks lain: ambil 6 angka pertama.
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    // Pemulihan butuh kata sandi baru juga: kirim lewat tombol, bukan otomatis.
    if (digits.length === 6 && !recovery) void verify(digits);
  };

  const resend = async () => {
    setBusy(true);
    const { error: err } = recovery
      ? await supabase.auth.resetPasswordForEmail(email)
      : signup
        ? await supabase.auth.resend({ type: 'signup', email })
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) {
      setError(authErrorKey(err, 'signIn') === 'auth.signIn.errorRate' ? 'auth.verify.errorRate' : 'auth.verify.errorNetwork');
      return;
    }
    setWait(RESEND_SECONDS);
    setCode('');
    show({ tone: 'success', title: t('auth.verify.resent') });
  };

  const changeEmail = () => (router.canGoBack() ? router.back() : router.replace('/masuk'));

  if (!email) {
    return (
      <Screen>
        <EmptyState kind="error" title={t('auth.verify.title')} message={t('auth.verify.missingEmail')} actionLabel={t('auth.verify.changeEmail')} onAction={changeEmail} />
      </Screen>
    );
  }

  return (
    <Screen centered>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.surfaceSunken }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon icon={recovery ? KeyRound : MailCheck} color={colors.textSecondary} />
        </View>
        <AppText variant="h1" accessibilityRole="header">
          {recovery ? t('auth.verify.resetTitle') : t('auth.verify.title')}
        </AppText>
        <AppText variant="body" tone="secondary">
          {recovery ? t('auth.verify.resetLead', { email }) : t('auth.verify.lead', { email })}
        </AppText>
      </View>
      <Card>
        <View style={styles.form}>
          <OtpInput
            label={t('auth.verify.codeLabel')}
            value={code}
            onChangeText={onChange}
            autoFocus
            onSubmitEditing={() => void verify(code)}
            error={error ? t(error) : undefined}
            disabled={busy}
          />
          {recovery && (
            <Input
              label={t('auth.verify.newPassword')}
              icon={Lock}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (pwError) setPwError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => void verify(code)}
              error={pwError ? t(pwError) : undefined}
              hint={pwError ? undefined : t('auth.signIn.passwordHint')}
              disabled={busy}
            />
          )}
          <Button
            label={recovery ? t('auth.verify.resetSubmit') : t('auth.verify.submit')}
            onPress={() => void verify(code)}
            loading={busy}
            disabled={busy || code.length !== 6 || (recovery && password === '')}
            fullWidth
          />
        </View>
      </Card>
      <View style={styles.secondary}>
        <Button
          label={wait > 0 ? t('auth.verify.resendIn', { seconds: wait }) : t('auth.verify.resend')}
          variant="secondary"
          onPress={resend}
          disabled={busy || wait > 0}
          fullWidth
        />
        <Button label={t('auth.verify.changeEmail')} variant="ghost" onPress={changeEmail} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, paddingHorizontal: space.xs, marginBottom: space.lg },
  badge: { width: space.x4, height: space.x4, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  form: { gap: space.lg },
  secondary: { gap: space.sm },
});
