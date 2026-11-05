import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Skeleton } from '@/components/ui';
import { receiptUrl } from '@/data/remote/api';
import { useT } from '@/i18n';
import { radius, space } from '@/theme/tokens';

/** Foto struk dari bucket privat lewat signed URL 10 menit (PRD Bab 9, FR-TRX-3). */
export function ReceiptPhoto({ path, merchant }: { path: string; merchant: string }) {
  const t = useT();
  const [state, setState] = useState<{ url: string | null; failed: boolean }>({ url: null, failed: false });

  useEffect(() => {
    let alive = true;
    setState({ url: null, failed: false });
    receiptUrl(path)
      .then((url) => alive && setState({ url, failed: false }))
      .catch(() => alive && setState({ url: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <Card>
      <AppText variant="h3">{t('capture.receipt.title')}</AppText>
      <View style={styles.frame}>
        {state.failed ? (
          <AppText variant="caption" tone="muted" accessibilityRole="alert">
            {t('capture.receipt.failed')}
          </AppText>
        ) : state.url ? (
          <Image
            source={{ uri: state.url }}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={t('capture.receipt.a11y', { merchant })}
            onError={() => setState({ url: null, failed: true })}
          />
        ) : (
          <View accessibilityLabel={t('capture.receipt.loading')} style={styles.image}>
            <Skeleton width="100%" height={280} radius={radius.md} />
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  frame: { marginTop: space.md },
  image: { width: '100%', height: 280, borderRadius: radius.md },
});
