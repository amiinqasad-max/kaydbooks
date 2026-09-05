/**
 * UNIFIED BOOK SANITIZATION UTILITY
 * 
 * This utility ensures EVERY book object has safe defaults for all required fields
 * preventing "Cannot read property 'level3' of undefined" errors permanently.
 * 
 * MUST be applied to ALL database results BEFORE rendering, mapping, or state setting.
 */

/**
 * Safe book schema with guaranteed defaults - MINIMAL DATABASE COMPATIBLE VERSION
 * This prevents ANY undefined property access on book objects
 * Only includes columns that are guaranteed to exist in the database
 */
const SAFE_BOOK_SCHEMA = {
  // Core identification
  id: '',
  
  // Basic book information (guaranteed to exist)
  title: '',
  author: '',
  description: '',
  category: '',
  
  // URLs and paths (guaranteed to exist)
  cover_url: '',
  pdf_url: '',
  audio_url: '',
  
  // Critical level properties (source of level3 undefined errors)
  level1: '',
  level2: '',
  level3: '',
  
  // Metadata (may or may not exist in database)
  isbn: '',
  publication_year: '',
  page_count: 0,
  
  // Timestamps (guaranteed to exist)
  created_at: '',
  
  // Additional safe defaults for UI compatibility
  language: 'en',
  file_size: 0,
  duration: 0,
  rating: 0,
  downloads: 0,
  views: 0,
  
  // Status flags (may not exist in database, but needed for UI)
  is_premium: false,
  is_featured: false,
  has_audio: false,
};

/**
 * Sanitizes a single book record ensuring all required fields exist
 * @param {Object|null|undefined} book - Raw book object from database
 * @returns {Object} - Sanitized book object with guaranteed safe defaults
 */
export const sanitizeBookRecord = (book) => {
  // Handle null, undefined, or non-object inputs
  if (!book || typeof book !== 'object') {
    console.warn('sanitizeBookRecord: Invalid book input, using safe defaults');
    return { ...SAFE_BOOK_SCHEMA };
  }

  // Create sanitized book with safe defaults, then override with actual values
  const sanitizedBook = {
    ...SAFE_BOOK_SCHEMA,
    ...book,
  };

  // Ensure critical level properties are never undefined
  sanitizedBook.level1 = sanitizedBook.level1 || '';
  sanitizedBook.level2 = sanitizedBook.level2 || '';
  sanitizedBook.level3 = sanitizedBook.level3 || '';

  // Ensure numeric fields are actually numbers
  sanitizedBook.page_count = Number(sanitizedBook.page_count) || 0;
  sanitizedBook.file_size = Number(sanitizedBook.file_size) || 0;
  sanitizedBook.duration = Number(sanitizedBook.duration) || 0;
  sanitizedBook.rating = Number(sanitizedBook.rating) || 0;
  sanitizedBook.downloads = Number(sanitizedBook.downloads) || 0;
  sanitizedBook.views = Number(sanitizedBook.views) || 0;

  // Ensure boolean fields are actually booleans
  sanitizedBook.is_premium = Boolean(sanitizedBook.is_premium);
  sanitizedBook.is_featured = Boolean(sanitizedBook.is_featured);
  sanitizedBook.has_audio = Boolean(sanitizedBook.has_audio);

  // Ensure string fields are actually strings
  sanitizedBook.id = String(sanitizedBook.id || '');
  sanitizedBook.title = String(sanitizedBook.title || '');
  sanitizedBook.author = String(sanitizedBook.author || '');
  sanitizedBook.description = String(sanitizedBook.description || '');
  sanitizedBook.category = String(sanitizedBook.category || '');
  sanitizedBook.cover_url = String(sanitizedBook.cover_url || '');
  sanitizedBook.pdf_url = String(sanitizedBook.pdf_url || '');
  sanitizedBook.audio_url = String(sanitizedBook.audio_url || '');
  sanitizedBook.isbn = String(sanitizedBook.isbn || '');
  sanitizedBook.publication_year = String(sanitizedBook.publication_year || '');
  sanitizedBook.language = String(sanitizedBook.language || 'en');

  return sanitizedBook;
};

/**
 * Sanitizes an array of book records
 * @param {Array|null|undefined} books - Array of raw book objects from database
 * @returns {Array} - Array of sanitized book objects
 */
export const sanitizeBookArray = (books) => {
  if (!Array.isArray(books)) {
    console.warn('sanitizeBookArray: Input is not an array, returning empty array');
    return [];
  }

  return books.map(sanitizeBookRecord);
};

/**
 * Deep sanitization for nested book objects (e.g., in progress records)
 * @param {Object} record - Record that may contain nested book object
 * @returns {Object} - Record with sanitized nested book
 */
export const sanitizeNestedBookRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const sanitizedRecord = { ...record };

  // Sanitize nested book object if it exists
  if (sanitizedRecord.book) {
    sanitizedRecord.book = sanitizeBookRecord(sanitizedRecord.book);
  }

  // Sanitize books array if it exists
  if (sanitizedRecord.books) {
    if (Array.isArray(sanitizedRecord.books)) {
      sanitizedRecord.books = sanitizeBookArray(sanitizedRecord.books);
    } else {
      sanitizedRecord.books = sanitizeBookRecord(sanitizedRecord.books);
    }
  }

  return sanitizedRecord;
};

/**
 * Validates that a book object has all required fields
 * @param {Object} book - Book object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateBookRecord = (book) => {
  if (!book || typeof book !== 'object') {
    return false;
  }

  // Check that critical properties exist and are not undefined
  const criticalFields = ['id', 'title', 'author', 'level1', 'level2', 'level3'];
  
  for (const field of criticalFields) {
    if (book[field] === undefined) {
      console.error(`validateBookRecord: Missing critical field '${field}'`);
      return false;
    }
  }

  return true;
};

export default {
  sanitizeBookRecord,
  sanitizeBookArray,
  sanitizeNestedBookRecord,
  validateBookRecord,
  SAFE_BOOK_SCHEMA,
};
