import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants/theme';

const VARIANTS = {
  accent: { background: COLORS.ACCENT_SOFT, text: COLORS.ACCENT },
  success: { background: 'rgba(76, 175, 80, 0.16)', text: COLORS.SUCCESS },
  error: { background: COLORS.ERROR_LIGHT, text: COLORS.ERROR },
  neutral: { background: COLORS.SURFACE_SECONDARY, text: COLORS.TEXT_SECONDARY },
};

/**
 * Badge -- small status label (e.g. "Downloaded", "New", "Premium").
 * Chip -- same visual, used for filter/category selection (adds a
 * pressable + selected state). Kept in one file since they're the same
 * shape, per Phase 2 #30 ("do not create duplicate versions").
 */
export const Badge = ({ label, variant = 'accent', style }) => {
  const colors = VARIANTS[variant] || VARIANTS.accent;
  return (
    <View style={[styles.badge, { backgroundColor: colors.background }, style]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

export const Chip = ({ label, selected = false, onPress, style }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={label}
    style={[
      styles.chip,
      selected ? styles.chipSelected : styles.chipUnselected,
      style,
    ]}
    onPress={onPress}
  >
    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.SM,
    alignSelf: 'flex-start',
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  chip: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS + 4,
    borderRadius: BORDER_RADIUS.XL,
    borderWidth: 1,
    marginRight: SPACING.SM,
  },
  chipSelected: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderColor: COLORS.BORDER,
  },
  chipLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_SECONDARY,
  },
  chipLabelSelected: {
    color: COLORS.BUTTON_TEXT,
    fontWeight: '700',
  },
});
