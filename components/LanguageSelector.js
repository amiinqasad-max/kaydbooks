import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

const LanguageSelector = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, getAvailableLanguages } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const languages = getAvailableLanguages();
  
  // Debug: Log to ensure languages are available
  React.useEffect(() => {
    console.log('LanguageSelector - Languages:', languages);
    console.log('LanguageSelector - Visible:', visible);
  }, [languages, visible]);

  const handleLanguageSelect = async (languageCode) => {
    setSelectedLanguage(languageCode);
    await changeLanguage(languageCode);
    onClose();
  };

  const renderLanguageItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        selectedLanguage === item.code && styles.selectedLanguageItem
      ]}
      onPress={() => handleLanguageSelect(item.code)}
      activeOpacity={0.7}
    >
      <View style={styles.languageContent}>
        <View style={styles.languageInfo}>
          <Text style={[
            styles.languageName,
            selectedLanguage === item.code && styles.selectedLanguageText
          ]}>
            {item.name}
          </Text>
          <Text style={[
            styles.languageNative,
            selectedLanguage === item.code && styles.selectedLanguageText
          ]}>
            {item.nativeName}
          </Text>
        </View>
        
        {selectedLanguage === item.code && (
          <MaterialCommunityIcons 
            name="check-circle" 
            size={24} 
            color={COLORS.BUTTON} 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  // Fallback languages if getAvailableLanguages fails
  const fallbackLanguages = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'so', name: 'Somali', nativeName: 'Af-Soomaali' }
  ];
  
  const displayLanguages = languages && languages.length > 0 ? languages : fallbackLanguages;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('settings.selectLanguage')}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <MaterialCommunityIcons name="close" size={24} color={COLORS.TEXT} />
            </TouchableOpacity>
          </View>

          {/* Language List */}
          <FlatList
            data={displayLanguages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.languageList}
          />

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Text style={styles.footerText}>
              {t('settings.language')}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  modalContent: {
    width: '100%',
    minHeight: 350,
    maxHeight: '80%',
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    backgroundColor: COLORS.BACKGROUND,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.LG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageList: {
    padding: SPACING.LG,
  },
  languageItem: {
    marginBottom: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: 'rgba(250, 181, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedLanguageItem: {
    elevation: 4,
    shadowOpacity: 0.3,
    backgroundColor: COLORS.BUTTON,
    borderColor: COLORS.BUTTON,
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.LG,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  languageNative: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.8,
  },
  selectedLanguageText: {
    color: COLORS.BACKGROUND,
  },
  modalFooter: {
    padding: SPACING.LG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
  },
});

export default LanguageSelector;
