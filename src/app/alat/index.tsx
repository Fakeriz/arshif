import { useRouter, type Href } from 'expo-router';
import { ArrowLeftRight, Calculator, ChartColumn, FileDown, Percent, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { usePaywall } from '@/components/shell/Paywall';
import { AppText, Card, Icon, ListItem, ProBadge } from '@/components/ui';
import { SectionLabel } from '@/features/planning/kit';
import { TaxDisclaimer, ToolScreen } from '@/features/tools/kit';
import { useT } from '@/i18n';
import { isLimited } from '@/lib/quota';
import { useStore } from '@/state/AppStore';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

type Entry = { key: string; icon: LucideIcon; title: string; subtitle: string; href: Href; locked: boolean; reason?: string };

/**
 * Money & Tax Tools (FR-TAX). Gratis: konverter + kalkulator cicilan. Premium: estimasi pajak, laporan pajak
 * tahunan, PDF Export. Entri Premium di paket Free memakai badge PRO dan membuka sheet paywall.
 */
export default function ToolsHub() {
  const t = useT();
  const router = useRouter();
  const paywall = usePaywall();
  const { state } = useStore();
  const taxLocked = isLimited(state.plan, 'taxFull', 0);
  const pdfLocked = isLimited(state.plan, 'pdfExport', 0);

  const basic: Entry[] = [
    { key: 'fx', icon: ArrowLeftRight, title: t('tools.hub.fx'), subtitle: t('tools.hub.fxSub'), href: '/alat/kurs', locked: false },
    { key: 'loan', icon: Calculator, title: t('tools.hub.loan'), subtitle: t('tools.hub.loanSub'), href: '/alat/cicilan', locked: false },
  ];
  const full: Entry[] = [
    { key: 'tax', icon: Percent, title: t('tools.hub.tax'), subtitle: t('tools.hub.taxSub'), href: '/alat/pajak', locked: taxLocked, reason: t('tools.tax.reason') },
    { key: 'report', icon: ChartColumn, title: t('tools.hub.report'), subtitle: t('tools.hub.reportSub'), href: '/alat/laporan', locked: taxLocked, reason: t('tools.report.reason') },
    { key: 'export', icon: FileDown, title: t('tools.hub.export'), subtitle: t('tools.hub.exportSub'), href: '/alat/ekspor', locked: pdfLocked, reason: t('tools.export.reason') },
  ];

  return (
    <ToolScreen title={t('tools.hub.title')}>
      <AppText variant="body" tone="secondary">
        {t('tools.hub.intro')}
      </AppText>
      <Group entries={basic} onOpen={(e) => router.push(e.href)} />
      <SectionLabel>{t('tools.hub.fullSection')}</SectionLabel>
      <Group entries={full} onOpen={(e) => (e.locked ? paywall(e.reason ?? '') : router.push(e.href))} />
      <TaxDisclaimer />
    </ToolScreen>
  );
}

function Group({ entries, onOpen }: { entries: Entry[]; onOpen: (e: Entry) => void }) {
  const { colors } = useTheme();
  return (
    <Card padding="md">
      {entries.map((e, i) => (
        <ListItem
          key={e.key}
          leading={
            <View style={[styles.icon, { backgroundColor: e.locked ? colors.track : colors.accentSoft }]}>
              <Icon icon={e.icon} color={e.locked ? colors.textSecondary : colors.accentText} />
            </View>
          }
          title={e.title}
          subtitle={e.subtitle}
          subtitleLines={2}
          trailing={e.locked ? <ProBadge size="sm" /> : undefined}
          chevron={!e.locked}
          divider={i < entries.length - 1}
          onPress={() => onOpen(e)}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
