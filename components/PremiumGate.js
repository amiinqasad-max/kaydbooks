import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text } from 'react-native';
import { Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { hasPremiumAccess } from '../services/premiumSubscriptionService';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

/**
 * PremiumGate Component
 * Wraps premium features and shows upgrade prompt for non-premium users
 * 
 * Usage:
 * <PremiumGate feature="unlimited_books" navigation={navigation}>
 *   <YourPremiumComponent />
 * </PremiumGate>
 */

const PremiumGate = ({ 
  children, 
  feature, 
  navigation, 
  fallbackComponent = null,
  showUpgradePrompt = true,
  customMessage = null 
}) => {
  const { user } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [premiumStatus, setPremiumStatus] = useState(null);

  // PHASE 1.7: moved above the useEffect that calls it. A plain `function`
  // declaration is hoisted in JS regardless of order, but ESLint's
  // react-hooks/immutability rule (React Compiler-oriented) flags a
  // function used before its *textual* position in the component
  // regardless of hoisting -- satisfying it means literal reordering, not
  // just switching declaration styles.
  async function checkPremiumAccess() {
    try {
      setLoading(true);
      const status = await hasPremiumAccess(user.id);
      setHasAccess(status.hasAccess);
      setPremiumStatus(status);
    } catch (error) {
      console.error('Error checking premium access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    checkPremiumAccess();
  }, [user]);

  const handleUpgrade = () => {
    if (navigation) {
      navigation.navigate('PremiumSubscription', { fromFeature: feature });
    } else {
      Alert.alert(
        'Premium Feature',
        'This feature requires a premium subscription. Please upgrade to access it.',
        [{ text: 'OK' }]
      );
    }
  };

  const getFeatureInfo = (featureName) => {
    const features = {
      unlimited_books: {
        icon: 'book-multiple',
        title: 'Unlimited Books',
        description: 'Access our entire library of premium books'
      },
      offline_reading: {
        icon: 'download',
        title: 'Offline Reading',
        description: 'Download books to read without internet'
      },
      premium_audiobooks: {
        icon: 'headphones',
        title: 'Premium Audiobooks',
        description: 'Listen to our exclusive audiobook collection'
      },
      no_advertisements: {
        icon: 'block-helper',
        title: 'Ad-Free Experience',
        description: 'Enjoy reading without any interruptions'
      },
      advanced_search: {
        icon: 'magnify-plus',
        title: 'Advanced Search',
        description: 'Use powerful filters to find exactly what you want'
      },
      priority_support: {
        icon: 'headset',
        title: 'Priority Support',
        description: 'Get faster help from our support team'
      },
      early_access: {
        icon: 'star',
        title: 'Early Access',
        description: 'Be the first to read new book releases'
      }
    };

    return features[featureName] || {
      icon: 'crown',
      title: 'Premium Feature',
      description: 'This feature requires a premium subscription'
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking access...</Text>
      </View>
    );
  }

  // If user has premium access, show the premium content
  if (hasAccess) {
    return children;
  }

  // If fallback component is provided, show it instead of upgrade prompt
  if (fallbackComponent) {
    return fallbackComponent;
  }

  // If upgrade prompt is disabled, show nothing
  if (!showUpgradePrompt) {
    return null;
  }

  // Show upgrade prompt
  const featureInfo = getFeatureInfo(feature);

  return (
    <View style={styles.container}>
      <Card style={styles.upgradeCard}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons 
              name={featureInfo.icon} 
              size={48} 
              color={COLORS.BUTTON} 
            />
          </View>
          
          <Text style={styles.title}>
            {customMessage || featureInfo.title}
          </Text>
          
          <Text style={styles.description}>
            {featureInfo.description}
          </Text>
          
          {/* Trial Status */}
          {premiumStatus?.source === 'trial' && premiumStatus?.daysRemaining > 0 && (
            <View style={styles.trialInfo}>
              <MaterialCommunityIcons name="timer-sand" size={16} color={COLORS.WARNING} />
              <Text style={styles.trialText}>
                Trial: {premiumStatus.daysRemaining} days left
              </Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleUpgrade}
              style={styles.upgradeButton}
              contentStyle={styles.buttonContent}
              icon="crown"
            >
              {premiumStatus?.source === 'trial' ? 'Subscribe Now' : 'Start Free Trial'}
            </Button>
          </View>
          
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Premium Benefits:</Text>
            <View style={styles.benefitsList}>
              <BenefitItem text="7-day free trial" />
              <BenefitItem text="Unlimited book access" />
              <BenefitItem text="Offline reading" />
              <BenefitItem text="No advertisements" />
            </View>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const BenefitItem = ({ text }) => (
  <View style={styles.benefitItem}>
    <MaterialCommunityIcons name="check" size={16} color={COLORS.SUCCESS} />
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  upgradeCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    elevation: 4,
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    maxWidth: 400,
    width: '100%',
  },
  cardContent: {
    alignItems: 'center',
    padding: SPACING.XL,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.BUTTON_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  title: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  description: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  trialInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WARNING + '20',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
    marginBottom: SPACING.LG,
  },
  trialText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.WARNING,
    marginLeft: SPACING.XS,
    fontFamily: FONTS.BOLD,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: SPACING.LG,
  },
  upgradeButton: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
  },
  buttonContent: {
    paddingVertical: SPACING.SM,
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.MD,
  },
  benefitsTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  benefitsList: {
    gap: SPACING.XS,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  benefitText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    flex: 1,
  },
});

export default PremiumGate;
