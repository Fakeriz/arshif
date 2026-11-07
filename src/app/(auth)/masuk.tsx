import { useRouter } from 'expo-router';
import { FileText, Mail, Mic, Receipt, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, Icon, Input } from '@/components/ui';
import { AuthTheme } from '@/features/auth/AuthTheme';
import { authErrorKey } from '@/features/auth/errors';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

const Email = z.string().trim().toLowerCase().email().max(254);

/** Tiga cara mencatat yang disebut di tagline: struk, suara, rekening koran PDF. */
const METHODS: LucideIcon[] = [Receipt, Mic, FileText];

export default function MasukRoute() {
  return (
    <AuthTheme>
      <MasukScreen />
    </AuthTheme>
  );
}

/** Masuk atau daftar dengan email + kode 6 digit (FR-AUTH-1, Fase 2: tanpa Google dulu). */
function MasukScreen() {
  const t = useT();
  const { colors } = useTheme();
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
    <Screen centered>
      <View style={styles.head}>
        <View style={styles.methods} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {METHODS.map((glyph, i) => (
            <View key={i} style={[styles.method, { backgroundColor: colors.surfaceSunken }]}>
              <Icon icon={glyph} color={colors.textSecondary} />
            </View>
          ))}
        </View>
        <AppText variant="display" accessibilityRole="header">
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
      <Button label={t('auth.signIn.pricing')} variant="ghost" fullWidth onPress={() => router.push('/harga')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm, paddingHorizontal: space.xs, marginBottom: space.lg },
  methods: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  method: { width: space.x4, height: space.x4, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  form: { gap: space.lg },
});
