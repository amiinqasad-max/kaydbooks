import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';
import { PrimaryButton } from './PrimaryButton';

/**
 * EmptyState -- Phase 2 shared component (#6, #18).
 *
 * Audit finding: ModernExploreScreen, DownloadsLibraryScreen and
 * EnhancedLibraryScreen each hand-rolled their own near-identical empty
 * state (icon + title + subtitle, each with its own copy of the same
 * StyleSheet). This is the one component all three -- and any screen
 * added later -- should render instead.
 */
const EmptyState = ({
  icon = 'book-outline',
  title,
  message,
  actionLabel,
  onActionPress,
  style,
}) => (
  <View style={[styles.container, style]}>
    <MaterialCommunityIcons name={icon} size={56} color={COLORS.TEXT_MUTED} />
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {actionLabel ? (
      <PrimaryButton label={actionLabel} onPress={onActionPress} style={styles.action} />
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.XXL,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginTop: SPACING.MD,
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    marginTop: SPACING.XS,
  },
  action: {
    marginTop: SPACING.LG,
    minWidth: 180,
  },
});

export default EmptyState;
