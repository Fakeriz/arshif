import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, Input } from '@/components/ui';
import { authErrorKey } from '@/features/auth/errors';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/theme/tokens';

const Email = z.string().trim().toLowerCase().email().max(254);

/** Masuk atau daftar dengan email + kode 6 digit (FR-AUTH-1, Fase 2: tanpa Google dulu). */
export default function MasukScreen() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<MsgKey | null>(null);

  const submit = async () => {
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      setError('auth.signIn.errorInvalid');
      return;
    }
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: true } });
    setSending(false);
    if (err) {
      setError(authErrorKey(err, 'signIn'));
      return;
    }
    router.push({ pathname: '/verifikasi', params: { email: parsed.data } });
  };

  return (
    <Screen>
      <View style={styles.head}>
        <AppText variant="h1" accessibilityRole="header">
          Arshif
        </AppText>
        <AppText variant="body" tone="secondary">
          {t('auth.signIn.lead')}
        </AppText>
      </View>
      <Card>
        <View style={styles.form}>
          <AppText variant="h3">{t('auth.signIn.title')}</AppText>
          <Input
            label={t('auth.signIn.emailLabel')}
            icon={Mail}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            inputMode="email"
            returnKeyType="send"
            onSubmitEditing={submit}
            error={error ? t(error) : undefined}
            hint={error ? undefined : t('auth.signIn.emailHint')}
            disabled={sending}
          />
          <Button label={t('auth.signIn.submit')} onPress={submit} loading={sending} disabled={sending || email.trim() === ''} fullWidth />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, marginTop: space.x4 },
  form: { gap: space.lg },
});
