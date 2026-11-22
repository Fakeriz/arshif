import { useRouter } from 'expo-router';
import { FileText, Lock, Mail, Mic, Receipt, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { z } from 'zod';

import { Screen } from '@/components/shell/Screen';
import { AppText, Button, Card, Icon, Input, Tabs } from '@/components/ui';
import { Flag } from '@/components/ui/Flag';
import { authErrorKey } from '@/features/auth/errors';
import { signInWithGoogle } from '@/features/auth/google';
import { NewPassword } from '@/features/auth/password';
import { AuthPrefs } from '@/features/intro/AuthPrefs';
import { useT, type MsgKey } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { easeOut, useEnter } from '@/theme/motion';
import { InkCard, useTheme } from '@/theme/ThemeProvider';
import { fonts, motion, radius, space } from '@/theme/tokens';

const Email = z.string().trim().toLowerCase().email().max(254);

/** Tiga cara mencatat (struk, suara, rekening koran PDF): pembeda produk, jadi tampil di kartu tinta. */
const METHODS: { icon: LucideIcon; key: 'receipt' | 'voice' | 'pdf' }[] = [
  { icon: Receipt, key: 'receipt' },
  { icon: Mic, key: 'voice' },
  { icon: FileText, key: 'pdf' },
];
/** Negara yang mata uangnya didukung penuh (IDR/MYR/TRY); USD ikut di teks. */
const FLAGS = ['ID', 'MY', 'TR'] as const;

function MethodChip({ icon, label, delay }: { icon: LucideIcon; label: string; delay: number }) {
  const { colors } = useTheme();
  const enter = useEnter({ delay, y: 6 });
  return (
    <Animated.View style={[styles.chip, { backgroundColor: colors.track }, enter]}>
      <Icon icon={icon} color={colors.text} size={16} />
      <AppText variant="caption" style={styles.chipLabel}>
        {label}
      </AppText>
    </Animated.View>
  );
}

/**
 * Kartu tinta: satu-satunya titik fokus layar Masuk (motif identitas Arshif: tiap layar punya tepat satu kartu tinta).
 * Isinya fakta produk, bukan klaim: tiga cara mencatat dan mata uang yang didukung.
 */
function Hero() {
  return (
    <InkCard style={styles.hero}>
      <HeroBody />
    </InkCard>
  );
}

/** Di dalam InkCard: useTheme di sini membaca warna tinta (terbalik), bukan warna halaman. */
function HeroBody() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <>
      <AppText style={[styles.heroTitle, { color: colors.text }]} accessibilityRole="header">
        {t('auth.signIn.headline')}
      </AppText>
      <View style={styles.chips}>
        {METHODS.map((m, i) => (
          <MethodChip key={m.key} icon={m.icon} label={t(`auth.signIn.methods.${m.key}`)} delay={160 + i * 50} />
        ))}
      </View>
      <View style={[styles.heroRule, { backgroundColor: colors.track }]} />
      <View style={styles.currencies}>
        <View style={styles.flags} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {FLAGS.map((c, i) => (
            <View key={c} style={[styles.flag, i > 0 && styles.flagOverlap]}>
              <Flag country={c} width={18} />
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="muted" style={styles.flex}>
          {t('auth.signIn.currencies')}
        </AppText>
      </View>
    </>
  );
}

type Mode = 'code' | 'password';

/** Logo "G" Google berwarna resmi (pedoman merek Google Sign-In). */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

/**
 * Masuk atau daftar (FR-AUTH-1): Google, email + kode 6 digit, atau email + kata sandi.
 * Sukses → sesi aktif, gerbang rute di _layout yang memindahkan layar.
 */
export default function MasukScreen() {
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('code');
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<MsgKey | null>(null);
  const busy = sending || googleBusy;

  // Masuk bergiliran sekali saat layar dibuka (spesifikasi "Masuk layar": naik 12px, jeda 50ms): kartu tinta → formulir.
  const headEnter = useEnter({ y: 12 });
  const cardEnter = useEnter({ delay: 100, y: 12 });
  // Kolom kata sandi muncul/hilang: isi di bawahnya bergeser halus, bukan melompat.
  const reflow = reduced ? undefined : LinearTransition.duration(motion.base).easing(easeOut);
  const appear = reduced ? undefined : FadeIn.duration(motion.base).easing(easeOut);
  const vanish = reduced ? undefined : FadeOut.duration(motion.fast);

  const clearError = () => {
    if (error) setError(null);
  };

  const google = async () => {
    setGoogleBusy(true);
    setError(null);
    const res = await signInWithGoogle();
    // ok: gerbang rute pindah; redirect (web): halaman sedang berpindah ke Google.
    if (res === 'cancel' || res === 'error') setGoogleBusy(false);
    if (res === 'error') setError('auth.signIn.errorGoogle');
  };

  const sendCode = async (addr: string) => {
    const { error: err } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setSending(false);
    if (err) return setError(authErrorKey(err, 'signIn'));
    router.push({ pathname: '/verifikasi', params: { email: addr } });
  };

  const withPassword = async (addr: string) => {
    if (signUp) {
      const { data, error: err } = await supabase.auth.signUp({ email: addr, password });
      if (err) {
        setSending(false);
        return setError(authErrorKey(err, 'signIn'));
      }
      // Konfirmasi email aktif di server: belum ada sesi, verifikasi kode pendaftaran dulu.
      if (!data.session) {
        setSending(false);
        router.push({ pathname: '/verifikasi', params: { email: addr, type: 'signup' } });
      }
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: addr, password });
    // Sukses: tombol tetap memuat sampai gerbang rute pindah.
    if (err) {
      setSending(false);
      setError(authErrorKey(err, 'signIn'));
    }
  };

  const submit = async () => {
    const parsed = Email.safeParse(email);
    if (!parsed.success) return setError('auth.signIn.errorInvalid');
    if (mode === 'password' && signUp && !NewPassword.safeParse(password).success) return setError('auth.signIn.errorPasswordRule');
    if (mode === 'password' && password === '') return setError('auth.signIn.errorCredentials');
    setSending(true);
    setError(null);
    await (mode === 'code' ? sendCode(parsed.data) : withPassword(parsed.data));
  };

  // Lupa kata sandi: kode 6 digit ke email, lalu kata sandi baru diatur di layar verifikasi.
  // Server menjawab sukses juga untuk email yang tidak terdaftar, jadi tidak membocorkan siapa yang punya akun.
  const forgot = async () => {
    const parsed = Email.safeParse(email);
    if (!parsed.success) return setError('auth.signIn.errorInvalid');
    setSending(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data);
    setSending(false);
    if (err) return setError(authErrorKey(err, 'signIn'));
    router.push({ pathname: '/verifikasi', params: { email: parsed.data, type: 'recovery' } });
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const submitLabel = mode === 'code' ? t('auth.signIn.submit') : signUp ? t('auth.signIn.submitSignUp') : t('auth.signIn.submitPassword');
  // Error format email tampil di kolom email; error kata sandi/akun di kolom kata sandi.
  const emailError = error && (mode === 'code' || error === 'auth.signIn.errorInvalid') ? t(error) : undefined;
  const passwordError = error && mode === 'password' && error !== 'auth.signIn.errorInvalid' ? t(error) : undefined;

  return (
    <Screen>
      <View style={styles.top}>
        <AppText style={[styles.wordmark, { color: colors.text }]}>Arshif</AppText>
        <AuthPrefs />
      </View>
      <Animated.View style={headEnter}>
        <Hero />
      </Animated.View>
      <Animated.View style={cardEnter}>
        <Card>
          <View style={styles.form}>
            <AppText variant="h3">{t('auth.signIn.title')}</AppText>
            <Button label={t('auth.signIn.google')} variant="secondary" leading={<GoogleMark />} onPress={google} loading={googleBusy} disabled={busy} fullWidth />
            <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
              <AppText variant="caption" tone="muted">
                {t('auth.signIn.or')}
              </AppText>
              <View style={[styles.rule, { backgroundColor: colors.border }]} />
            </View>
            <Tabs
              items={[
                { key: 'code', label: t('auth.signIn.modeCode') },
                { key: 'password', label: t('auth.signIn.modePassword') },
              ]}
              value={mode}
              onChange={switchMode}
              accessibilityLabel={t('auth.signIn.modeLabel')}
            />
            <Input
              label={t('auth.signIn.emailLabel')}
              icon={Mail}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={mode === 'password' ? 'username' : 'emailAddress'}
              inputMode="email"
              returnKeyType={mode === 'code' ? 'send' : 'next'}
              onSubmitEditing={mode === 'code' ? submit : undefined}
              error={emailError}
              hint={mode === 'code' && !error ? t('auth.signIn.emailHint') : undefined}
              // Centang meletup begitu format email benar (Motion Kit "Kolom tervalidasi").
              valid={Email.safeParse(email).success}
              disabled={busy}
            />
            {mode === 'password' && (
              <Animated.View entering={appear} exiting={vanish} layout={reflow}>
                <Input
                  label={t('auth.signIn.passwordLabel')}
                  icon={Lock}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    clearError();
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={signUp ? 'new-password' : 'current-password'}
                  textContentType={signUp ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  error={passwordError}
                  hint={signUp && !error ? t('auth.signIn.passwordHint') : undefined}
                  disabled={busy}
                />
                {!signUp && (
                  <View style={styles.forgot}>
                    <Button label={t('auth.signIn.forgot')} variant="ghost" size="sm" onPress={forgot} disabled={busy} />
                  </View>
                )}
              </Animated.View>
            )}
            <Animated.View layout={reflow} style={styles.actions}>
              <Button label={submitLabel} onPress={submit} loading={sending} disabled={busy || email.trim() === ''} fullWidth />
              {mode === 'password' && (
                <Animated.View entering={appear} exiting={vanish}>
                  <Button
                    label={signUp ? t('auth.signIn.toSignIn') : t('auth.signIn.toSignUp')}
                    variant="ghost"
                    onPress={() => {
                      setSignUp((s) => !s);
                      setError(null);
                    }}
                    disabled={busy}
                    fullWidth
                  />
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  // Wordmark: nama produk sebagai teks (belum ada logo resmi), berat 800 agar terbaca sebagai merek, bukan judul.
  wordmark: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.6 },
  hero: { borderRadius: radius.card, padding: space.xl, gap: space.lg },
  heroTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingVertical: 6, paddingLeft: 10, paddingRight: 12 },
  chipLabel: { fontFamily: fonts.semibold },
  heroRule: { height: StyleSheet.hairlineWidth },
  currencies: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flags: { flexDirection: 'row' },
  flag: { borderRadius: 3, overflow: 'hidden' },
  flagOverlap: { marginLeft: -4 },
  flex: { flex: 1 },
  form: { gap: space.lg },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  actions: { gap: space.xs },
  forgot: { alignItems: 'flex-end', marginTop: space.xs },
});
