import { Platform } from 'react-native';

// Conditional import for expo-constants
let Constants = null;
try {
  Constants = require('expo-constants');
} catch (error) {
  // expo-constants not available
  // Provide fallback constants
  Constants = {
    appOwnership: 'standalone',
    executionEnvironment: 'standalone',
    expoVersion: '53.0.0',
    manifest: null,
    manifest2: null
  };
}

/**
 * Environment Detection Utility for Expo SDK 53+
 * Automatically detects if app is running in Expo Go vs Development Build
 * and provides safe fallbacks for unsupported features
 */

// Global safe mode flag
globalThis.EXPO_GO_SAFE_MODE = true;

export class EnvironmentDetector {
  static _isExpoGo = null;
  static _isDevBuild = null;
  static _sdkVersion = null;

  /**
   * Detect if running in Expo Go
   */
  static isExpoGo() {
    if (this._isExpoGo !== null) return this._isExpoGo;

    try {
      // Multiple detection methods for reliability
      const isExpoGoByAppOwnership = Constants.appOwnership === 'expo';
      const isExpoGoByExecutionEnvironment = Constants.executionEnvironment === 'storeClient';
      const isExpoGoByManifest = Constants.manifest?.slug === 'expo-go' || 
                                 Constants.manifest2?.slug === 'expo-go';
      
      // Check if we're in Expo Go client
      this._isExpoGo = isExpoGoByAppOwnership || 
                       isExpoGoByExecutionEnvironment || 
                       isExpoGoByManifest ||
                       __DEV__ && !Constants.manifest?.extra?.isDev;

      return this._isExpoGo;
    } catch (error) {
      // Environment detection failed, defaulting to Expo Go mode
      this._isExpoGo = true; // Safe default
      return this._isExpoGo;
    }
  }

  /**
   * Detect if running in Development Build
   */
  static isDevBuild() {
    if (this._isDevBuild !== null) return this._isDevBuild;
    
    this._isDevBuild = !this.isExpoGo() && __DEV__;
    return this._isDevBuild;
  }

  /**
   * Detect if running in Production Build
   */
  static isProductionBuild() {
    return !this.isExpoGo() && !__DEV__;
  }

  /**
   * Get SDK version
   */
  static getSDKVersion() {
    if (this._sdkVersion !== null) return this._sdkVersion;

    try {
      this._sdkVersion = parseInt(Constants.expoVersion?.split('.')[0] || '53');
      return this._sdkVersion;
    } catch (error) {
      // SDK version detection failed, defaulting to 53
      this._sdkVersion = 53;
      return this._sdkVersion;
    }
  }

  /**
   * Check if SDK version is 53 or higher
   */
  static isSDK53Plus() {
    return this.getSDKVersion() >= 53;
  }

  /**
   * Check if push notifications are supported
   */
  static isPushNotificationSupported() {
    const isSupported = !this.isExpoGo() || !this.isSDK53Plus();
    return isSupported;
  }

  /**
   * Check if audio features are supported
   */
  static isAudioSupported() {
    return true;
  }

  /**
   * Check if a specific module is supported
   */
  static isModuleSupported(moduleName) {
    const unsupportedInExpoGo = [
      'expo-notifications', // Push notifications removed in SDK 53
      'react-native-track-player', // Not supported in Expo Go
      'expo-av' // Deprecated in SDK 53+
    ];

    if (this.isExpoGo() && this.isSDK53Plus()) {
      const isUnsupported = unsupportedInExpoGo.includes(moduleName);
      if (isUnsupported) {
      }
      return !isUnsupported;
    }

    return true; // All modules supported in dev/production builds
  }

  /**
   * Get safe mode status
   */
  static isSafeMode() {
    return globalThis.EXPO_GO_SAFE_MODE && this.isExpoGo();
  }

  /**
   * Log environment info
   */
  static logEnvironmentInfo() {
  }
}

// Initialize and log on import
EnvironmentDetector.logEnvironmentInfo();

export default EnvironmentDetector;
