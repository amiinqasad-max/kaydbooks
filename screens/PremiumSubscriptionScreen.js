import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  BackHandler,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { Text } from 'react-native';
import { 
  Button, 
  Card, 
  Appbar, 
  RadioButton,
  ActivityIndicator,
  Chip,
  Divider,
  ProgressBar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  initializeSubscriptions,
  purchaseSubscription,
  restorePurchases,
  getSubscriptionPlans,
  startCustomTrial,
  getTrialStatus,
  hasPremiumAccess,
  disconnectSubscriptions,
} from '../services/premiumSubscriptionService';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS, COMMON_STYLES } from '../constants/theme';

const PremiumSubscriptionScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [trialStatus, setTrialStatus] = useState(null);
  const [premiumStatus, setPremiumStatus] = useState(null);
  const [canGoBack, setCanGoBack] = useState(true); // Always allow back navigation
  
  // New state for subscription options modal
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedSubscriptionType, setSelectedSubscriptionType] = useState('');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState({ type: '', text: '' });
  
  // State for local payment instructions modal
  const [showLocalPaymentModal, setShowLocalPaymentModal] = useState(false);

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function initializeScreen() {
    try {
      setInitLoading(true);
      
      // Check current premium status
      const premium = await hasPremiumAccess(user.id);
      setPremiumStatus(premium);
      
      // If user has premium access and came from profile, allow going back
      if (premium.hasAccess && route.params?.fromProfile) {
        setCanGoBack(true);
      }
      
      // Get trial status
      const trial = await getTrialStatus(user.id);
      setTrialStatus(trial);
      
      // Load subscription plans
      const subscriptionPlans = getSubscriptionPlans();
      setPlans(subscriptionPlans);
      
      // Initialize store products
      const storeInit = await initializeSubscriptions();
      if (storeInit.success) {
        setAvailableProducts(storeInit.products);
        
        // Update plans with real store prices
        const updatedPlans = subscriptionPlans.map(plan => {
          if (!plan.isCustomTrial) {
            const storeProduct = storeInit.products.find(p => p.productId === plan.productId);
            if (storeProduct) {
              return {
                ...plan,
                price: storeProduct.priceString,
                storeTitle: storeProduct.title,
                storeDescription: storeProduct.description,
                mockMode: storeInit.mockMode
              };
            }
          }
          return plan;
        });
        setPlans(updatedPlans);
        
        // Development notice removed - no popup shown
      }
      
    } catch (error) {
      Alert.alert('Error', 'Failed to load subscription information');
    } finally {
      setInitLoading(false);
    }
  }

  useEffect(() => {
    initializeScreen();
    
    // Prevent back button on Android if user must subscribe
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return !canGoBack;
    });

    return () => {
      backHandler.remove();
      disconnectSubscriptions();
    };
  }, []);


  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
  };

  const handleStartTrial = async () => {
    try {
      setLoading(true);
      
      const result = await startCustomTrial(user.id);
      
      if (result.success) {
        Alert.alert(
          '🎉 Trial Started!',
          `Your 7-day free trial is now active! You have ${result.daysRemaining} days of premium access.`,
          [
            {
              text: 'Start Reading',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error starting trial:', error);
      Alert.alert('Error', 'Failed to start trial. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseSubscription = async () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan || !plan.productId) {
      Alert.alert('Error', 'Invalid subscription plan');
      return;
    }

    try {
      setLoading(true);
      
      const result = await purchaseSubscription(user.id, plan.productId);
      
      if (result.success) {
        Alert.alert(
          '🎉 Subscription Activated!',
          `Your ${plan.name} subscription is now active! Enjoy unlimited access to all premium features.`,
          [
            {
              text: 'Start Reading',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      } else if (result.cancelled) {
        // User cancelled, do nothing
      } else {
        Alert.alert('Purchase Failed', result.error || 'Failed to complete purchase');
      }
    } catch (error) {
      console.error('Error purchasing subscription:', error);
      Alert.alert('Purchase Failed', 'An error occurred during purchase');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setLoading(true);
      
      const result = await restorePurchases(user.id);
      
      if (result.success && result.restored) {
        Alert.alert(
          '✅ Purchases Restored!',
          'Your previous subscription has been restored.',
          [
            {
              text: 'Continue',
              onPress: () => navigation.replace('MainTabs'),
            },
          ]
        );
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Restore Failed', 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  // New handlers for subscription modal
  const handleSubscribePress = () => {
    if (!selectedPlan) {
      Alert.alert('Error', 'Please select a subscription plan first');
      return;
    }
    setShowSubscriptionModal(true);
    setSubscriptionMessage({ type: '', text: '' }); // Clear any previous messages
  };

  const handleSubscriptionTypeSelect = (type) => {
    setSelectedSubscriptionType(type);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedSubscriptionType) {
      setSubscriptionMessage({ type: 'error', text: 'Please select a subscription method' });
      return;
    }

    try {
      setSubscriptionLoading(true);
      setSubscriptionMessage({ type: '', text: '' });

      if (selectedSubscriptionType === 'local') {
        // ** INTEGRATION POINT: Local/Custom Subscription **
        // Replace this with your Supabase/backend API call for local subscription
        // Example: const result = await createLocalSubscription(user.id, selectedPlan);
        
        // Close subscription modal and show local payment instructions
        setShowSubscriptionModal(false);
        setShowLocalPaymentModal(true);
        setSubscriptionMessage({ type: 'success', text: 'Opening payment instructions...' });
        
      } else if (selectedSubscriptionType === 'inapp') {
        // ** INTEGRATION POINT: In-App Purchase **
        // This calls the existing in-app purchase logic
        const plan = plans.find(p => p.id === selectedPlan);
        if (!plan) {
          throw new Error('Plan not found');
        }

        const result = await purchaseSubscription(user.id, plan.productId);
        
        if (result.success) {
          setShowSubscriptionModal(false);
          setSubscriptionMessage({ type: 'success', text: 'Subscription activated successfully!' });
          
          Alert.alert(
            '🎉 Subscription Activated!',
            `Your ${plan.name} subscription is now active! Enjoy unlimited access to all premium features.`,
            [
              {
                text: 'Start Reading',
                onPress: () => navigation.replace('MainTabs'),
              },
            ]
          );
        } else if (result.cancelled) {
          // User cancelled, do nothing
        } else {
          throw new Error(result.error || 'Purchase failed');
        }
      }
    } catch (error) {
      console.error('Error processing subscription:', error);
      setSubscriptionMessage({ 
        type: 'error', 
        text: error.message || 'Failed to process subscription. Please try again.' 
      });
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleCloseSubscriptionModal = () => {
    setShowSubscriptionModal(false);
    setSelectedSubscriptionType('');
    setSubscriptionMessage({ type: '', text: '' });
  };

  const handleOpenWhatsApp = async () => {
    const phoneNumber = '+16148528515'; // WhatsApp number
    const selectedPlanData = plans.find(p => p.id === selectedPlan);
    const message = `Hi! I would like to subscribe to the ${selectedPlanData?.name || 'Premium Plan'} (${selectedPlanData?.price || 'N/A'}) for Kayd Books app. Please provide payment instructions.`;
    
    const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    const whatsappWebUrl = `https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`;
    
    try {
      // Try to open WhatsApp app first
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to WhatsApp Web
        await Linking.openURL(whatsappWebUrl);
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert(
        'Error',
        'Could not open WhatsApp. Please contact us directly at +1 (614) 852-8515',
        [{ text: 'OK' }]
      );
    }
  };

  const handleCloseLocalPaymentModal = () => {
    setShowLocalPaymentModal(false);
  };

  const renderTrialStatus = () => {
    if (!trialStatus || !trialStatus.hasStarted) return null;

    return (
      <Card style={styles.trialStatusCard}>
        <Card.Content>
          <View style={styles.trialStatusHeader}>
            <MaterialCommunityIcons name="timer-sand" size={24} color={COLORS.BUTTON} />
            <Text style={styles.trialStatusTitle}>
              {trialStatus.isActive ? 'Trial Active' : 'Trial Expired'}
            </Text>
          </View>
          
          {trialStatus.isActive ? (
            <>
              <Text style={styles.trialStatusText}>
                {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} remaining
              </Text>
              <ProgressBar 
                progress={(7 - trialStatus.daysRemaining) / 7} 
                color={COLORS.BUTTON}
                style={styles.trialProgress}
              />
            </>
          ) : (
            <Text style={styles.trialExpiredText}>
              Your trial has expired. Subscribe to continue enjoying premium features.
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPlanCard = (plan) => {
    const isSelected = selectedPlan === plan.id;
    const isDisabled = false; // No plans are disabled now

    return (
      <TouchableOpacity
        key={plan.id}
        onPress={() => !isDisabled && handlePlanSelect(plan.id)}
        style={[
          styles.planCard,
          isSelected && styles.selectedPlanCard,
          plan.popular && styles.popularPlanCard,
          isDisabled && styles.disabledPlanCard,
        ]}
        disabled={isDisabled}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </View>
        )}
        
        <View style={styles.planHeader}>
          <RadioButton
            value={plan.id}
            status={isSelected ? 'checked' : 'unchecked'}
            onPress={() => !isDisabled && handlePlanSelect(plan.id)}
            color={COLORS.BUTTON}
            disabled={isDisabled}
          />
          <View style={styles.planInfo}>
            <Text style={[styles.planName, isDisabled && styles.disabledText]}>
              {plan.name}
            </Text>
            <Text style={[styles.planDescription, isDisabled && styles.disabledText]}>
              {plan.description}
            </Text>
            
            <View style={styles.priceContainer}>
              <Text style={[styles.planPrice, isDisabled && styles.disabledText]}>
                {plan.price}
              </Text>
              <Text style={[styles.planDuration, isDisabled && styles.disabledText]}>
                {plan.duration}
              </Text>
            </View>
            
            {plan.savings && (
              <View style={styles.savingsContainer}>
                <Text style={styles.originalPrice}>{plan.originalPrice}</Text>
                <Chip style={styles.savingsChip} textStyle={styles.savingsText}>
                  {plan.savings}
                </Chip>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.featuresContainer}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <MaterialCommunityIcons 
                name="check" 
                size={16} 
                color={isDisabled ? COLORS.TEXT_SECONDARY : COLORS.SUCCESS} 
              />
              <Text style={[styles.featureText, isDisabled && styles.disabledText]}>
                {feature}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  const renderActionButton = () => {
    // If no plan is selected, show select plan message
    if (!selectedPlan) {
      return (
        <Button
          mode="contained"
          disabled={true}
          style={styles.disabledButton}
          contentStyle={styles.buttonContent}
        >
          Select a Plan
        </Button>
      );
    }

    // If a paid plan is selected, always show Subscribe Now button
    const selectedPlanData = plans.find(p => p.id === selectedPlan);
    if (selectedPlanData && !selectedPlanData.isCustomTrial) {
      return (
        <Button
          mode="contained"
          onPress={handleSubscribePress}
          loading={loading}
          disabled={loading}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
        >
          Subscribe Now
        </Button>
      );
    }

    // Show trial button only if user doesn't have premium access and hasn't started trial
    // AND no paid plan is selected
    if (!premiumStatus?.hasAccess && (!trialStatus?.hasStarted || trialStatus?.expired)) {
      return (
        <Button
          mode="contained"
          onPress={handleStartTrial}
          loading={loading}
          disabled={loading}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
        >
          Start Free Trial
        </Button>
      );
    }

    // Default fallback
    return (
      <Button
        mode="contained"
        onPress={handleSubscribePress}
        loading={loading}
        disabled={loading}
        style={styles.primaryButton}
        contentStyle={styles.buttonContent}
      >
        Subscribe Now
      </Button>
    );
  };

  if (initLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.BUTTON} />
        <Text style={styles.loadingText}>Loading subscription options...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: COLORS.BACKGROUND }}>
        {canGoBack && (
          <Appbar.BackAction onPress={() => navigation.goBack()} />
        )}
        <Appbar.Content title="Premium Access" titleStyle={COMMON_STYLES.headerTitle} />
        <Appbar.Action 
          icon="restore" 
          onPress={handleRestorePurchases}
          disabled={loading}
        />
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="crown" size={64} color={COLORS.BUTTON} />
          <Text style={styles.headerTitle}>Unlock Premium Features</Text>
          <Text style={styles.headerSubtitle}>
            Get unlimited access to thousands of books, audiobooks, and premium features
          </Text>
        </View>

        {/* Trial Status */}
        {renderTrialStatus()}

        {/* Premium Status */}
        {premiumStatus?.hasAccess && (
          <Card style={styles.premiumStatusCard}>
            <Card.Content>
              <View style={styles.premiumStatusHeader}>
                <MaterialCommunityIcons name="crown" size={24} color={COLORS.SUCCESS} />
                <Text style={styles.premiumStatusTitle}>Premium Active</Text>
              </View>
              <Text style={styles.premiumStatusText}>
                Source: {premiumStatus.source === 'trial' ? 'Free Trial' : 'Subscription'}
                {premiumStatus.endDate && ` • Expires: ${new Date(premiumStatus.endDate).toLocaleDateString()}`}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Plans */}
        <View style={styles.plansContainer}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>
          {plans.map(renderPlanCard)}
        </View>

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {renderActionButton()}
        </View>

        {/* Terms */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsTitle}>Terms & Conditions</Text>
          <Text style={styles.termsText}>
            • Free trial is available once per user and automatically starts on first app use
          </Text>
          <Text style={styles.termsText}>
            • Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period
          </Text>
          <Text style={styles.termsText}>
            • Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account at confirmation of purchase
          </Text>
          <Text style={styles.termsText}>
            • You can manage and cancel subscriptions in your account settings
          </Text>
          <Text style={styles.termsText}>
            • Pricing may vary by region and is subject to change
          </Text>
        </View>
      </ScrollView>

      {/* Subscription Options Modal */}
      <Modal
        visible={showSubscriptionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseSubscriptionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.subscriptionModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Subscription Method</Text>
              <TouchableOpacity
                onPress={handleCloseSubscriptionModal}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.TEXT} />
              </TouchableOpacity>
            </View>
            
            <Divider style={styles.modalDivider} />
            
            {/* Selected Plan Info */}
            {selectedPlan && (
              <View style={styles.selectedPlanInfo}>
                <Text style={styles.selectedPlanTitle}>Selected Plan</Text>
                <Text style={styles.selectedPlanName}>
                  {plans.find(p => p.id === selectedPlan)?.name} - {plans.find(p => p.id === selectedPlan)?.price}
                </Text>
              </View>
            )}
            
            {/* Subscription Options */}
            <View style={styles.subscriptionOptions}>
              {/* Local Subscription Option */}
              <TouchableOpacity
                style={[
                  styles.subscriptionOption,
                  selectedSubscriptionType === 'local' && styles.selectedOption
                ]}
                onPress={() => handleSubscriptionTypeSelect('local')}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.optionIconContainer}>
                    <MaterialCommunityIcons name="bank" size={32} color={COLORS.BUTTON} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionTitle}>Local Subscription</Text>
                    <Text style={styles.optionDescription}>
                      Pay using local payment methods like e-birr, Waafi, or bank transfer
                    </Text>
                  </View>
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioButton,
                      selectedSubscriptionType === 'local' && styles.radioButtonSelected
                    ]}>
                      {selectedSubscriptionType === 'local' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.optionFeatures}>
                  <Text style={styles.modalFeatureText}>• Direct bank transfer or mobile money</Text>
                  <Text style={styles.modalFeatureText}>• Manual verification process</Text>
                  <Text style={styles.modalFeatureText}>• Local currency support</Text>
                </View>
              </TouchableOpacity>

              {/* In-App Purchase Option */}
              <TouchableOpacity
                style={[
                  styles.subscriptionOption,
                  selectedSubscriptionType === 'inapp' && styles.selectedOption
                ]}
                onPress={() => handleSubscriptionTypeSelect('inapp')}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.optionIconContainer}>
                    <MaterialCommunityIcons 
                      name={Platform.OS === 'ios' ? 'apple' : 'google-play'} 
                      size={32} 
                      color={COLORS.BUTTON} 
                    />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionTitle}>In-App Purchase</Text>
                    <Text style={styles.optionDescription}>
                      Pay securely through {Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play Store'}
                    </Text>
                  </View>
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioButton,
                      selectedSubscriptionType === 'inapp' && styles.radioButtonSelected
                    ]}>
                      {selectedSubscriptionType === 'inapp' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.optionFeatures}>
                  <Text style={styles.modalFeatureText}>• Secure payment processing</Text>
                  <Text style={styles.modalFeatureText}>• Automatic subscription management</Text>
                  <Text style={styles.modalFeatureText}>• Instant activation</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Error/Success Message */}
            {subscriptionMessage.text ? (
              <View style={[
                styles.modalMessageContainer,
                subscriptionMessage.type === 'error' ? styles.errorMessage : styles.successMessage
              ]}>
                <MaterialCommunityIcons 
                  name={subscriptionMessage.type === 'error' ? 'alert-circle' : 'check-circle'} 
                  size={20} 
                  color={subscriptionMessage.type === 'error' ? COLORS.ERROR : COLORS.SUCCESS} 
                />
                <Text style={[
                  styles.modalMessageText,
                  { color: subscriptionMessage.type === 'error' ? COLORS.ERROR : COLORS.SUCCESS }
                ]}>
                  {subscriptionMessage.text}
                </Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={handleCloseSubscriptionModal}
                disabled={subscriptionLoading}
                style={styles.cancelButton}
                contentStyle={styles.buttonContent}
              >
                Cancel
              </Button>
              
              <Button
                mode="contained"
                onPress={handleConfirmSubscription}
                loading={subscriptionLoading}
                disabled={subscriptionLoading || !selectedSubscriptionType}
                style={[styles.confirmButton, !selectedSubscriptionType && styles.disabledButton]}
                contentStyle={styles.buttonContent}
              >
                Continue
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Local Payment Instructions Modal */}
      <Modal
        visible={showLocalPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseLocalPaymentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.localPaymentModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Local Payment Instructions</Text>
              <TouchableOpacity
                onPress={handleCloseLocalPaymentModal}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.TEXT} />
              </TouchableOpacity>
            </View>
            
            <Divider style={styles.modalDivider} />
            
            {/* Selected Plan Info */}
            {selectedPlan && (
              <View style={styles.selectedPlanInfo}>
                <Text style={styles.selectedPlanTitle}>Selected Plan</Text>
                <Text style={styles.selectedPlanName}>
                  {plans.find(p => p.id === selectedPlan)?.name} - {plans.find(p => p.id === selectedPlan)?.price}
                </Text>
              </View>
            )}
            
            {/* Payment Instructions */}
            <ScrollView style={styles.instructionsContainer}>
              <View style={styles.instructionSection}>
                <MaterialCommunityIcons name="information" size={24} color={COLORS.BUTTON} />
                <Text style={styles.instructionTitle}>How to Pay</Text>
              </View>
              
              <Text style={styles.instructionText}>
                To complete your subscription with local payment methods, please contact our support team via WhatsApp for personalized payment instructions.
              </Text>
              
              <View style={styles.paymentMethods}>
                <Text style={styles.methodsTitle}>Available Payment Methods:</Text>
                <View style={styles.methodItem}>
                  <MaterialCommunityIcons name="bank" size={20} color={COLORS.SUCCESS} />
                  <Text style={styles.methodText}>Bank Transfer</Text>
                </View>
                <View style={styles.methodItem}>
                  <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.SUCCESS} />
                  <Text style={styles.methodText}>Mobile Money (e-birr, Waafi)</Text>
                </View>
                <View style={styles.methodItem}>
                  <MaterialCommunityIcons name="cash" size={20} color={COLORS.SUCCESS} />
                  <Text style={styles.methodText}>Local Currency Support</Text>
                </View>
              </View>
              
              <View style={styles.contactSection}>
                <Text style={styles.contactTitle}>Contact Support</Text>
                <Text style={styles.contactDescription}>
                  Our support team will provide you with:
                </Text>
                <Text style={styles.contactBullet}>• Payment account details</Text>
                <Text style={styles.contactBullet}>• Step-by-step instructions</Text>
                <Text style={styles.contactBullet}>• Verification process</Text>
                <Text style={styles.contactBullet}>• Instant activation after payment</Text>
              </View>
            </ScrollView>
            
            {/* WhatsApp Button */}
            <View style={styles.whatsappSection}>
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={handleOpenWhatsApp}
              >
                <MaterialCommunityIcons name="whatsapp" size={24} color="#FFFFFF" />
                <Text style={styles.whatsappButtonText}>
                  Contact via WhatsApp
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.phoneNumber}>+1 (614) 852-8515</Text>
              
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={handleCloseLocalPaymentModal}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    marginTop: SPACING.MD,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: SPACING.XL,
    paddingTop: SPACING.LG,
  },
  headerTitle: {
    fontSize: FONTS.SIZES.HEADER,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  headerSubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  trialStatusCard: {
    backgroundColor: COLORS.BUTTON_LIGHT,
    margin: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
  },
  trialStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  trialStatusTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginLeft: SPACING.SM,
  },
  trialStatusText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
  },
  trialExpiredText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.ERROR,
  },
  trialProgress: {
    height: 6,
    borderRadius: 3,
  },
  premiumStatusCard: {
    backgroundColor: COLORS.SUCCESS + '20',
    margin: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS,
  },
  premiumStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  premiumStatusTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.SUCCESS,
    marginLeft: SPACING.SM,
  },
  premiumStatusText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
  },
  plansContainer: {
    padding: SPACING.MD,
    gap: SPACING.MD,
  },
  planCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    position: 'relative',
  },
  selectedPlanCard: {
    borderColor: COLORS.BUTTON,
    backgroundColor: COLORS.BUTTON_LIGHT,
  },
  popularPlanCard: {
    borderColor: COLORS.SUCCESS,
  },
  disabledPlanCard: {
    opacity: 0.5,
    borderColor: COLORS.TEXT_SECONDARY,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: SPACING.LG,
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS,
    borderRadius: BORDER_RADIUS.SM,
  },
  popularText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  expiredBadge: {
    position: 'absolute',
    top: -10,
    right: SPACING.LG,
    backgroundColor: COLORS.ERROR,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.XS,
    borderRadius: BORDER_RADIUS.SM,
  },
  expiredText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.MD,
  },
  planInfo: {
    flex: 1,
    marginLeft: SPACING.SM,
  },
  planName: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  planDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.XS,
  },
  planPrice: {
    fontSize: FONTS.SIZES.TITLE,
    fontFamily: FONTS.BOLD,
    color: COLORS.BUTTON,
    marginRight: SPACING.XS,
  },
  planDuration: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  originalPrice: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    textDecorationLine: 'line-through',
  },
  savingsChip: {
    backgroundColor: COLORS.SUCCESS,
  },
  savingsText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    fontFamily: FONTS.BOLD,
  },
  featuresContainer: {
    gap: SPACING.SM,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  featureText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    flex: 1,
  },
  disabledText: {
    color: COLORS.TEXT_SECONDARY,
  },
  actionContainer: {
    padding: SPACING.LG,
  },
  primaryButton: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
  },
  disabledButton: {
    backgroundColor: COLORS.TEXT_SECONDARY,
    borderRadius: BORDER_RADIUS.LG,
  },
  buttonContent: {
    paddingVertical: SPACING.SM,
  },
  termsContainer: {
    padding: SPACING.LG,
    paddingTop: 0,
  },
  termsTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
  },
  termsText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: SPACING.XS,
  },
  // Modal styles for subscription options
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  subscriptionModalContent: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.LG,
    paddingBottom: SPACING.MD,
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  closeButton: {
    padding: SPACING.XS,
  },
  modalDivider: {
    backgroundColor: COLORS.BORDER,
  },
  selectedPlanInfo: {
    padding: SPACING.LG,
    backgroundColor: COLORS.BUTTON_LIGHT,
    borderRadius: BORDER_RADIUS.MD,
    margin: SPACING.LG,
    marginBottom: 0,
  },
  selectedPlanTitle: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
    textTransform: 'uppercase',
  },
  selectedPlanName: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  subscriptionOptions: {
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  subscriptionOption: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  selectedOption: {
    borderColor: COLORS.BUTTON,
    backgroundColor: COLORS.BUTTON_LIGHT,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.MD,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: COLORS.BUTTON_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.MD,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  optionDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
  },
  radioContainer: {
    marginLeft: SPACING.SM,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.BUTTON,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.BUTTON,
  },
  optionFeatures: {
    gap: SPACING.XS,
  },
  // PHASE 1.7 FIX: this was a second `featureText` key in the same
  // StyleSheet.create({...}) object -- a real bug (no-dupe-keys), not
  // cosmetic. Object literals silently keep only the LAST value for a
  // duplicate key, so every consumer of `styles.featureText` (including
  // the unrelated plan-comparison list at this screen's top, which wants
  // the OTHER definition just above) was getting this smaller, dimmer
  // style instead of its own. Renamed and repointed the 6 modal call
  // sites that actually wanted this one.
  modalFeatureText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  modalMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    margin: SPACING.LG,
    marginTop: 0,
    borderRadius: BORDER_RADIUS.MD,
    gap: SPACING.SM,
  },
  modalMessageText: {
    fontSize: FONTS.SIZES.MEDIUM,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  cancelButton: {
    flex: 1,
    borderColor: COLORS.BORDER,
    borderRadius: BORDER_RADIUS.LG,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
  },
  errorMessage: {
    backgroundColor: COLORS.ERROR_LIGHT,
  },
  successMessage: {
    backgroundColor: COLORS.SUCCESS + '20',
  },
  // Local Payment Modal Styles
  localPaymentModalContent: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    width: '100%',
    maxWidth: 450,
    maxHeight: '90%',
  },
  instructionsContainer: {
    maxHeight: 400,
    paddingHorizontal: SPACING.LG,
  },
  instructionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    gap: SPACING.SM,
  },
  instructionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
  },
  instructionText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  paymentMethods: {
    marginBottom: SPACING.LG,
  },
  methodsTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.MD,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.SM,
    gap: SPACING.SM,
  },
  methodText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
  },
  contactSection: {
    marginBottom: SPACING.LG,
  },
  contactTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
  },
  contactDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
  },
  contactBullet: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
    paddingLeft: SPACING.SM,
  },
  whatsappSection: {
    padding: SPACING.LG,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  whatsappButton: {
    backgroundColor: '#25D366', // WhatsApp green
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.LG,
    paddingHorizontal: SPACING.XL,
    borderRadius: BORDER_RADIUS.LG,
    marginBottom: SPACING.MD,
    gap: SPACING.SM,
    width: '100%',
    ...SHADOWS.MEDIUM,
  },
  whatsappButtonText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: '#FFFFFF',
  },
  phoneNumber: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.LG,
    textAlign: 'center',
  },
  closeModalButton: {
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.XL,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  closeModalButtonText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    textAlign: 'center',
  },
});

export default PremiumSubscriptionScreen;
