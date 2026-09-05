import { Platform, Alert } from 'react-native';
import EnvironmentDetector from '../utils/environmentDetection';

// Conditional import for expo-notifications
let ExpoNotifications = null;
try {
  // Only import if not in Expo Go SDK 53+
  if (!EnvironmentDetector.isExpoGo() || !EnvironmentDetector.isSDK53Plus()) {
    ExpoNotifications = require('expo-notifications');
  }
} catch (error) {
  console.warn('⚠️ expo-notifications not available:', error.message);
}

/**
 * Safe Notification Service for Expo SDK 53+
 * Automatically handles Expo Go vs Development Build differences
 * Provides fallbacks for unsupported features
 */

class SafeNotificationService {
  constructor() {
    this.isInitialized = false;
    this.notificationsModule = null;
    this.permissionStatus = 'undetermined';
    
    this.init();
  }

  async init() {
    try {
      // Check if push notifications are supported in current environment
      if (!EnvironmentDetector.isPushNotificationSupported()) {
        console.log('📱 Push notifications disabled in Expo Go SDK 53+');
        this.isInitialized = true;
        return;
      }

      // Use statically imported expo-notifications if supported
      if (EnvironmentDetector.isModuleSupported('expo-notifications')) {
        this.notificationsModule = ExpoNotifications;
        
        // Configure notification behavior
        await this.notificationsModule.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });

        console.log('✅ Notifications initialized successfully');
      } else {
        console.log('⚠️ Notifications module not available, using fallback mode');
      }

      this.isInitialized = true;
    } catch (error) {
      console.warn('⚠️ Notification service initialization failed, using fallback:', error);
      this.isInitialized = true; // Still mark as initialized to prevent retries
    }
  }

  /**
   * Request notification permissions (safe)
   */
  async requestPermissions() {
    try {
      if (!this.isInitialized) await this.init();

      if (!EnvironmentDetector.isPushNotificationSupported()) {
        console.log('📱 Notification permissions skipped in Expo Go');
        return { status: 'denied', canAskAgain: false };
      }

      if (!this.notificationsModule) {
        console.log('📱 Notification module not available');
        return { status: 'denied', canAskAgain: false };
      }

      const { status: existingStatus } = await this.notificationsModule.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await this.notificationsModule.requestPermissionsAsync();
        finalStatus = status;
      }

      this.permissionStatus = finalStatus;
      console.log('📱 Notification permission status:', finalStatus);
      
      return { status: finalStatus, canAskAgain: finalStatus !== 'denied' };
    } catch (error) {
      console.warn('⚠️ Permission request failed:', error);
      return { status: 'denied', canAskAgain: false };
    }
  }

  /**
   * Get push token (safe)
   */
  async getPushToken() {
    try {
      if (!this.isInitialized) await this.init();

      if (!EnvironmentDetector.isPushNotificationSupported()) {
        console.log('📱 Push token not available in Expo Go');
        return null;
      }

      if (!this.notificationsModule) {
        console.log('📱 Notification module not available for token');
        return null;
      }

      const { status } = await this.requestPermissions();
      if (status !== 'granted') {
        console.log('📱 Push token requires notification permission');
        return null;
      }

      const token = await this.notificationsModule.getExpoPushTokenAsync();
      console.log('📱 Push token obtained:', token.data);
      return token.data;
    } catch (error) {
      console.warn('⚠️ Push token request failed:', error);
      return null;
    }
  }

  /**
   * Schedule local notification (safe)
   */
  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      if (!this.isInitialized) await this.init();

      if (!EnvironmentDetector.isPushNotificationSupported()) {
        console.log('📱 Local notifications not available in Expo Go, showing alert instead');
        Alert.alert(title, body);
        return null;
      }

      if (!this.notificationsModule) {
        console.log('📱 Notification module not available, showing alert instead');
        Alert.alert(title, body);
        return null;
      }

      const notificationId = await this.notificationsModule.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: trigger || null, // null means immediate
      });

      console.log('📱 Local notification scheduled:', notificationId);
      return notificationId;
    } catch (error) {
      console.warn('⚠️ Local notification failed, showing alert instead:', error);
      Alert.alert(title, body);
      return null;
    }
  }

  /**
   * Cancel notification (safe)
   */
  async cancelNotification(notificationId) {
    try {
      if (!this.notificationsModule || !notificationId) return;

      await this.notificationsModule.cancelScheduledNotificationAsync(notificationId);
      console.log('📱 Notification cancelled:', notificationId);
    } catch (error) {
      console.warn('⚠️ Cancel notification failed:', error);
    }
  }

  /**
   * Cancel all notifications (safe)
   */
  async cancelAllNotifications() {
    try {
      if (!this.notificationsModule) return;

      await this.notificationsModule.cancelAllScheduledNotificationsAsync();
      console.log('📱 All notifications cancelled');
    } catch (error) {
      console.warn('⚠️ Cancel all notifications failed:', error);
    }
  }

  /**
   * Add notification listener (safe)
   */
  addNotificationListener(callback) {
    try {
      if (!this.notificationsModule) {
        console.log('📱 Notification listeners not available');
        return () => {}; // Return empty cleanup function
      }

      const subscription = this.notificationsModule.addNotificationReceivedListener(callback);
      return () => subscription.remove();
    } catch (error) {
      console.warn('⚠️ Add notification listener failed:', error);
      return () => {};
    }
  }

  /**
   * Add notification response listener (safe)
   */
  addNotificationResponseListener(callback) {
    try {
      if (!this.notificationsModule) {
        console.log('📱 Notification response listeners not available');
        return () => {};
      }

      const subscription = this.notificationsModule.addNotificationResponseReceivedListener(callback);
      return () => subscription.remove();
    } catch (error) {
      console.warn('⚠️ Add notification response listener failed:', error);
      return () => {};
    }
  }

  /**
   * Get notification settings (safe)
   */
  async getNotificationSettings() {
    try {
      if (!this.notificationsModule) {
        return {
          authorizationStatus: 'denied',
          soundSetting: 'disabled',
          badgeSetting: 'disabled',
          alertSetting: 'disabled',
        };
      }

      const settings = await this.notificationsModule.getPermissionsAsync();
      return settings;
    } catch (error) {
      console.warn('⚠️ Get notification settings failed:', error);
      return {
        authorizationStatus: 'denied',
        soundSetting: 'disabled',
        badgeSetting: 'disabled',
        alertSetting: 'disabled',
      };
    }
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return EnvironmentDetector.isPushNotificationSupported() && !!this.notificationsModule;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isSupported: this.isSupported(),
      isExpoGo: EnvironmentDetector.isExpoGo(),
      permissionStatus: this.permissionStatus,
      hasModule: !!this.notificationsModule
    };
  }
}

// Create singleton instance
const safeNotificationService = new SafeNotificationService();

export default safeNotificationService;
