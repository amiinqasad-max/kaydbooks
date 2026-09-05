import i18n from '../i18n/index.js';

/**
 * Language switching utilities for Kayd Books app
 * Ensures consistent language switching across all screens
 */

// Force re-render of all components when language changes
export const forceLanguageUpdate = () => {
  // This will trigger a re-render of all components using useTranslation
  i18n.emit('languageChanged');
};

// Get current language
export const getCurrentLanguage = () => {
  return i18n.language;
};

// Change language and force update
export const changeAppLanguage = async (languageCode) => {
  try {
    await i18n.changeLanguage(languageCode);
    forceLanguageUpdate();
    return true;
  } catch (error) {
    // Error changing language
    return false;
  }
};

// Check if translation key exists
export const hasTranslation = (key) => {
  return i18n.exists(key);
};

// Get translation with fallback
export const getTranslation = (key, fallback = key) => {
  return i18n.exists(key) ? i18n.t(key) : fallback;
};

// Common translations that are used across multiple screens
export const commonTranslations = {
  // Navigation
  home: () => i18n.t('navigation.home'),
  library: () => i18n.t('navigation.library'),
  explore: () => i18n.t('navigation.explore'),
  profile: () => i18n.t('navigation.profile'),
  
  // Common actions
  cancel: () => i18n.t('common.cancel'),
  confirm: () => i18n.t('common.confirm'),
  save: () => i18n.t('common.save'),
  delete: () => i18n.t('common.delete'),
  edit: () => i18n.t('common.edit'),
  done: () => i18n.t('common.done'),
  loading: () => i18n.t('common.loading'),
  error: () => i18n.t('common.error'),
  success: () => i18n.t('common.success'),
  
  // Book actions
  readNow: () => i18n.t('bookDetail.readNow'),
  addToFavorites: () => i18n.t('bookDetail.addToFavorites'),
  removeFromFavorites: () => i18n.t('bookDetail.removeFromFavorites'),
  download: () => i18n.t('bookDetail.download'),
  
  // Search
  searchPlaceholder: () => i18n.t('home.searchPlaceholder'),
  noResults: () => i18n.t('explore.noResults'),
  
  // Empty states
  noBooks: () => i18n.t('library.noBooks'),
  noFavorites: () => i18n.t('library.noFavoritesYet'),
  noDownloads: () => i18n.t('library.noDownloadsYet'),
};

// Language options for language selector
export const getLanguageOptions = () => [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  },
  {
    code: 'so',
    name: 'Somali',
    nativeName: 'Af-Soomaali',
    flag: '🇸🇴'
  }
];

// Get language display name
export const getLanguageDisplayName = (code) => {
  const languages = getLanguageOptions();
  const language = languages.find(lang => lang.code === code);
  return language ? language.nativeName : code;
};

// Validate language code
export const isValidLanguageCode = (code) => {
  const validCodes = getLanguageOptions().map(lang => lang.code);
  return validCodes.includes(code);
};

export default {
  forceLanguageUpdate,
  getCurrentLanguage,
  changeAppLanguage,
  hasTranslation,
  getTranslation,
  commonTranslations,
  getLanguageOptions,
  getLanguageDisplayName,
  isValidLanguageCode,
};
