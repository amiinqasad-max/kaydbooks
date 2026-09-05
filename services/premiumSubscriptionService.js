import { supabase, verifyPurchaseWithServer, getActiveSubscription } from './supabase';
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
// -------------------------------------------------------------------------
// PHASE 1.5 SECURITY FIX -- read this before touching this function again.
//
// The previous implementation of this file had THREE separate ways for a
// client to grant itself permanent paid premium access with zero real
// verification:
//   1. purchaseSubscription(), when `InAppPurchases` was unavailable (i.e.
//      every Expo Go session -- this project's default dev environment),
//      unconditionally called activatePremiumSubscription() with a fake
//      `mock_${Date.now()}` transaction id. Tapping "Subscribe" in Expo Go
//      granted real premium for free, always.
//   2. verifyPurchaseReceipt() did not verify anything: its own comment
//      admitted "For now, we'll do basic client-side validation", and that
//      validation was `if (purchase.transactionId && purchase.productId)`
//      -- any two non-empty strings. It then wrote `verified: true` into
//      purchase_transactions itself, and activatePremiumSubscription()
//      trusted that self-reported flag.
//   3. activatePremiumSubscription() wrote premium_access/subscription_*
//      directly onto the `users` row from the CLIENT. This is exactly the
//      vulnerability class supabase/migrations/003_authorization_and_schema_fixes.sql's
//      "DEFENSIVE CLEANUP" section revokes client write access for -- but
//      revoking the grant only makes this code throw an RLS error, it
//      doesn't fix the fact that the client believed it was allowed to
//      grant itself premium in the first place.
//
// Fix: purchases are now verified by actually calling the verify-receipt
// Edge Function (services/supabase.js's verifyPurchaseWithServer), which
// runs server-side with the service_role key and writes to the
// `subscriptions` table -- the client never writes a premium flag itself.
// See supabase/functions/verify-receipt/index.ts.
//
// NOT VERIFIED — this has not been exercised against a real Apple/Google
// sandbox purchase; expo-in-app-purchases requires a real device build to
// even test the purchase prompt at all.
// -------------------------------------------------------------------------

const planFromProductId = (productId) => (productId?.includes('yearly') ? 'yearly' : 'monthly');

export const purchaseSubscription = async (userId, productId) => {
  try {
    if (!InAppPurchases) {
      // Was previously silently granting free premium here. A real
      // purchase cannot be made without the native in-app-purchases
      // module, which Expo Go does not include -- report that honestly
      // instead of pretending a purchase happened.
      return {
        success: false,
        error: 'In-app purchases require a development or production build. They are not available in Expo Go.',
      };
    }

    const { responseCode, results } = await InAppPurchases.purchaseItemAsync(productId);

    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      const purchase = results[0];
      const result = await verifyPurchaseReceipt(purchase);
      if (!result.success) throw new Error(result.error || 'Receipt verification failed');

      // Clear trial bookkeeping now that a real, server-verified paid
      // subscription exists. Premium status itself is read fresh from
      // getActiveSubscription()/hasPremiumAccess(), not set here.
      await AsyncStorage.removeItem(STORAGE_KEYS.TRIAL_ACTIVATED);
      await AsyncStorage.removeItem(STORAGE_KEYS.TRIAL_START_DATE);

      return { success: true, productId: purchase.productId, transactionId: purchase.transactionId };
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
      return { success: false, cancelled: true, message: 'Purchase cancelled by user' };
    } else {
      throw new Error(`Purchase failed with code: ${responseCode}`);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Actually verifies the purchase server-side via the verify-receipt Edge
// Function -- see the Phase 1.5 note above for what this replaced.
const verifyPurchaseReceipt = async (purchase) => {
  try {
    const plan = planFromProductId(purchase.productId);
    const receipt =
      Platform.OS === 'ios'
        ? purchase.transactionReceipt // base64 App Store receipt
        : { productId: purchase.productId, purchaseToken: purchase.purchaseToken };

    if (Platform.OS === 'ios' && !receipt) {
      return { success: false, error: 'No receipt data returned by the store.' };
    }
    if (Platform.OS !== 'ios' && !receipt.purchaseToken) {
      return { success: false, error: 'No purchase token returned by the store.' };
    }

    const result = await verifyPurchaseWithServer({ receipt, platform: Platform.OS, plan });
    return { success: true, subscriptionEnd: result.subscriptionEnd };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Restore previous purchases
export const restorePurchases = async (userId) => {
  try {
    if (!InAppPurchases) {
      // PHASE 1.5 FIX: this used to read `purchase_transactions` rows that
      // verifyPurchaseReceipt() itself had written with a self-reported
      // `verified: true` (never actually checked by anyone) and grant
      // premium from them, labeling the result "mockMode: true" -- i.e. it
      // knowingly faked a restore. There is nothing legitimate to restore
      // without the real store APIs, so say so plainly instead.
      return {
        success: false,
        error: 'Restoring purchases requires a development or production build. Not available in Expo Go.',
      };
    }

    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      const subscriptionPurchases = results.filter((purchase) => getProductIds().includes(purchase.productId));

      if (subscriptionPurchases.length > 0) {
        const latestPurchase = subscriptionPurchases.sort(
          (a, b) => new Date(b.purchaseTime) - new Date(a.purchaseTime)
        )[0];

        const verificationResult = await verifyPurchaseReceipt(latestPurchase);
        if (verificationResult.success) {
          return { success: true, restored: true, productId: latestPurchase.productId };
        }
        return { success: false, error: verificationResult.error };
      }

      return { success: true, restored: false, message: 'No previous purchases found' };
    }

    throw new Error(`Restore failed with code: ${responseCode}`);
  } catch (error) {
    return { success: false, error: error.message };
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
    
    // PHASE 1.5 FIX: this used to read `users.premium_access`, a column a
    // client could set on itself (see the purchaseSubscription/
    // verifyPurchaseReceipt/activatePremiumSubscription fix notes above).
    // `subscriptions` is server-write-only (Edge Functions via
    // service_role) -- see supabase/migrations/003_authorization_and_schema_fixes.sql.
    const subscription = await getActiveSubscription(userId);
    if (subscription) {
      return {
        hasAccess: true,
        source: 'subscription',
        subscriptionType: subscription.plan,
        endDate: subscription.expires_at,
      };
    }

    return { hasAccess: false };
  } catch (error) {
    // Error checking premium access
    return { hasAccess: false, error: error.message };
  }
};

// PHASE 1.5: expireSubscription() was deleted here -- it wrote directly to
// `users.premium_access`/`subscription_status` (the same client-write
// vulnerability fixed elsewhere in this file) and is no longer needed:
// getActiveSubscription()'s `expires_at > now()` filter means an expired
// row in `subscriptions` simply stops being returned, with nothing to
// actively "expire" from the client.

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
