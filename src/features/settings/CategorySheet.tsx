import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomSheet, Button, Chip, Dialog, IconGrid, Input } from '@/components/ui';
import { CATEGORY_ICON_NAMES, categoryIcon, newCategoryKey, type Bucket, type CustomCategory, type TxKind } from '@/constants/categories';
import { categoryLabel, useT } from '@/i18n';
import { space } from '@/theme/tokens';

const BUCKETS: Bucket[] = ['needs', 'wants', 'savings'];
// Nama ikon lucide ("ShoppingCart") jadi label pembaca layar ("Shopping Cart").
const iconLabel = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, '$1 $2');

type Props = {
  visible: boolean;
  /** null = kategori baru untuk `type`. */
  editing: CustomCategory | null;
  type: TxKind;
  /** Nama yang sudah dipakai kategori lain (huruf kecil), untuk cegah nama ganda. */
  taken: string[];
  onClose: () => void;
  onSave: (c: CustomCategory) => void;
  onDelete: (c: CustomCategory) => void;
};

/** Buat/ubah kategori sendiri: nama, bucket anggaran (pengeluaran), ikon dari grid yang digeser. */
export function CategorySheet({ visible, editing, type, taken, onClose, onSave, onDelete }: Props) {
  const t = useT();
  const kind = editing?.type ?? type;
  const [name, setName] = useState(editing?.name ?? '');
  const [bucket, setBucket] = useState<Bucket>(editing?.bucket ?? 'wants');
  const [icon, setIcon] = useState<string>(editing?.icon ?? 'Ellipsis');
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const trimmed = name.trim();
  const nameError = !trimmed ? t('settings.categories.nameError') : taken.includes(trimmed.toLowerCase()) ? t('settings.categories.nameTaken') : undefined;

  const save = () => {
    setTried(true);
    if (nameError) return;
    onSave({ key: editing?.key ?? newCategoryKey(), name: trimmed, icon, type: kind, bucket: kind === 'income' ? null : bucket });
  };

  return (
    <BottomSheet scrollable visible={visible} onClose={onClose} title={editing ? t('settings.categories.editTitle') : t('settings.categories.newTitle')} subtitle={t(`common.${kind}`)}>
      <View style={styles.body}>
        <Input label={t('settings.categories.name')} value={name} onChangeText={setName} maxLength={24} error={tried ? nameError : undefined} autoFocus={!editing} returnKeyType="done" />
        {kind === 'expense' && (
          <View style={styles.field} accessibilityRole="radiogroup" accessibilityLabel={t('settings.categories.bucket')}>
            <AppText variant="caption" tone="secondary">
              {t('settings.categories.bucket')}
            </AppText>
            <View style={styles.chips}>
              {BUCKETS.map((b) => (
                <Chip key={b} label={t(`domain.bucket.${b}`)} selected={bucket === b} onPress={() => setBucket(b)} />
              ))}
            </View>
          </View>
        )}
        <View style={styles.field}>
          <AppText variant="caption" tone="secondary">
            {t('settings.categories.icon')}
          </AppText>
          <IconGrid items={CATEGORY_ICON_NAMES.map((n) => ({ key: n, icon: categoryIcon(n), label: iconLabel(n) }))} value={icon} onChange={setIcon} accessibilityLabel={t('settings.categories.icon')} />
        </View>
        <Button label={t('settings.categories.save')} fullWidth onPress={save} />
        {editing && <Button label={t('settings.categories.delete')} variant="danger" fullWidth onPress={() => setConfirm(true)} />}
      </View>
      {editing && (
        <Dialog
          visible={confirm}
          tone="danger"
          title={t('settings.categories.deleteTitle', { name: categoryLabel(t, editing.key) })}
          message={t('settings.categories.deleteMessage')}
          confirmLabel={t('settings.categories.delete')}
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            onDelete(editing);
          }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  field: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
