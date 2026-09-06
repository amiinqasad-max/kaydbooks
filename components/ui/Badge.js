import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

const buildVariants = (colors) => ({
  accent: { background: colors.ACCENT_SOFT, text: colors.ACCENT },
  success: { background: 'rgba(76, 175, 80, 0.16)', text: colors.SUCCESS },
  error: { background: colors.ERROR_LIGHT, text: colors.ERROR },
  neutral: { background: colors.SURFACE_SECONDARY, text: colors.TEXT_SECONDARY },
});

/**
 * Badge -- small status label (e.g. "Downloaded", "New", "Premium").
 * Chip -- same visual, used for filter/category selection (adds a
 * pressable + selected state). Kept in one file since they're the same
 * shape, per Phase 2 #30 ("do not create duplicate versions").
 */
export const Badge = ({ label, variant = 'accent', style }) => {
  const { colors } = useTheme();
  const variantColors = buildVariants(colors)[variant] || buildVariants(colors).accent;
  return (
    <View style={[styles.badge, { backgroundColor: variantColors.background }, style]}>
      <Text style={[styles.label, { color: variantColors.text }]}>{label}</Text>
    </View>
  );
};

export const Chip = ({ label, selected = false, onPress, style }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.ACCENT, borderColor: colors.ACCENT }
          : { backgroundColor: 'transparent', borderColor: colors.BORDER },
        style,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.BUTTON_TEXT : colors.TEXT_SECONDARY }, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

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
  chipLabel: {
    ...TYPOGRAPHY.bodySmall,
  },
  chipLabelSelected: {
    fontWeight: '700',
  },
});
