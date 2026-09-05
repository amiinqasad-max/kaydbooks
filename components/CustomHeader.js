import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const CustomHeader = ({
  leftComponent,
  centerComponent,
  rightComponent,
  backgroundColor = COLORS.BACKGROUND,
  borderBottomColor = COLORS.BORDER,
  style,
}) => {
  const renderComponent = (component, defaultStyle) => {
    if (!component) return <View style={defaultStyle} />;
    
    if (component.icon) {
      return (
        <TouchableOpacity 
          style={[styles.headerButton, defaultStyle]}
          onPress={component.onPress}
        >
          <MaterialCommunityIcons 
            name={component.icon} 
            size={24} 
            color={component.color || COLORS.TEXT} 
          />
        </TouchableOpacity>
      );
    }
    
    if (component.text) {
      return (
        <Text style={[styles.headerTitle, component.style, defaultStyle]}>
          {component.text}
        </Text>
      );
    }
    
    if (component.component) {
      return <View style={defaultStyle}>{component.component}</View>;
    }
    
    return <View style={defaultStyle} />;
  };

  return (
    <View style={[
      styles.header, 
      { backgroundColor, borderBottomColor },
      style
    ]}>
      {renderComponent(leftComponent, styles.leftComponent)}
      {renderComponent(centerComponent, styles.centerComponent)}
      {renderComponent(rightComponent, styles.rightComponent)}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  headerButton: {
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  leftComponent: {
    flex: 0,
    alignItems: 'flex-start',
    minWidth: 40,
  },
  centerComponent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightComponent: {
    flex: 0,
    alignItems: 'flex-end',
    minWidth: 40,
  },
});

export default CustomHeader;
