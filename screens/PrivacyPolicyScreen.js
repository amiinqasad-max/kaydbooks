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
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
            color={colors.BUTTON} 
            style={styles.icon}
          />
          
          <Text style={styles.title}>Privacy Policy & Terms of Service</Text>
          
          <Text style={styles.description}>
            Your privacy is important to us. Please review our comprehensive privacy policy 
            and terms of service to understand how we collect, use, and protect your data.
          </Text>
          
          <View style={styles.highlights}>
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.SUCCESS} />
              <Text style={styles.highlightText}>Data encryption and security</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.SUCCESS} />
              <Text style={styles.highlightText}>No data sharing with third parties</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.SUCCESS} />
              <Text style={styles.highlightText}>Account deletion available anytime</Text>
            </View>
            
            <View style={styles.highlight}>
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.SUCCESS} />
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

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND,
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
    ...TYPOGRAPHY.h1,
    color: colors.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: colors.TEXT_SECONDARY,
    textAlign: 'center',
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
    ...TYPOGRAPHY.body,
    color: colors.TEXT,
    marginLeft: SPACING.SM,
    flex: 1,
  },
  button: {
    backgroundColor: colors.BUTTON,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.XL,
    marginBottom: SPACING.XL,
  },
  footer: {
    ...TYPOGRAPHY.caption,
    color: colors.TEXT_SECONDARY,
    textAlign: 'center',
  },
});

export default PrivacyPolicyScreen;
