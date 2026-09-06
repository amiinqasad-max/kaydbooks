import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n/index.js';
import { changeAppLanguage, getLanguageOptions, getLanguageDisplayName } from '../utils/languageUtils';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const { i18n: i18nInstance } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  // PHASE 1.7: moved above the useEffect that calls it -- see
  // components/PremiumGate.js for the full rationale.
  async function loadSavedLanguage() {
    try {
      const savedLanguage = await AsyncStorage.getItem('user-language');
      if (savedLanguage) {
        setCurrentLanguage(savedLanguage);
        await i18nInstance.changeLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading saved language:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const changeLanguage = async (languageCode) => {
    try {
      const success = await changeAppLanguage(languageCode);
      if (success) {
        setCurrentLanguage(languageCode);
        await AsyncStorage.setItem('user-language', languageCode);
        
        // Force re-render of all components
        setTimeout(() => {
          setCurrentLanguage(prev => prev === languageCode ? languageCode + '_temp' : languageCode);
          setTimeout(() => setCurrentLanguage(languageCode), 50);
        }, 100);
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const getLanguageName = (code) => {
    const languages = {
      en: 'English',
      so: 'Soomaali'
    };
    return languages[code] || 'English';
  };

  const getAvailableLanguages = () => getLanguageOptions();

  const isRTL = () => {
    // Somali is LTR (Left-to-Right), but you can add RTL languages here
    return false;
  };

  const value = {
    currentLanguage,
    changeLanguage,
    getLanguageName,
    getAvailableLanguages,
    isRTL,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
