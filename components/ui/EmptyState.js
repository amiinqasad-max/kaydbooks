import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TYPOGRAPHY, SPACING } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
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
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name={icon} size={56} color={colors.TEXT_MUTED} />
      <Text style={[styles.title, { color: colors.TEXT }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: colors.TEXT_MUTED }]}>{message}</Text> : null}
      {actionLabel ? (
        <PrimaryButton label={actionLabel} onPress={onActionPress} style={styles.action} />
      ) : null}
    </View>
  );
};

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
    textAlign: 'center',
    marginTop: SPACING.MD,
  },
  message: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
    marginTop: SPACING.XS,
  },
  action: {
    marginTop: SPACING.LG,
    minWidth: 180,
  },
});

export default EmptyState;
