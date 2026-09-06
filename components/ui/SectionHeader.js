import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TYPOGRAPHY, SPACING } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * SectionHeader -- Phase 2 shared component (#6).
 * A consistent "Section Title" + optional "See all" row, used for Home's
 * Continue Reading / Recommended / Popular / New Releases rows and any
 * other horizontally-scrolling section.
 */
const SectionHeader = ({ title, actionLabel, onActionPress, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.title, { color: colors.TEXT }]} accessibilityRole="header">{title}</Text>
      {actionLabel ? (
        <TouchableOpacity
          onPress={onActionPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.action, { color: colors.ACCENT }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

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
  },
  action: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
});

export default SectionHeader;
