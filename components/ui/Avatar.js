import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

/**
 * Avatar -- Phase 2 shared component (#6).
 * Shows the user's real photo if one exists; otherwise a deterministic
 * initial on a neutral surface -- never a stock placeholder photo (Phase
 * 2 #24: real data only, no fabricated content).
 */
const Avatar = ({ uri, name = '', size = 40, style }) => {
  const initial = (name || '').trim().charAt(0).toUpperCase() || '?';
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={[dimensionStyle, style]} />;
  }

  return (
    <View style={[styles.fallback, dimensionStyle, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: COLORS.SURFACE_ELEVATED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: COLORS.ACCENT,
    fontWeight: '700',
  },
});

export default Avatar;
