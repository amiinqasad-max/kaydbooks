import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * SkeletonLoader -- Phase 2 shared component (#6, #17).
 * A subtle shimmering placeholder shaped like real content, so lists
 * don't show a blank screen or a single centered spinner while loading
 * (Phase 2 #17: "skeletons should visually resemble the content being
 * loaded... do not over-animate"). One shared opacity pulse, not a
 * shimmer-sweep gradient -- cheaper to run and less distracting.
 */
const Pulse = ({ style }) => {
  // One-time Animated.Value init read during render, the standard RN
  // Animated pattern (same reviewed precedent as
  // AudioPlayerContext.js/ProgressBar.js); not React state, and reading
  // it here doesn't affect render output.
  // eslint-disable-next-line react-hooks/refs
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { opacity }, style]} />;
};

/** A single skeleton row shaped like a horizontal book card (cover + two lines). */
export const BookCardSkeleton = () => (
  <View style={styles.bookRow}>
    <Pulse style={styles.cover} />
    <View style={styles.bookInfo}>
      <Pulse style={styles.lineWide} />
      <Pulse style={styles.lineNarrow} />
    </View>
  </View>
);

/** A row of skeleton covers for a horizontal shelf (Continue Reading, Popular, ...). */
export const ShelfSkeleton = ({ count = 4 }) => (
  <View style={styles.shelfRow}>
    {Array.from({ length: count }).map((_, i) => (
      <Pulse key={i} style={styles.shelfCover} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  block: {
    backgroundColor: COLORS.SURFACE_SECONDARY,
    borderRadius: BORDER_RADIUS.SM,
  },
  bookRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    gap: SPACING.MD,
  },
  cover: { width: 64, height: 96, borderRadius: BORDER_RADIUS.SM },
  bookInfo: { flex: 1, justifyContent: 'center', gap: SPACING.SM },
  lineWide: { height: 14, width: '70%', borderRadius: 7 },
  lineNarrow: { height: 12, width: '40%', borderRadius: 6 },
  shelfRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.MD,
    gap: SPACING.MD,
  },
  shelfCover: { width: 110, height: 160, borderRadius: BORDER_RADIUS.MD },
});

export default Pulse;
