import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * PrimaryButton / SecondaryButton -- Phase 2 shared components (#6, #20).
 * Consistent press feedback (activeOpacity), a real loading state (spinner
 * replaces label, button stays the same size so layout doesn't jump), and
 * a disabled state that's visually obvious, not just non-functional.
 */
export const PrimaryButton = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.primary, { backgroundColor: colors.BUTTON }, (disabled || loading) && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.BUTTON_TEXT} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: colors.BUTTON_TEXT }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const SecondaryButton = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  style,
  testID,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.secondary, { borderColor: colors.ACCENT }, (disabled || loading) && styles.disabled, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      accessibilityLabel={label}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.ACCENT} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: colors.ACCENT }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const baseButton = {
  minHeight: 48, // real touch target (Phase 2 #21)
  borderRadius: BORDER_RADIUS.MD,
  paddingHorizontal: SPACING.LG,
  alignItems: 'center',
  justifyContent: 'center',
};

const styles = StyleSheet.create({
  primary: {
    ...baseButton,
  },
  secondary: {
    ...baseButton,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  label: {
    ...TYPOGRAPHY.button,
  },
});
