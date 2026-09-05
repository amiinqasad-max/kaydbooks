export const safeSplit = (value, separator = ',') => {
  try {
    // Comprehensive type and null checking
    if (value === null || value === undefined) return [];
    if (typeof value !== 'string') {
      // Try to convert to string safely
      try {
        value = String(value);
      } catch (conversionError) {
        return [];
      }
    }
    
    // Ensure separator is valid
    if (separator === null || separator === undefined) {
      separator = ',';
    }
    if (typeof separator !== 'string') {
      try {
        separator = String(separator);
      } catch (separatorError) {
        separator = ',';
      }
    }
    
    // Perform the split with error handling
    const result = value.split(separator);
    
    // Ensure result is an array
    if (!Array.isArray(result)) {
      return [];
    }
    
    return result;
  } catch (error) {
    // Ultimate fallback - return empty array
    return [];
  }
}
