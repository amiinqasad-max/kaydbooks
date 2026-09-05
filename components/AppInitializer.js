import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import {
  initializeAppSubscriptions,
  getTrialStatus,
  hasPremiumAccess,
  expireTrial,
} from '../services/premiumSubscriptionService';
import { COLORS, FONTS, SPACING } from '../constants/theme';

/**
 * AppInitializer Component
 * Handles custom 7-day trial logic and subscription initialization
 * This component runs when the app starts and user is authenticated
 */

const AppInitializer = ({ children, onInitialized }) => {
  const { user } = useAuth();
  const [initializing, setInitializing] = useState(true);
  const [initializationStatus, setInitializationStatus] = useState('Initializing app...');

  useEffect(() => {
    if (user) {
      initializeApp();
    }
  }, [user]);

  const initializeApp = async () => {
    try {
      
      // Step 1: Initialize subscription system
      setInitializationStatus('Setting up subscriptions...');
      const initResult = await initializeAppSubscriptions(user.id);
      
      if (initResult.trialStarted) {
        setInitializationStatus('Trial activated!');
        
        // Show welcome message for new trial users
        setTimeout(() => {
          Alert.alert(
            '🎉 Welcome to Kayd Books!',
            'Your 7-day free trial has started! Enjoy unlimited access to all premium features.',
            [{ text: 'Start Reading', style: 'default' }]
          );
        }, 1000);
      }
      
      // Step 2: Check current subscription status
      setInitializationStatus('Checking subscription status...');
      const premiumStatus = await hasPremiumAccess(user.id);
      
      if (premiumStatus.hasAccess) {
        
        // If trial, check if it's about to expire
        if (premiumStatus.source === 'trial' && premiumStatus.daysRemaining <= 1) {
          Alert.alert(
            '⏰ Trial Ending Soon',
            `Your free trial expires in ${premiumStatus.daysRemaining} day${premiumStatus.daysRemaining !== 1 ? 's' : ''}. Subscribe now to continue enjoying premium features!`,
            [
              { text: 'Subscribe Now', onPress: () => navigateToSubscription() },
              { text: 'Later', style: 'cancel' }
            ]
          );
        }
      } else {
        // Step 3: Check if trial has expired
        const trialStatus = await getTrialStatus(user.id);
        
        if (trialStatus.hasStarted && trialStatus.expired) {
          await expireTrial(user.id);
          
          // Show trial expired message
          setTimeout(() => {
            Alert.alert(
              '⏰ Trial Expired',
              'Your 7-day free trial has ended. Subscribe now to continue accessing premium features!',
              [
                { text: 'Subscribe Now', onPress: () => navigateToSubscription() },
                { text: 'Continue with Free', style: 'cancel' }
              ]
            );
          }, 1000);
        }
      }
      
      // Step 4: Complete initialization
      setInitializationStatus('Ready!');
      
      // Small delay to show completion status
      setTimeout(() => {
        setInitializing(false);
        onInitialized?.({
          premiumStatus,
          trialStarted: initResult.trialStarted
        });
      }, 500);
      
    } catch (error) {
      
      // Continue with app even if initialization fails
      setInitializationStatus('Initialization failed, continuing...');
      setTimeout(() => {
        setInitializing(false);
        onInitialized?.({ error: error.message });
      }, 1000);
    }
  };

  const navigateToSubscription = () => {
    // This will be handled by the parent component
    onInitialized?.({ 
      showSubscription: true,
      reason: 'trial_expired'
    });
  };

  if (!initializing) {
    return children;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>📚</Text>
          </View>
          <Text style={styles.appName}>Kayd Books</Text>
        </View>
        
        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.BUTTON} />
          <Text style={styles.statusText}>{initializationStatus}</Text>
        </View>
        
        {/* Premium Features Preview */}
        <View style={styles.featuresPreview}>
          <Text style={styles.previewTitle}>Premium Features</Text>
          <View style={styles.featuresList}>
            <FeatureItem icon="📖" text="Unlimited Books" />
            <FeatureItem icon="🎧" text="Premium Audiobooks" />
            <FeatureItem icon="📱" text="Offline Reading" />
            <FeatureItem icon="🚫" text="No Advertisements" />
          </View>
        </View>
      </View>
    </View>
  );
};

const FeatureItem = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.XL,
    width: '100%',
    maxWidth: 400,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XXL,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.BUTTON,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  logoText: {
    fontSize: 40,
  },
  appName: {
    fontSize: FONTS.SIZES.HEADER,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: SPACING.XXL,
  },
  statusText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.MD,
    textAlign: 'center',
  },
  featuresPreview: {
    width: '100%',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 16,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  previewTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  featuresList: {
    gap: SPACING.SM,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.XS,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: SPACING.MD,
    width: 30,
    textAlign: 'center',
  },
  featureText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    flex: 1,
  },
});

export default AppInitializer;
