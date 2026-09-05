import { supabase } from './supabase';
// Conditional import for in-app purchases (requires development build)
let InAppPurchases = null;
try {
  InAppPurchases = require('expo-in-app-purchases');
} catch (error) {
  // In-app purchases not available in Expo Go - requires development build
}
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Kayd Books Premium Subscription Service
 * Handles custom 7-day trial + production Apple/Google subscriptions
 */

// Safe string utility function
const safeString = (value) => value ? String(value) : '';

// Safe split utility function
const safeSplit = (value, separator = '.') => {
  const str = safeString(value);
  try {
    return str.split(separator);
  } catch (error) {
    // Error splitting string
    return [];
  }
};

// Safe object property access
const safeAccess = (obj, path) => {
  if (!obj) return undefined;
  const keys = safeSplit(path, '.');
  return keys.reduce((current, key) => current && current[key], obj);
};

// Production Product IDs for Apple App Store and Google Play
export const SUBSCRIPTION_PRODUCTS = {
  // Apple App Store Product IDs
  APPLE: {
    MONTHLY: 'com.kaydbooks.premium.monthly',
    YEARLY: 'com.kaydbooks.premium.yearly',
  },
  // Google Play Product IDs
  GOOGLE: {
    MONTHLY: 'kaydbooks_monthly',
    YEARLY: 'kaydbooks_yearly',
  }
};

// Get platform-specific product IDs
const getProductIds = () => {
  if (Platform.OS === 'ios') {
    return [
      SUBSCRIPTION_PRODUCTS.APPLE.MONTHLY,
      SUBSCRIPTION_PRODUCTS.APPLE.YEARLY,
    ];
  } else {
    return [
      SUBSCRIPTION_PRODUCTS.GOOGLE.MONTHLY,
      SUBSCRIPTION_PRODUCTS.GOOGLE.YEARLY,
    ];
  }
};

// Storage keys for trial management
const STORAGE_KEYS = {
  TRIAL_START_DATE: 'kayd_trial_start_date',
  TRIAL_ACTIVATED: 'kayd_trial_activated',
  FIRST_APP_OPEN: 'kayd_first_app_open',
};

/**
 * CUSTOM 7-DAY TRIAL LOGIC
 * Automatically starts on first app open, no payment required
 */

// Check if this is the first time user opens the app
export const checkFirstAppOpen = async () => {
  try {
    const firstOpen = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_APP_OPEN);
    return firstOpen === null; // Returns true if first time
  } catch (error) {
    // Error checking first app open
    return false;
  }
};

// Start custom 7-day trial automatically on first app open
export const startCustomTrial = async (userId) => {
  try {
    // Starting custom 7-day trial for user
    
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    
    // Store trial info locally
    await AsyncStorage.setItem(STORAGE_KEYS.TRIAL_START_DATE, now.toISOString());
    await AsyncStorage.setItem(STORAGE_KEYS.TRIAL_ACTIVATED, 'true');
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_APP_OPEN, 'false');
    
    // Store trial info in Supabase for cross-device sync
    const { error } = await supabase
      .from('users')
      .update({
        trial_started: true,
        trial_start_date: now.toISOString(),
        trial_end_date: trialEndDate.toISOString(),
        premium_access: true, // Grant premium access during trial
        subscription_status: 'trial'
      })
      .eq('id', userId);

    if (error) {
      // Error updating trial in Supabase
      throw error;
    }

    // Custom trial started successfully
    return {
      success: true,
      trialEndDate: trialEndDate.toISOString(),
      daysRemaining: 7
    };
    
  } catch (error) {
    // Error starting custom trial
    throw error;
  }
};

// Check current trial status
export const getTrialStatus = async (userId) => {
  try {
    // First check local storage for quick access
    const trialActivated = await AsyncStorage.getItem(STORAGE_KEYS.TRIAL_ACTIVATED);
    const trialStartDate = await AsyncStorage.getItem(STORAGE_KEYS.TRIAL_START_DATE);
    
    if (!trialActivated || !trialStartDate) {
      return {
        isActive: false,
        hasStarted: false,
        daysRemaining: 0,
        expired: false
      };
    }

    // Check Supabase for authoritative data
    const { data: users, error } = await supabase
      .from('users')
      .select('trial_started, trial_start_date, trial_end_date, premium_access, subscription_status')
      .eq('id', userId);

    if (error) {
      // Error fetching trial status
      // Fall back to local storage
      const startDate = new Date(trialStartDate);
      const now = new Date();
      const endDate = new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000));
      const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      
      return {
        isActive: daysRemaining > 0,
        hasStarted: true,
        daysRemaining,
        expired: daysRemaining === 0,
        endDate: endDate.toISOString()
      };
    }

    if (!users || users.length === 0) {
      return {
        isActive: false,
        hasStarted: false,
        daysRemaining: 0,
        expired: false
      };
    }

    const user = users[0];

    if (!user.trial_started) {
      return {
        isActive: false,
        hasStarted: false,
        daysRemaining: 0,
        expired: false
      };
    }

    const now = new Date();
    const endDate = new Date(user.trial_end_date);
    const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
    const isActive = daysRemaining > 0 && user.subscription_status === 'trial';

    return {
      isActive,
      hasStarted: true,
      daysRemaining,
      expired: daysRemaining === 0,
      endDate: user.trial_end_date,
      startDate: user.trial_start_date
    };

  } catch (error) {
    // Error getting trial status
    return {
      isActive: false,
      hasStarted: false,
      daysRemaining: 0,
      expired: false,
      error: error.message
    };
  }
};

// Expire trial and lock premium features
export const expireTrial = async (userId) => {
  try {
    // Expiring trial for user
    
    // Update local storage
    await AsyncStorage.removeItem(STORAGE_KEYS.TRIAL_ACTIVATED);
    
    // Update Supabase
    const { error } = await supabase
      .from('users')
      .update({
        premium_access: false,
        subscription_status: 'expired_trial'
      })
      .eq('id', userId);

    if (error) {
      // Error expiring trial in Supabase
      throw error;
    }

    // Trial expired successfully
    return { success: true };
    
  } catch (error) {
    // Error expiring trial
    throw error;
  }
};

/**
 * PRODUCTION SUBSCRIPTION LOGIC
 * Real Apple App Store & Google Play subscriptions
 */

// Initialize In-App Purchases
export const initializeSubscriptions = async () => {
  try {
    // Initializing subscription service
    
    // Check if in-app purchases are available
    if (!InAppPurchases) {
      // In-app purchases not available - using mock data for development
      return {
        success: true,
        products: [
          {
            productId: Platform.OS === 'ios' ? 'com.kaydbooks.premium.monthly' : 'kaydbooks_monthly',
            price: 4.99,
            priceString: '$4.99',
            title: 'Monthly Premium',
            description: 'Monthly subscription to Kayd Books Premium',
            type: 'monthly'
          },
          {
            productId: Platform.OS === 'ios' ? 'com.kaydbooks.premium.yearly' : 'kaydbooks_yearly',
            price: 49.99,
            priceString: '$49.99',
            title: 'Yearly Premium',
            description: 'Yearly subscription to Kayd Books Premium',
            type: 'yearly'
          }
        ],
        mockMode: true
      };
    }
    
    // Connect to store
    await InAppPurchases.connectAsync();
    
    // Get available products
    const productIds = getProductIds();
    const { results: products } = await InAppPurchases.getProductsAsync(productIds);
    
    // Available subscription products
    
    return {
      success: true,
      products: products.map(product => ({
        productId: product.productId,
        price: product.price,
        priceString: product.priceString,
        title: product.title,
        description: product.description,
        type: product.productId.includes('yearly') ? 'yearly' : 'monthly'
      }))
    };
    
  } catch (error) {
    // Error initializing subscriptions
    return {
      success: false,
      error: error.message,
      products: []
    };
  }
};

// Purchase subscription (Monthly or Yearly)
export const purchaseSubscription = async (userId, productId) => {
  try {
    // Purchasing subscription
    
    // Check if in-app purchases are available
    if (!InAppPurchases) {
      // In-app purchases not available - simulating purchase for development
      
      // Simulate successful purchase for development
      const mockPurchase = {
        productId: productId,
        transactionId: `mock_${Date.now()}`,
        purchaseTime: Date.now()
      };
      
      // Activate premium subscription with mock data
      await activatePremiumSubscription(userId, productId, mockPurchase);
      
      return {
        success: true,
        productId: mockPurchase.productId,
        transactionId: mockPurchase.transactionId,
        purchaseTime: mockPurchase.purchaseTime,
        mockMode: true
      };
    }
    
    // Request purchase from store
    const { responseCode, results } = await InAppPurchases.purchaseItemAsync(productId);
    
    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      const purchase = results[0];
      // Purchase successful
      
      // Verify receipt server-side (optional but recommended)
      const verificationResult = await verifyPurchaseReceipt(userId, purchase);
      
      if (verificationResult.success) {
        // Activate premium subscription
        await activatePremiumSubscription(userId, productId, purchase);
        
        return {
          success: true,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          purchaseTime: purchase.purchaseTime
        };
      } else {
        throw new Error('Receipt verification failed');
      }
      
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
      return {
        success: false,
        cancelled: true,
        message: 'Purchase cancelled by user'
      };
    } else {
      throw new Error(`Purchase failed with code: ${responseCode}`);
    }
    
  } catch (error) {
    // Error purchasing subscription
    return {
      success: false,
      error: error.message
    };
  }
};

// Verify purchase receipt (server-side verification recommended)
const verifyPurchaseReceipt = async (userId, purchase) => {
  try {
    // For production, implement server-side receipt verification
    // This is a simplified version - in production, send receipt to your server
    
    // Verifying purchase receipt
    
    // You can implement server-side verification here
    // For now, we'll do basic client-side validation
    
    if (purchase.transactionId && purchase.productId) {
      // Log purchase in database for audit
      await supabase
        .from('purchase_transactions')
        .insert({
          user_id: userId,
          product_id: purchase.productId,
          transaction_id: purchase.transactionId,
          platform: Platform.OS,
          purchase_time: purchase.purchaseTime,
          verified: true,
          created_at: new Date().toISOString()
        });
      
      return { success: true };
    }
    
    return { success: false, error: 'Invalid purchase data' };
    
  } catch (error) {
    // Error verifying receipt
    return { success: false, error: error.message };
  }
};

// Activate premium subscription after successful purchase
const activatePremiumSubscription = async (userId, productId, purchase) => {
  try {
    // Activating premium subscription
    
    const now = new Date();
    let subscriptionEndDate;
    let subscriptionType;
    
    // Calculate subscription end date based on product type
    if (productId.includes('yearly')) {
      subscriptionEndDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year
      subscriptionType = 'yearly';
    } else {
      subscriptionEndDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 1 month
      subscriptionType = 'monthly';
    }
    
    // Update user subscription in Supabase
    const { error } = await supabase
      .from('users')
      .update({
        premium_access: true,
        subscription_status: 'active',
        subscription_type: subscriptionType,
        subscription_start_date: now.toISOString(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        product_id: productId,
        transaction_id: purchase.transactionId
      })
      .eq('id', userId);

    if (error) {
      // Error activating subscription
      throw error;
    }
    
    // Clear trial data since user now has paid subscription
    await AsyncStorage.removeItem(STORAGE_KEYS.TRIAL_ACTIVATED);
    await AsyncStorage.removeItem(STORAGE_KEYS.TRIAL_START_DATE);
    
    // Premium subscription activated successfully
    return { success: true, endDate: subscriptionEndDate.toISOString() };
    
  } catch (error) {
    // Error activating premium subscription
    throw error;
  }
};

// Restore previous purchases
export const restorePurchases = async (userId) => {
  try {
    // Restoring purchases
    
    // Check if in-app purchases are available
    if (!InAppPurchases) {
      // In-app purchases not available - checking database for previous purchases
      
      // Check database for previous purchases
      const { data: purchases, error } = await supabase
        .from('purchase_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('verified', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      if (purchases && purchases.length > 0) {
        const latestPurchase = purchases[0];
        
        // Restore subscription based on database record
        await activatePremiumSubscription(userId, latestPurchase.product_id, {
          productId: latestPurchase.product_id,
          transactionId: latestPurchase.transaction_id,
          purchaseTime: latestPurchase.purchase_time
        });
        
        return {
          success: true,
          restored: true,
          productId: latestPurchase.product_id,
          mockMode: true
        };
      }
      
      return {
        success: true,
        restored: false,
        message: 'No previous purchases found',
        mockMode: true
      };
    }
    
    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();
    
    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      const subscriptionPurchases = results.filter(purchase => 
        getProductIds().includes(purchase.productId)
      );
      
      if (subscriptionPurchases.length > 0) {
        // Find the most recent subscription
        const latestPurchase = subscriptionPurchases.sort((a, b) => 
          new Date(b.purchaseTime) - new Date(a.purchaseTime)
        )[0];
        
        // Verify and restore the subscription
        const verificationResult = await verifyPurchaseReceipt(userId, latestPurchase);
        
        if (verificationResult.success) {
          await activatePremiumSubscription(userId, latestPurchase.productId, latestPurchase);
          
          return {
            success: true,
            restored: true,
            productId: latestPurchase.productId
          };
        }
      }
      
      return {
        success: true,
        restored: false,
        message: 'No previous purchases found'
      };
    }
    
    throw new Error(`Restore failed with code: ${responseCode}`);
    
  } catch (error) {
    // Error restoring purchases
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * PREMIUM FEATURE ACCESS CONTROL
 */

// Check if user has premium access (trial or paid subscription)
export const hasPremiumAccess = async (userId) => {
  try {
    // Check trial status first
    const trialStatus = await getTrialStatus(userId);
    
    if (trialStatus.isActive) {
      return {
        hasAccess: true,
        source: 'trial',
        daysRemaining: trialStatus.daysRemaining,
        endDate: trialStatus.endDate
      };
    }
    
    // Check paid subscription status
    const { data: users, error } = await supabase
      .from('users')
      .select('premium_access, subscription_status, subscription_end_date, subscription_type')
      .eq('id', userId);

    if (error) {
      // Error checking premium access
      return { hasAccess: false, error: error.message };
    }

    if (!users || users.length === 0) {
      return { hasAccess: false };
    }

    const user = users[0];

    if (user.premium_access && user.subscription_status === 'active') {
      const now = new Date();
      const endDate = new Date(user.subscription_end_date);
      
      if (endDate > now) {
        return {
          hasAccess: true,
          source: 'subscription',
          subscriptionType: user.subscription_type,
          endDate: user.subscription_end_date
        };
      } else {
        // Subscription expired, revoke access
        await expireSubscription(userId);
        return { hasAccess: false, expired: true };
      }
    }
    
    return { hasAccess: false };
    
  } catch (error) {
    // Error checking premium access
    return { hasAccess: false, error: error.message };
  }
};

// Expire subscription and revoke premium access
const expireSubscription = async (userId) => {
  try {
    await supabase
      .from('users')
      .update({
        premium_access: false,
        subscription_status: 'expired'
      })
      .eq('id', userId);
      
    // Subscription expired for user
  } catch (error) {
    // Error expiring subscription
  }
};

// Get subscription plans for UI display
export const getSubscriptionPlans = () => {
  return [
    {
      id: 'monthly',
      name: 'Monthly Premium',
      description: 'Perfect for regular readers',
      price: '$4.99',
      duration: 'per month',
      productId: Platform.OS === 'ios' ? 
        SUBSCRIPTION_PRODUCTS.APPLE.MONTHLY : 
        SUBSCRIPTION_PRODUCTS.GOOGLE.MONTHLY,
      features: [
        'Unlimited book access',
        'Offline reading',
        'Premium audiobooks',
        'No advertisements',
        'Advanced search filters',
        'Priority customer support'
      ],
      isCustomTrial: false,
      popular: true
    },
    {
      id: 'yearly',
      name: 'Yearly Premium',
      description: 'Best value for book lovers',
      price: '$49.99',
      duration: 'per year',
      originalPrice: '$59.88',
      savings: 'Save $9.89',
      productId: Platform.OS === 'ios' ? 
        SUBSCRIPTION_PRODUCTS.APPLE.YEARLY : 
        SUBSCRIPTION_PRODUCTS.GOOGLE.YEARLY,
      features: [
        'Unlimited book access',
        'Offline reading',
        'Premium audiobooks',
        'No advertisements',
        'Advanced search filters',
        'Priority customer support',
        'Exclusive early access to new books'
      ],
      isCustomTrial: false,
      popular: false
    }
  ];
};

// Disconnect from store
export const disconnectSubscriptions = async () => {
  try {
    if (InAppPurchases) {
      await InAppPurchases.disconnectAsync();
      // Disconnected from subscription service
    } else {
      // No subscription service to disconnect (development mode)
    }
  } catch (error) {
    // Error disconnecting subscriptions
  }
};

// Check if trial has expired (global function)
export const isTrialExpired = async (userId) => {
  try {
    const trialStatus = await getTrialStatus(userId);
    return trialStatus.expired;
  } catch (error) {
    // Error checking trial expiration
    return true; // Default to expired if error
  }
};
export const initializeAppSubscriptions = async (userId) => {
  try {
    // Initializing app subscriptions for user
    
    // Check if this is first app open
    const isFirstOpen = await checkFirstAppOpen();
    
    if (isFirstOpen) {
      // First app open detected - starting custom trial
      await startCustomTrial(userId);
      return { trialStarted: true };
    }
    
    // Check current premium access status
    const premiumStatus = await hasPremiumAccess(userId);
    // Premium access status checked
    
    return { premiumStatus };
    
  } catch (error) {
    // Error initializing app subscriptions
    return { error: error.message };
  }
};
