import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { BORDER_RADIUS } from '../../constants/theme';

/**
 * IconButton -- Phase 2 shared component (#6).
 * Guarantees a >=44x44 hit target around a bare icon (Phase 2 #21
 * accessibility: "icon-only buttons" must still have a real touch target
 * and an accessibility label), regardless of the icon's own visual size.
 */
const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  size = 44,
  backgroundColor = 'transparent',
  style,
  disabled = false,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    style={[
      styles.button,
      { width: size, height: size, borderRadius: BORDER_RADIUS.ROUND, backgroundColor },
      disabled && styles.disabled,
      style,
    ]}
  >
    {icon}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});

export default IconButton;
