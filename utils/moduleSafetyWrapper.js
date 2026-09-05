import EnvironmentDetector from './environmentDetection';

/**
 * Module Safety Wrapper for Expo SDK 53+
 * Provides safe imports and fallbacks for potentially unsupported modules
 * NOTE: No dynamic imports used - all imports must be static
 */

// Global safe mode enforcement
globalThis.EXPO_GO_SAFE_MODE = true;

/**
 * Safe module import wrapper - STATIC IMPORTS ONLY
 * This function now only provides environment checking
 * All actual imports must be done statically at the top of files
 */
export function safeImport(moduleName, moduleReference, fallback = null) {
  try {
    // Check if module is supported in current environment
    if (!EnvironmentDetector.isModuleSupported(moduleName)) {
      console.warn(`⚠️ Module ${moduleName} not supported in current environment, using fallback`);
      return fallback;
    }

    // Return the statically imported module reference
    if (moduleReference) {
      console.log(`✅ Module ${moduleName} is supported and available`);
      return moduleReference;
    }

    console.warn(`⚠️ Module ${moduleName} reference not provided, using fallback`);
    return fallback;
  } catch (error) {
    console.warn(`⚠️ Failed to validate ${moduleName}, using fallback:`, error);
    return fallback;
  }
}

/**
 * Safe component wrapper - prevents crashes from unsupported components
 */
export function safeComponent(Component, fallbackComponent = null) {
  if (!Component) {
    console.warn('⚠️ Component not available, using fallback');
    return fallbackComponent || (() => null);
  }

  return (props) => {
    try {
      if (EnvironmentDetector.isSafeMode() && !EnvironmentDetector.isModuleSupported(Component.name)) {
        console.warn(`⚠️ Component ${Component.name} not supported in safe mode`);
        return fallbackComponent ? fallbackComponent(props) : null;
      }

      return Component(props);
    } catch (error) {
      console.warn(`⚠️ Component ${Component.name} crashed, using fallback:`, error);
      return fallbackComponent ? fallbackComponent(props) : null;
    }
  };
}

/**
 * Safe function wrapper - prevents crashes from unsupported functions
 */
export function safeFunction(fn, fallbackFn = null) {
  return async (...args) => {
    try {
      if (EnvironmentDetector.isSafeMode() && typeof fn !== 'function') {
        console.warn('⚠️ Function not available in safe mode, using fallback');
        return fallbackFn ? await fallbackFn(...args) : null;
      }

      return await fn(...args);
    } catch (error) {
      console.warn('⚠️ Function call failed, using fallback:', error);
      return fallbackFn ? await fallbackFn(...args) : null;
    }
  };
}

/**
 * Device support checker
 */
export function isDeviceSupported(feature) {
  const supportMatrix = {
    'push-notifications': EnvironmentDetector.isPushNotificationSupported(),
    'audio-playback': EnvironmentDetector.isAudioSupported(),
    'background-tasks': !EnvironmentDetector.isExpoGo(),
    'native-modules': !EnvironmentDetector.isExpoGo(),
    'expo-av': !EnvironmentDetector.isSDK53Plus(),
    'expo-audio': EnvironmentDetector.isSDK53Plus(),
    'expo-video': EnvironmentDetector.isSDK53Plus(),
    'react-native-track-player': !EnvironmentDetector.isExpoGo()
  };

  const isSupported = supportMatrix[feature] ?? true;
  
  if (!isSupported) {
    console.warn(`⚠️ Feature ${feature} not supported in current environment`);
  }

  return isSupported;
}

/**
 * Safe API call wrapper
 */
export async function safeApiCall(apiCall, fallbackValue = null) {
  try {
    if (EnvironmentDetector.isSafeMode()) {
      console.log('🔒 API call in safe mode');
    }

    const result = await apiCall();
    return result;
  } catch (error) {
    console.warn('⚠️ API call failed, returning fallback:', error);
    return fallbackValue;
  }
}

/**
 * Safe permission request
 */
export async function safePermissionRequest(permissionType, requestFn, fallbackStatus = 'denied') {
  try {
    if (EnvironmentDetector.isExpoGo() && ['notifications', 'background-refresh'].includes(permissionType)) {
      console.warn(`⚠️ Permission ${permissionType} not available in Expo Go`);
      return { status: fallbackStatus, canAskAgain: false };
    }

    return await requestFn();
  } catch (error) {
    console.warn(`⚠️ Permission request for ${permissionType} failed:`, error);
    return { status: fallbackStatus, canAskAgain: false };
  }
}

/**
 * Module compatibility checker
 */
export function checkModuleCompatibility() {
  const modules = [
    'expo-notifications',
    'expo-av',
    'expo-audio',
    'expo-video',
    'react-native-track-player'
  ];

  const compatibility = {};

  modules.forEach(module => {
    compatibility[module] = {
      supported: EnvironmentDetector.isModuleSupported(module),
      reason: getCompatibilityReason(module)
    };
  });

  console.log('🔍 Module Compatibility Check:', compatibility);
  return compatibility;
}

function getCompatibilityReason(module) {
  const isExpoGo = EnvironmentDetector.isExpoGo();
  const isSDK53Plus = EnvironmentDetector.isSDK53Plus();

  switch (module) {
    case 'expo-notifications':
      return isExpoGo && isSDK53Plus ? 'Removed from Expo Go in SDK 53+' : 'Supported';
    
    case 'expo-av':
      return isSDK53Plus ? 'Deprecated in SDK 53+, use expo-audio/expo-video' : 'Supported';
    
    case 'expo-audio':
    case 'expo-video':
      return isSDK53Plus ? 'Supported' : 'Not available in SDK < 53';
    
    case 'react-native-track-player':
      return isExpoGo ? 'Not supported in Expo Go' : 'Supported';
    
    default:
      return 'Unknown';
  }
}

/**
 * Safe initialization wrapper
 */
export async function safeInitialize(initFn, moduleName = 'Unknown') {
  try {
    console.log(`🚀 Initializing ${moduleName}...`);
    
    if (EnvironmentDetector.isSafeMode()) {
      console.log(`🔒 ${moduleName} initializing in safe mode`);
    }

    await initFn();
    console.log(`✅ ${moduleName} initialized successfully`);
  } catch (error) {
    console.warn(`⚠️ ${moduleName} initialization failed, continuing in safe mode:`, error);
  }
}

// Run compatibility check on import
checkModuleCompatibility();

export default {
  safeImport,
  safeComponent,
  safeFunction,
  isDeviceSupported,
  safeApiCall,
  safePermissionRequest,
  checkModuleCompatibility,
  safeInitialize
};
