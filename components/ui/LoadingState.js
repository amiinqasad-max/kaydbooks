import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { TYPOGRAPHY, SPACING } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * LoadingState -- Phase 2 shared component (#6, #17).
 * A full-screen loading state for the (rare, initial-auth-check style)
 * cases where there's genuinely no content shape to skeleton yet. Prefer
 * SkeletonLoader's BookCardSkeleton/ShelfSkeleton for list content --
 * this is for a full screen with nothing to show the shape of.
 */
const LoadingState = ({ label, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.ACCENT} />
      {label ? <Text style={[styles.label, { color: colors.TEXT_MUTED }]}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.SM,
  },
});

export default LoadingState;
