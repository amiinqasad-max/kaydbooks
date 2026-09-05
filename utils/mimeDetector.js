/**
 * MIME TYPE DETECTION AND CORRECTION UTILITY
 * 
 * Fixes "mime type image is not supported" errors by detecting proper MIME types
 * from file extensions and content, ensuring correct contentType for Supabase uploads.
 */

/**
 * Comprehensive MIME type mapping for supported file types
 */
const MIME_TYPE_MAP = {
  // Image formats
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  
  // Document formats
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'txt': 'text/plain',
  
  // Audio formats
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  'flac': 'audio/flac',
  
  // Video formats (if needed)
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
};

/**
 * Extracts file extension from filename or URI
 * @param {string} filename - Filename or URI
 * @returns {string} - Lowercase file extension without dot
 */
const getFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Handle URIs and file paths
  const cleanName = filename.split('/').pop() || filename;
  const parts = cleanName.split('.');
  
  if (parts.length < 2) {
    return '';
  }

  return parts.pop().toLowerCase();
};

/**
 * Detects proper MIME type from file object
 * @param {Object} file - File object with name, type, and uri properties
 * @returns {string} - Proper MIME type
 */
export const detectMimeType = (file) => {
  if (!file) {
    console.warn('detectMimeType: No file provided');
    return 'application/octet-stream';
  }

  // First, try to get extension from filename
  let extension = '';
  
  if (file.name) {
    extension = getFileExtension(file.name);
  } else if (file.uri) {
    extension = getFileExtension(file.uri);
  }

  // Get MIME type from extension
  if (extension && MIME_TYPE_MAP[extension]) {
    const detectedMime = MIME_TYPE_MAP[extension];
    console.log(`detectMimeType: Detected ${detectedMime} from extension .${extension}`);
    return detectedMime;
  }

  // Fallback: try to use provided type if it's specific enough
  if (file.type && file.type !== 'image' && file.type.includes('/')) {
    console.log(`detectMimeType: Using provided type ${file.type}`);
    return file.type;
  }

  // Last resort: guess based on generic type
  if (file.type === 'image') {
    console.warn('detectMimeType: Generic "image" type detected, defaulting to image/jpeg');
    return 'image/jpeg';
  }

  console.warn('detectMimeType: Could not determine MIME type, using default');
  return 'application/octet-stream';
};

/**
 * Validates if MIME type is supported for upload
 * @param {string} mimeType - MIME type to validate
 * @returns {boolean} - True if supported
 */
export const isSupportedMimeType = (mimeType) => {
  const supportedTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'text/plain',
    
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/mp4',
    'audio/flac',
  ];

  return supportedTypes.includes(mimeType);
};

/**
 * Gets appropriate file category based on MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} - File category (image, document, audio, other)
 */
export const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
    return 'document';
  }
  
  return 'other';
};

/**
 * Corrects file object with proper MIME type
 * @param {Object} file - Original file object
 * @returns {Object} - File object with corrected MIME type
 */
export const correctFileMimeType = (file) => {
  if (!file) {
    return file;
  }

  const correctedFile = { ...file };
  const detectedMime = detectMimeType(file);
  
  // Always use detected MIME type
  correctedFile.type = detectedMime;
  
  console.log(`correctFileMimeType: Corrected ${file.type || 'unknown'} to ${detectedMime}`);
  
  return correctedFile;
};

/**
 * Validates file for upload
 * @param {Object} file - File object to validate
 * @returns {Object} - Validation result with success boolean and error message
 */
export const validateFileForUpload = (file) => {
  if (!file) {
    return {
      success: false,
      error: 'No file provided'
    };
  }

  if (!file.uri) {
    return {
      success: false,
      error: 'File URI is required'
    };
  }

  const mimeType = detectMimeType(file);
  
  if (!isSupportedMimeType(mimeType)) {
    return {
      success: false,
      error: `Unsupported file type: ${mimeType}`
    };
  }

  return {
    success: true,
    mimeType: mimeType,
    category: getFileCategory(mimeType)
  };
};

export default {
  detectMimeType,
  correctFileMimeType,
  validateFileForUpload,
  isSupportedMimeType,
  getFileCategory,
};
