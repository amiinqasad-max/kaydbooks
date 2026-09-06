import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';

/**
 * SectionHeader -- Phase 2 shared component (#6).
 * A consistent "Section Title" + optional "See all" row, used for Home's
 * Continue Reading / Recommended / Popular / New Releases rows and any
 * other horizontally-scrolling section.
 */
const SectionHeader = ({ title, actionLabel, onActionPress, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.title} accessibilityRole="header">{title}</Text>
    {actionLabel ? (
      <TouchableOpacity
        onPress={onActionPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.action}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT,
  },
  action: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.ACCENT,
    fontWeight: '600',
  },
});

export default SectionHeader;
