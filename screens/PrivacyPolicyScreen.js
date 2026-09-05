import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { Text } from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const PrivacyPolicyScreen = ({ navigation }) => {
  const handleOpenPrivacyPolicy = async () => {
    try {
      const url = 'https://kaydbooks.com/wp/kayd-books-privacy-policy/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open privacy policy link');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open privacy policy link');
    }
  };

  return (
    <View style={styles.container}>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <MaterialCommunityIcons 
            name="shield-check" 
            size={64} 
            color={COLORS.BUTTON} 
            style={styles.icon}
          />
          
          <Text style={styles.title}>Privacy Policy & Terms of Service</Text>
          
          <Text style={styles.description}>
            Your privacy is important to us. Please review our comprehensive privacy policy 
            and terms of service to understand how we collect, use, and protect your data.
          </Text>
          
          <View style={styles.highlights}>
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.SUCCESS} />
              <Text style={styles.highlightText}>Data encryption and security</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.SUCCESS} />
              <Text style={styles.highlightText}>No data sharing with third parties</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.SUCCESS} />
              <Text style={styles.highlightText}>Account deletion available anytime</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.SUCCESS} />
              <Text style={styles.highlightText}>Transparent subscription terms</Text>
            </View>
          </View>
          
          <Button
            mode="contained"
            style={styles.button}
            onPress={handleOpenPrivacyPolicy}
            icon="open-in-new"
          >
            View Full Privacy Policy & Terms
          </Button>
          
          <Text style={styles.footer}>
            By using Kayd Books, you agree to our Privacy Policy and Terms of Service.
            Last updated: November 2025
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: SPACING.LG,
    flexGrow: 1,
  },
  section: {
    alignItems: 'center',
    paddingVertical: SPACING.XL,
  },
  icon: {
    marginBottom: SPACING.LG,
  },
  title: {
    fontSize: FONTS.SIZES.TITLE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  description: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.XL,
  },
  highlights: {
    width: '100%',
    marginBottom: SPACING.XL,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
  },
  highlightText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT,
    marginLeft: SPACING.SM,
    flex: 1,
  },
  button: {
    backgroundColor: COLORS.BUTTON,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.XL,
    marginBottom: SPACING.XL,
  },
  footer: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default PrivacyPolicyScreen;
