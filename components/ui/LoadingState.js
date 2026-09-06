import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';

/**
 * LoadingState -- Phase 2 shared component (#6, #17).
 * A full-screen loading state for the (rare, initial-auth-check style)
 * cases where there's genuinely no content shape to skeleton yet. Prefer
 * SkeletonLoader's BookCardSkeleton/ShelfSkeleton for list content --
 * this is for a full screen with nothing to show the shape of.
 */
const LoadingState = ({ label, style }) => (
  <View style={[styles.container, style]}>
    <ActivityIndicator size="large" color={COLORS.ACCENT} />
    {label ? <Text style={styles.label}>{label}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_MUTED,
    marginTop: SPACING.SM,
  },
});

export default LoadingState;
