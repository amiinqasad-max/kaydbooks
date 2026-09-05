import { Platform, Alert } from 'react-native';

// Conditional imports for IAP modules
let RNIap = null;

try {
  RNIap = require('react-native-iap');
} catch (error) {
  console.warn('⚠️ react-native-iap not available:', error.message);
}

/**
 * In-App Purchase Service for Google Play Billing Library v6 and StoreKit 2
 * Handles subscriptions and one-time purchases across platforms
 */
class InAppPurchaseService {
  constructor() {
    this.isInitialized = false;
    this.products = [];
    this.subscriptions = [];
    this.purchaseUpdateSubscription = null;
    this.purchaseErrorSubscription = null;
    
    // Subscription product IDs
    this.productIds = Platform.select({
      ios: [
        'kayd_books_monthly',
        'kayd_books_yearly',
        'kayd_books_premium_monthly',
        'kayd_books_premium_yearly',
      ],
      android: [
        'kayd_books_monthly',
        'kayd_books_yearly', 
        'kayd_books_premium_monthly',
        'kayd_books_premium_yearly',
      ],
    });
  }

  /**
   * Initialize the IAP service
   */
  async initialize() {
    if (!RNIap) {
      console.warn('⚠️ IAP not available - running in development mode');
      return false;
    }

    try {
      console.log('🛒 Initializing In-App Purchase Service...');
      
      // Initialize connection to store
      await RNIap.initConnection();
      
      // Set up purchase listeners
      this.setupPurchaseListeners();
      
      // Get available products
      await this.loadProducts();
      
      // Check for pending purchases (important for subscription continuity)
      await this.checkPendingPurchases();
      
      this.isInitialized = true;
      console.log('✅ IAP Service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize IAP service:', error);
      return false;
    }
  }

  /**
   * Set up purchase event listeners
   */
  setupPurchaseListeners() {
    if (!RNIap) return;

    // Purchase update listener
    this.purchaseUpdateSubscription = RNIap.purchaseUpdatedListener((purchase) => {
      console.log('🛒 Purchase updated:', purchase);
      this.handlePurchaseUpdate(purchase);
    });

    // Purchase error listener
    this.purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
      console.error('🛒 Purchase error:', error);
      this.handlePurchaseError(error);
    });
  }

  /**
   * Load available products from store
   */
  async loadProducts() {
    if (!RNIap || !this.productIds) return;

    try {
      // Get subscription products
      const subscriptions = await RNIap.getSubscriptions({ skus: this.productIds });
      this.subscriptions = subscriptions;
      
      console.log('🛒 Loaded subscriptions:', subscriptions.length);
      return subscriptions;
      
    } catch (error) {
      console.error('❌ Failed to load products:', error);
      return [];
    }
  }

  /**
   * Get subscription plans with pricing
   */
  getSubscriptionPlans() {
    return this.subscriptions.map(sub => ({
      id: sub.productId,
      title: sub.title,
      description: sub.description,
      price: sub.localizedPrice,
      currency: sub.currency,
      period: this.getPeriodFromProductId(sub.productId),
      savings: this.calculateSavings(sub.productId, sub.price),
    }));
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(productId) {
    if (!RNIap) {
      Alert.alert('Error', 'In-app purchases are not available');
      return false;
    }

    try {
      console.log('🛒 Initiating purchase for:', productId);
      
      const purchase = await RNIap.requestSubscription({
        sku: productId,
        ...(Platform.OS === 'android' && {
          // Android-specific options for Google Play Billing Library v6
          subscriptionOffers: [
            {
              sku: productId,
              offerToken: 'default_offer_token', // You'll get this from Google Play Console
            },
          ],
        }),
      });

      console.log('🛒 Purchase initiated:', purchase);
      return true;
      
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      
      if (error.code === 'E_USER_CANCELLED') {
        // User cancelled - don't show error
        return false;
      }
      
      Alert.alert(
        'Purchase Failed',
        error.message || 'Unable to complete purchase. Please try again.'
      );
      return false;
    }
  }

  /**
   * Handle successful purchase
   */
  async handlePurchaseUpdate(purchase) {
    try {
      console.log('🛒 Processing purchase:', purchase.productId);
      
      // Verify purchase with your backend
      const isValid = await this.verifyPurchase(purchase);
      
      if (isValid) {
        // Grant premium access
        await this.grantPremiumAccess(purchase);
        
        // Acknowledge/finish the purchase
        if (Platform.OS === 'android') {
          await RNIap.acknowledgePurchaseAndroid(purchase.purchaseToken);
        } else {
          await RNIap.finishTransaction(purchase);
        }
        
        Alert.alert(
          'Purchase Successful!',
          'Welcome to Kayd Books Premium! Your subscription is now active.',
          [{ text: 'OK', onPress: () => this.onPurchaseSuccess?.(purchase) }]
        );
      }
      
    } catch (error) {
      console.error('❌ Failed to process purchase:', error);
      Alert.alert('Error', 'Failed to activate subscription. Please contact support.');
    }
  }

  /**
   * Handle purchase errors
   */
  handlePurchaseError(error) {
    console.error('🛒 Purchase error:', error);
    
    if (error.code !== 'E_USER_CANCELLED') {
      Alert.alert(
        'Purchase Error',
        error.message || 'Something went wrong with your purchase. Please try again.'
      );
    }
  }

  /**
   * Verify purchase with backend
   */
  async verifyPurchase(purchase) {
    try {
      // TODO: Implement server-side purchase verification
      // This should validate the purchase receipt with Apple/Google
      // and update the user's subscription status in your database
      
      console.log('🔐 Verifying purchase:', purchase.productId);
      
      // For now, return true - implement proper verification
      return true;
      
    } catch (error) {
      console.error('❌ Purchase verification failed:', error);
      return false;
    }
  }

  /**
   * Grant premium access to user
   */
  async grantPremiumAccess(purchase) {
    try {
      // TODO: Update user's subscription status in your database
      // This should be done on your backend after purchase verification
      
      console.log('✅ Granting premium access for:', purchase.productId);
      
      // Store purchase info locally for immediate UI updates
      const subscriptionData = {
        productId: purchase.productId,
        purchaseTime: purchase.purchaseTime,
        isActive: true,
        expiryTime: this.calculateExpiryTime(purchase),
      };
      
      // You can store this in AsyncStorage or your state management
      // await AsyncStorage.setItem('subscription', JSON.stringify(subscriptionData));
      
    } catch (error) {
      console.error('❌ Failed to grant premium access:', error);
    }
  }

  /**
   * Check for pending purchases (important for subscription continuity)
   */
  async checkPendingPurchases() {
    if (!RNIap) return;

    try {
      // Get available purchases (iOS) or purchase history (Android)
      const purchases = await RNIap.getAvailablePurchases();
      
      console.log('🛒 Found pending purchases:', purchases.length);
      
      for (const purchase of purchases) {
        if (this.productIds.includes(purchase.productId)) {
          await this.handlePurchaseUpdate(purchase);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to check pending purchases:', error);
    }
  }

  /**
   * Restore purchases (iOS requirement)
   */
  async restorePurchases() {
    if (!RNIap) {
      Alert.alert('Error', 'Purchase restoration is not available');
      return;
    }

    try {
      console.log('🔄 Restoring purchases...');
      
      const purchases = await RNIap.getAvailablePurchases();
      
      if (purchases.length === 0) {
        Alert.alert('No Purchases Found', 'No previous purchases found to restore.');
        return;
      }
      
      for (const purchase of purchases) {
        if (this.productIds.includes(purchase.productId)) {
          await this.handlePurchaseUpdate(purchase);
        }
      }
      
      Alert.alert('Success', 'Purchases restored successfully!');
      
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus() {
    // TODO: Check with your backend for current subscription status
    // This should verify the subscription is still active
    
    try {
      // For now, return a mock status
      return {
        isActive: false,
        productId: null,
        expiryDate: null,
      };
      
    } catch (error) {
      console.error('❌ Failed to get subscription status:', error);
      return { isActive: false, productId: null, expiryDate: null };
    }
  }

  /**
   * Helper: Get subscription period from product ID
   */
  getPeriodFromProductId(productId) {
    if (productId.includes('yearly')) return 'yearly';
    if (productId.includes('monthly')) return 'monthly';
    return 'unknown';
  }

  /**
   * Helper: Calculate savings for yearly plans
   */
  calculateSavings(productId, price) {
    if (productId.includes('yearly')) {
      // Calculate savings compared to monthly plan
      // This is a simplified calculation - adjust based on your pricing
      return '50%';
    }
    return null;
  }

  /**
   * Helper: Calculate subscription expiry time
   */
  calculateExpiryTime(purchase) {
    const purchaseTime = new Date(purchase.purchaseTime);
    const period = this.getPeriodFromProductId(purchase.productId);
    
    if (period === 'yearly') {
      purchaseTime.setFullYear(purchaseTime.getFullYear() + 1);
    } else if (period === 'monthly') {
      purchaseTime.setMonth(purchaseTime.getMonth() + 1);
    }
    
    return purchaseTime.getTime();
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.purchaseUpdateSubscription) {
      this.purchaseUpdateSubscription.remove();
    }
    
    if (this.purchaseErrorSubscription) {
      this.purchaseErrorSubscription.remove();
    }
    
    if (RNIap) {
      RNIap.endConnection();
    }
    
    console.log('🛒 IAP Service cleaned up');
  }
}

// Export singleton instance
export default new InAppPurchaseService();
