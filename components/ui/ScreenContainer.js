import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * ScreenContainer -- Phase 2 shared component (#6).
 *
 * A single, consistent full-screen wrapper: correct safe-area handling
 * (top/bottom, or neither when a screen already renders its own header/
 * tab bar chrome that owns that edge) and the app's background color, so
 * screens stop each redeclaring `{ flex: 1, backgroundColor: COLORS.BACKGROUND }`
 * inline with slightly different edge cases.
 */
const ScreenContainer = ({
  children,
  edges = ['top', 'bottom'],
  backgroundColor,
  style,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const resolvedBackground = backgroundColor || colors.BACKGROUND;
  const paddingTop = edges.includes('top') ? 0 : insets.top;
  const paddingBottom = edges.includes('bottom') ? 0 : insets.bottom;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: resolvedBackground, paddingTop, paddingBottom }, style]}
    >
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
});

export default ScreenContainer;
