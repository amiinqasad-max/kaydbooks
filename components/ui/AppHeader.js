import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';
import IconButton from './IconButton';

/**
 * AppHeader -- Phase 2 shared component (#6, #7).
 * A consistent screen-title header with optional back button and up to
 * two trailing actions (search/avatar/etc.), so screens stop hand-rolling
 * their own header row with per-screen font sizes and spacing.
 */
const AppHeader = ({ title, onBack, right, style }) => (
  <View style={[styles.container, style]}>
    <View style={styles.side}>
      {onBack ? (
        <IconButton
          icon={<MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.TEXT} />}
          onPress={onBack}
          accessibilityLabel="Go back"
        />
      ) : null}
    </View>
    <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
    <View style={[styles.side, styles.sideRight]}>{right}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.SM,
    height: 56,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.XS,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT,
    flex: 1,
    textAlign: 'center',
  },
});

export default AppHeader;
