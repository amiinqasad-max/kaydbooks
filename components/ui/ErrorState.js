import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TYPOGRAPHY, SPACING } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { PrimaryButton } from './PrimaryButton';

/**
 * ErrorState -- Phase 2 shared component (#6, #19).
 *
 * Audit finding: most screens' catch blocks either only console.error'd
 * (leaving the UI stuck on a spinner or a blank list with no explanation)
 * or used Alert.alert('Error', 'Failed to load downloads') -- functional,
 * but a raw Alert interrupts the screen rather than presenting a normal,
 * recoverable in-place state. This component is for the second case:
 * an inline, human-readable error with a Retry action, for screens whose
 * main content failed to load at all (not for one-off action failures,
 * which can stay as an Alert/toast).
 *
 * `message` must already be a human-readable string -- see
 * utils/errorMessages.js (added this phase) for turning a raw
 * Supabase/PostgREST error into one. Never pass a raw error.message here.
 */
const ErrorState = ({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.ERROR} />
      <Text style={[styles.title, { color: colors.TEXT }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.TEXT_MUTED }]}>{message}</Text>
      {onRetry ? (
        <PrimaryButton label={retryLabel} onPress={onRetry} style={styles.action} />
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
    minWidth: 160,
  },
});

export default ErrorState;
