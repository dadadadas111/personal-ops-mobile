import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from './theme';

export function ScreenContainer({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function SectionCard({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={palette.textMuted} style={[styles.input, props.multiline && styles.inputMultiline]} {...props} />;
}

export function Button({ title, onPress, tone = 'primary' }: { title: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, toneStyles[tone], pressed && { opacity: 0.85 }]}>
      <Text style={tone === 'secondary' ? styles.buttonTextSecondary : styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  return <Text style={[styles.badge, badgeTones[tone]]}>{label}</Text>;
}

export function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = palette.primary }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <Text style={styles.empty}>{message}</Text>;
}

const toneStyles = StyleSheet.create({
  primary: { backgroundColor: palette.primary, borderColor: palette.primary },
  secondary: { backgroundColor: palette.surface, borderColor: palette.border },
  danger: { backgroundColor: palette.danger, borderColor: palette.danger },
});

const badgeTones = StyleSheet.create({
  default: { backgroundColor: palette.surfaceMuted, color: palette.text },
  success: { backgroundColor: '#DCFCE7', color: palette.success },
  warning: { backgroundColor: '#FEF3C7', color: palette.warning },
  danger: { backgroundColor: '#FEE2E2', color: palette.danger },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: 16, gap: 16 },
  card: { backgroundColor: palette.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: palette.border, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: palette.text },
  cardSubtitle: { fontSize: 13, color: palette.textMuted, marginTop: -4 },
  label: { fontSize: 13, fontWeight: '600', color: palette.textMuted },
  input: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: palette.text },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  buttonTextSecondary: { color: palette.text, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: palette.textMuted, fontSize: 14 },
  statValue: { color: palette.text, fontSize: 15, fontWeight: '700' },
  progressTrack: { height: 10, backgroundColor: palette.surfaceMuted, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  empty: { color: palette.textMuted, fontStyle: 'italic' },
});
