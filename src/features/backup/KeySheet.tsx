import { KeyRound, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Card, Input, useToast } from '@/components/ui';
import { formatRecoveryKey, newBackupKey, parseRecoveryKey } from '@/lib/backup/crypto';
import { useT } from '@/i18n';
import { fonts, space } from '@/theme/tokens';

/**
 * setup = cadangan pertama: kunci baru ditampilkan, pengguna menyimpannya lalu membuktikan dengan 4 karakter terakhir
 *         (atau memakai kunci lama). show = lihat kunci tersimpan. enter = buka cadangan.
 */
type Props = {
  visible: boolean;
  mode: 'setup' | 'show' | 'enter';
  /** show: kunci yang ditampilkan. */
  current?: Uint8Array | null;
  subtitle?: string;
  error?: string;
  onClose: () => void;
  onDone?: (key: Uint8Array) => void;
};

export function KeySheet({ visible, mode, current, subtitle, error, onClose, onDone }: Props) {
  const t = useT();
  const { show } = useToast();
  const [fresh] = useState(newBackupKey);
  const [existing, setExisting] = useState(mode === 'enter');
  const [typed, setTyped] = useState('');
  const [tried, setTried] = useState(false);
  const shown = mode === 'show' ? current : fresh;
  const text = shown ? formatRecoveryKey(shown) : '';
  const tail = text.replace(/-/g, '').slice(-4);

  const saveKey = async () => {
    // Web: salin ke clipboard; Android/iOS: lembar bagikan (pengelola kata sandi, Catatan, dll).
    if (Platform.OS === 'web') {
      await navigator.clipboard?.writeText(text).then(() => show({ tone: 'success', title: t('settings.backup.keyCopied') }), () => undefined);
      return;
    }
    await Share.share({ message: text }).catch(() => undefined);
  };

  const parsed = parseRecoveryKey(typed);
  const submitExisting = () => {
    setTried(true);
    if (parsed) onDone?.(parsed);
  };
  const confirmNew = () => {
    setTried(true);
    if (typed.trim().toUpperCase() === tail) onDone?.(fresh);
  };

  const title = mode === 'enter' ? t('settings.backup.restoreKeyTitle') : mode === 'show' ? t('settings.backup.keyGroup') : t('settings.backup.keyTitle');
  return (
    <BottomSheet scrollable visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={styles.body}>
        {existing ? (
          <>
            <Input
              label={t('settings.backup.keyInput')}
              hint={t('settings.backup.keyInputHint')}
              icon={KeyRound}
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              error={error ?? (tried && !parsed ? t('settings.backup.keyInvalid') : undefined)}
            />
            <Button label={t('settings.backup.keyNext')} fullWidth onPress={submitExisting} />
            {mode === 'setup' && <Button label={t('settings.backup.keyNew')} variant="ghost" fullWidth onPress={() => (setExisting(false), setTyped(''), setTried(false))} />}
          </>
        ) : (
          <>
            <AppText variant="body" tone="secondary">
              {t('settings.backup.keyWarn')}
            </AppText>
            {/* Kunci dipisah per 4 karakter dan bisa dipilih manual (tanpa dependensi clipboard native). */}
            <Card padding="md">
              <AppText variant="h3" selectable style={styles.key} accessibilityLabel={text.split('').join(' ')}>
                {text}
              </AppText>
            </Card>
            <Button label={t('settings.backup.keyShare')} icon={Share2} variant="secondary" fullWidth onPress={() => void saveKey()} />
            {mode === 'setup' && (
              <>
                <Input
                  label={t('settings.backup.keyConfirm')}
                  value={typed}
                  onChangeText={setTyped}
                  maxLength={4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  error={tried && typed.trim().toUpperCase() !== tail ? t('settings.backup.keyConfirmError') : undefined}
                />
                <Button label={t('settings.backup.keyDone')} fullWidth onPress={confirmNew} />
                <Button label={t('settings.backup.keyUseExisting')} variant="ghost" fullWidth onPress={() => (setExisting(true), setTyped(''), setTried(false))} />
              </>
            )}
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  key: { fontFamily: fonts.semibold, letterSpacing: 1, lineHeight: 26 },
});
