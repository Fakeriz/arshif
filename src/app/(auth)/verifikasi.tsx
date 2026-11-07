import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound, MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, EmptyState, Icon, Input, useToast } from '@/components/ui';
import { AuthTheme } from '@/features/auth/AuthTheme';
import { authErrorKey } from '@/features/auth/errors';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const RESEND_SECONDS = 60;

export default function VerifikasiRoute() {
  return (
    <AuthTheme>
      <VerifikasiScreen />
    </AuthTheme>
  );
}

/** Verifikasi kode 6 digit dari email. Sukses → sesi aktif, gerbang rute pindah otomatis. */
function VerifikasiScreen() {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const { show } = useToast();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
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
    if (busy || submitted.current === token) return;
    submitted.current = token;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    // Sukses: tombol tetap memuat sampai gerbang rute pindah, supaya tidak sempat aktif lagi.
    if (err) {
      setBusy(false);
      submitted.current = '';
      setError(authErrorKey(err, 'verify'));
    }
  };

  const onChange = (v: string) => {
    // Tempel atau autofill bisa membawa spasi/teks lain: ambil 6 angka pertama.
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === 6) void verify(digits);
  };

  const resend = async () => {
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
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
          <Icon icon={MailCheck} color={colors.textSecondary} />
        </View>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.verify.title')}
        </AppText>
        <AppText variant="body" tone="secondary">
          {t('auth.verify.lead', { email })}
        </AppText>
      </View>
      <Card>
        <View style={styles.form}>
          <Input
            label={t('auth.verify.codeLabel')}
            icon={KeyRound}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={Platform.OS === 'web' ? 32 : 6}
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void verify(code)}
            error={error ? t(error) : undefined}
            disabled={busy}
          />
          <Button label={t('auth.verify.submit')} onPress={() => void verify(code)} loading={busy} disabled={busy || code.length !== 6} fullWidth />
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
