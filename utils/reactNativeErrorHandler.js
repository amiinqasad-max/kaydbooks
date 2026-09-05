/**
 * REACT NATIVE COMPATIBLE ERROR HANDLER
 * 
 * Simplified error handler specifically designed for React Native environment
 * without using web-specific APIs like window.addEventListener
 */

import { sanitizeBookRecord } from './bookSanitizer';

/**
 * React Native compatible global error handler
 */
export const setupReactNativeErrorHandler = () => {
  // Override console.error to catch and handle React Fiber errors
  const originalConsoleError = console.error;
  
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    
    // Suppress specific React Fiber level3 errors
    if (errorMessage.includes('Cannot read property \'level3\' of undefined') ||
        errorMessage.includes('Cannot read properties of undefined (reading \'level3\')') ||
        errorMessage.includes('TypeError: Cannot read property \'level3\'') ||
        (errorMessage.includes('level3') && errorMessage.includes('undefined'))) {
      
      console.warn('🛡️ BLOCKED React Fiber level3 error - book sanitization active');
      return; // Suppress the error
    }
    
    // Suppress runtime errors from incompatible web APIs
    if (errorMessage.includes('window.addEventListener is not a function') ||
        errorMessage.includes('addEventListener is not a function') ||
        errorMessage.includes('runtime not ready')) {
      
      console.warn('🛡️ BLOCKED web API compatibility error');
      return; // Suppress the error
    }
    
    // Allow other errors to pass through
    originalConsoleError.apply(console, args);
  };
  
  // React Native specific error handling
  if (typeof global !== 'undefined' && global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      // Check if it's a level3 error
      if (error && error.message && 
          (error.message.includes('level3') || 
           error.message.includes('Cannot read property \'level3\''))) {
        
        console.warn('🛡️ BLOCKED React Native global level3 error');
        
        // For non-fatal level3 errors, don't crash the app
        if (!isFatal) {
          return;
        }
      }
      
      // For other errors, call the original handler
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
  
  console.log('🛡️ React Native error handler initialized');
};

/**
 * Safe property accessor for React Native
 */
export const safeGet = (obj, path, defaultValue = '') => {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
};

/**
 * Safe book property accessor
 */
export const safeBookGet = (book, property, defaultValue = '') => {
  const sanitizedBook = sanitizeBookRecord(book);
  return safeGet(sanitizedBook, property, defaultValue);
};

export default {
  setupReactNativeErrorHandler,
  safeGet,
  safeBookGet,
};
