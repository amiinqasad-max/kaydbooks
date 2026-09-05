import { supabase } from './supabase';
// import * as InAppPurchases from 'expo-in-app-purchases';
import { Platform } from 'react-native';

/**
 * Enhanced Subscription Service for Kayd Books
 * Handles subscription management, in-app purchases, and local payments
 */

// Product IDs for in-app purchases
export const SUBSCRIPTION_PRODUCTS = {
  TRIAL: 'kayd_books_trial',
  MONTHLY: 'kayd_books_monthly',
  YEARLY: 'kayd_books_yearly',
};

// Global trial expiration check function
export const isTrialExpired = (endDate) => {
  if (!endDate) return true;
  return new Date(endDate).getTime() < Date.now();
};

// Check if user should see subscription screen
export const shouldShowSubscriptionScreen = async (userId) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('premium, subscription_end')
      .eq('id', userId)
      .single();

    if (error) throw error;

    if (!user.premium) return true;
    
    if (user.subscription_end) {
      const subscriptionEnd = new Date(user.subscription_end);
      const now = new Date();
      return subscriptionEnd <= now;
    }

    return true;
  } catch (error) {
    return true; // Show by default if error
  }
};

// Get user subscription status
export const getUserSubscription = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('premium, subscription_plan, subscription_start, subscription_end')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    return null;
  }
};

// Check if user has active subscription
export const hasActiveSubscription = async (userId) => {
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !subscription.premium) return false;
    
    if (subscription.subscription_end) {
      const expiryDate = new Date(subscription.subscription_end);
      const now = new Date();
      return expiryDate > now;
    }
    
    return subscription.premium;
  } catch (error) {
    return false;
  }
};

// Initialize in-app purchases
export const initializeInAppPurchases = async () => {
  try {
    // TODO: Implement when expo-in-app-purchases is properly configured
    // In-app purchases initialization - Coming soon
    return [];
  } catch (error) {
    throw error;
  }
};

// Activate free trial
export const activateFreeTrial = async (userId) => {
  try {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const { error } = await supabase
      .from('users')
      .update({
        premium: true,
        subscription_plan: 'trial',
        subscription_start: now.toISOString(),
        subscription_end: trialEnd.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    return { success: true, subscriptionEnd: trialEnd.toISOString() };
  } catch (error) {
    throw error;
  }
};

// Purchase subscription with in-app purchase
export const purchaseSubscription = async (userId, plan, productId) => {
  try {
    // TODO: Implement when expo-in-app-purchases is properly configured
    throw new Error('In-app purchases not yet configured. Please use local payment option.');
  } catch (error) {
    throw error;
  }
};

// Verify local payment
export const verifyLocalPayment = async (userId, plan, transactionCode) => {
  try {
    const result = await fetch(`${supabase.supabaseUrl}/functions/v1/verify-local-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`,
      },
      body: JSON.stringify({
        transactionCode,
        userId,
        plan
      })
    });

    const data = await result.json();
    
    if (data.success) {
      return { success: true, subscriptionEnd: data.subscriptionEnd, message: data.message };
    } else {
      throw new Error(data.error || 'Payment verification failed');
    }
  } catch (error) {
    throw error;
  }
};

// Create local payment record (for admin use)
export const createLocalPaymentRecord = async (plan, amount, transactionCode) => {
  try {
    const { data, error } = await supabase
      .from('local_payments')
      .insert({
        plan,
        transaction_code: transactionCode,
        amount,
        verified: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    throw error;
  }
};

// Get subscription plans
export const getSubscriptionPlans = () => {
  return [
    {
      id: 'trial',
      name: '7 Days Free Trial',
      price: 'Free',
      duration: '7 days',
      features: [
        'Access to all premium books',
        'Unlimited audiobooks',
        'Offline reading',
        'No ads',
      ],
      popular: false,
      productId: SUBSCRIPTION_PRODUCTS.TRIAL,
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '$4.99',
      duration: 'per month',
      features: [
        'Access to all premium books',
        'Unlimited audiobooks',
        'Offline reading',
        'No ads',
        'Priority support',
      ],
      popular: true,
      productId: SUBSCRIPTION_PRODUCTS.MONTHLY,
    },
    {
      id: 'yearly',
      name: 'Yearly Plan',
      price: '$49.99',
      duration: 'per year',
      originalPrice: '$59.88',
      savings: 'Save $9.89',
      features: [
        'Access to all premium books',
        'Unlimited audiobooks',
        'Offline reading',
        'No ads',
        'Priority support',
        'Exclusive content',
      ],
      popular: false,
      productId: SUBSCRIPTION_PRODUCTS.YEARLY,
    },
  ];
};

// Restore purchases
export const restorePurchases = async (userId) => {
  try {
    // TODO: Implement when expo-in-app-purchases is properly configured
    return { success: true, restored: false };
  } catch (error) {
    throw error;
  }
};

// Disconnect in-app purchases
export const disconnectInAppPurchases = async () => {
  try {
    // TODO: Implement when expo-in-app-purchases is properly configured
    // In-app purchases disconnect - Coming soon
  } catch (error) {
    // Error disconnecting in-app purchases
  }
};
