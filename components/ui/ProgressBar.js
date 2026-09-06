import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../../constants/theme';

/**
 * ProgressBar -- Phase 2 shared component (#6, #20).
 * One consistent progress-bar visual for reading %, listening %, and
 * download progress instead of each screen drawing its own `<View>` pair.
 * Animates width changes (Phase 2 #20: "progress animation") but the
 * animation is a plain Animated.timing on a native-driver-incompatible
 * layout property, so `useNativeDriver: false` is correct here, not a bug.
 */
const ProgressBar = ({
  progress = 0, // 0-100
  height = 6,
  trackColor = COLORS.PROGRESS_BACKGROUND,
  fillColor = COLORS.PROGRESS_FILL,
  style,
  accessibilityLabel,
}) => {
  const clamped = Math.max(0, Math.min(100, progress));
  // One-time Animated.Value init read during render is the standard RN
  // Animated pattern (same, already-reviewed precedent as
  // AudioPlayerContext.js's playback position ref); it is not React state
  // and reading it here does not affect render output.
  // eslint-disable-next-line react-hooks/refs
  const widthAnim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: clamped,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [clamped, widthAnim]);

  // Interpolating an Animated.Value is the standard RN Animated pattern;
  // `widthAnim` is not React state, so reading it here doesn't affect
  // render output (same reviewed precedent as AudioPlayerContext.js).
  // eslint-disable-next-line react-hooks/refs
  const animatedWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: fillColor, borderRadius: height / 2, width: animatedWidth },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

export default ProgressBar;
