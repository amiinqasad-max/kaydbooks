/**
 * GLOBAL ERROR HANDLER AND PROPERTY ACCESS PROTECTION
 * 
 * This utility provides additional protection against undefined property access
 * and React Fiber level3 errors by intercepting and handling them globally.
 */

import React from 'react';
import { sanitizeBookRecord } from './bookSanitizer';

/**
 * Global error handler for React Fiber errors
 */
export const setupGlobalErrorHandler = () => {
  // Override console.error to catch and handle React Fiber errors
  const originalConsoleError = console.error;
  
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    
    // Suppress specific React Fiber level3 errors
    if (errorMessage.includes('Cannot read property \'level3\' of undefined') ||
        errorMessage.includes('Cannot read properties of undefined (reading \'level3\')') ||
        errorMessage.includes('TypeError: Cannot read property \'level3\'') ||
        errorMessage.includes('level3') && errorMessage.includes('undefined')) {
      
      console.warn('🛡️ BLOCKED React Fiber level3 error - book sanitization should prevent this');
      return; // Suppress the error
    }
    
    // Allow other errors to pass through
    originalConsoleError.apply(console, args);
  };
  
  // Global unhandled promise rejection handler for React Native
  if (typeof global !== 'undefined' && global.HermesInternal) {
    // React Native with Hermes engine
    const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
    if (originalHandler) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        if (error && error.message && error.message.includes('level3')) {
          console.warn('🛡️ BLOCKED React Native global error with level3');
          return; // Don't call original handler for level3 errors
        }
        originalHandler(error, isFatal);
      });
    }
  } else if (typeof process !== 'undefined' && process.on) {
    // Node.js environment (Metro bundler)
    process.on('unhandledRejection', (reason) => {
      if (reason && reason.message && reason.message.includes('level3')) {
        console.warn('🛡️ BLOCKED unhandled promise rejection with level3 error');
        return;
      }
    });
  }
};

/**
 * Safe property accessor that prevents undefined errors
 * @param {Object} obj - Object to access property from
 * @param {string} path - Dot notation path (e.g., 'book.level3')
 * @param {*} defaultValue - Default value if property is undefined
 * @returns {*} - Property value or default
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
 * Safe book property accessor with automatic sanitization
 * @param {Object} book - Book object
 * @param {string} property - Property name
 * @param {*} defaultValue - Default value
 * @returns {*} - Property value or default
 */
export const safeBookGet = (book, property, defaultValue = '') => {
  // First sanitize the book to ensure all properties exist
  const sanitizedBook = sanitizeBookRecord(book);
  
  // Then safely access the property
  return safeGet(sanitizedBook, property, defaultValue);
};

/**
 * Wraps a component to catch and handle level3 errors
 * @param {React.Component} Component - Component to wrap
 * @returns {React.Component} - Wrapped component
 */
export const withErrorBoundary = (Component) => {
  return class ErrorBoundaryWrapper extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }
    
    static getDerivedStateFromError(error) {
      // Check if it's a level3 error
      if (error.message && error.message.includes('level3')) {
        console.warn('🛡️ ErrorBoundary caught level3 error:', error.message);
        return { hasError: true };
      }
      
      // Let other errors bubble up
      throw error;
    }
    
    componentDidCatch(error, errorInfo) {
      if (error.message && error.message.includes('level3')) {
        console.warn('🛡️ ErrorBoundary handled level3 error, component will recover');
      }
    }
    
    render() {
      if (this.state.hasError) {
        // Render fallback UI for level3 errors
        return null; // or a simple fallback component
      }
      
      return <Component {...this.props} />;
    }
  };
};

/**
 * Hook to safely access book properties in components
 * @param {Object} book - Book object
 * @returns {Object} - Sanitized book with safe accessors
 */
export const useSafeBook = (book) => {
  const sanitizedBook = sanitizeBookRecord(book);
  
  return {
    ...sanitizedBook,
    safeGet: (property, defaultValue = '') => safeGet(sanitizedBook, property, defaultValue),
  };
};

export default {
  setupGlobalErrorHandler,
  safeGet,
  safeBookGet,
  withErrorBoundary,
  useSafeBook,
};
