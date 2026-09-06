import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../constants/theme';

/**
 * SearchInput -- Phase 2 shared component (#6, #9).
 * One consistent search field (icon, placeholder, clear button) for
 * Discover/search and any other screen that needs it, instead of each
 * screen wiring its own TextInput + icon layout.
 */
const SearchInput = ({
  value,
  onChangeText,
  placeholder = 'Search books, authors...',
  onSubmitEditing,
  style,
  autoFocus = false,
}) => (
  <View style={[styles.container, style]}>
    <MaterialCommunityIcons name="magnify" size={20} color={COLORS.TEXT_MUTED} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.TEXT_MUTED}
      style={styles.input}
      onSubmitEditing={onSubmitEditing}
      returnKeyType="search"
      autoFocus={autoFocus}
      accessibilityLabel={placeholder}
    />
    {value ? (
      <TouchableOpacity
        onPress={() => onChangeText('')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Clear search"
      >
        <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: SPACING.SM,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT,
    height: '100%',
  },
});

export default SearchInput;
