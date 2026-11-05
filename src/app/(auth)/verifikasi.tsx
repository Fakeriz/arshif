import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/shell/Screen';
import { ScreenHeader } from '@/components/shell/ScreenHeader';
import { AppText, Button, Card, EmptyState, Input, useToast } from '@/components/ui';
import { authErrorKey } from '@/features/auth/errors';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

const RESEND_SECONDS = 60;

/** Verifikasi kode 6 digit dari email. Sukses → sesi aktif, gerbang rute pindah otomatis. */
export default function VerifikasiScreen() {
  const t = useT();
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
    setBusy(false);
    if (err) {
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
    <Screen>
      <ScreenHeader title={t('auth.verify.title')} />
      <AppText variant="body" tone="secondary">
        {t('auth.verify.lead', { email })}
      </AppText>
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
          <Button
            label={wait > 0 ? t('auth.verify.resendIn', { seconds: wait }) : t('auth.verify.resend')}
            variant="secondary"
            onPress={resend}
            disabled={busy || wait > 0}
            fullWidth
          />
          <Button label={t('auth.verify.changeEmail')} variant="ghost" onPress={changeEmail} fullWidth />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
});
