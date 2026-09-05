import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  Animated,
  useColorScheme,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const DeleteAccountScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmationChecks, setConfirmationChecks] = useState({
    irreversible: false,
    dataDeleted: false,
  });
  const [confirmationText, setConfirmationText] = useState('');
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  
  const colorScheme = useColorScheme();
  const { signOut } = useAuth();
  
  // Theme colors based on color scheme
  const theme = {
    background: colorScheme === 'dark' ? COLORS.BACKGROUND : '#FFFFFF',
    surface: colorScheme === 'dark' ? COLORS.BACKGROUND : '#F8F9FA',
    text: colorScheme === 'dark' ? COLORS.TEXT : '#1A1A1A',
    textSecondary: colorScheme === 'dark' ? COLORS.TEXT_SECONDARY : '#6B7280',
    border: colorScheme === 'dark' ? COLORS.BORDER : '#E5E7EB',
    error: COLORS.ERROR,
    errorLight: COLORS.ERROR_LIGHT,
  };

  useEffect(() => {
    // Animate step entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  const resetAnimations = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
  };

  const handleNextStep = () => {
    if (currentStep < 4) {
      resetAnimations();
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      resetAnimations();
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCheckboxChange = (key) => {
    setConfirmationChecks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isStep2Valid = () => {
    return confirmationChecks.irreversible && confirmationChecks.dataDeleted;
  };

  const isStep3Valid = () => {
    return confirmationText.trim() === 'DELETE MY ACCOUNT';
  };

  const handleFinalDelete = async () => {
    try {
      setLoading(true);
      
      // Simulate account deletion process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Sign out user
      await signOut();
      
      // Navigate back to auth flow
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
      setShowFinalModal(false);
    }
  };

  // Step 1: Primary Warning
  const renderStep1 = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons name="warning" size={80} color={theme.error} />
      </View>
      
      <Text style={[styles.title, { color: theme.error }]}>Delete Your Account</Text>
      
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        This action will permanently delete your account and all associated data including:
      </Text>
      
      <View style={styles.warningList}>
        <View style={styles.warningItem}>
          <MaterialIcons name="close" size={20} color={theme.error} />
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            All your downloaded books and audiobooks
          </Text>
        </View>
        <View style={styles.warningItem}>
          <MaterialIcons name="close" size={20} color={theme.error} />
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            Your reading progress and bookmarks
          </Text>
        </View>
        <View style={styles.warningItem}>
          <MaterialIcons name="close" size={20} color={theme.error} />
          <Text style={[styles.warningText, { color: theme.textSecondary }]}>
            Account settings and preferences
          </Text>
        </View>
      </View>
      
      <Text style={[styles.cautionText, { color: theme.error }]}>
        ⚠️ This action cannot be undone
      </Text>
    </Animated.View>
  );

  // Step 2: Checkbox Confirmations
  const renderStep2 = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={80} color={theme.error} />
      </View>
      
      <Text style={[styles.title, { color: theme.text }]}>Confirm Your Decision</Text>
      
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        Please confirm that you understand the consequences of this action:
      </Text>
      
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() => handleCheckboxChange('irreversible')}
        >
          <View style={[
            styles.checkbox,
            { borderColor: theme.border },
            confirmationChecks.irreversible && { backgroundColor: theme.error, borderColor: theme.error }
          ]}>
            {confirmationChecks.irreversible && (
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.checkboxText, { color: theme.text }]}>
            I understand this action is irreversible
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() => handleCheckboxChange('dataDeleted')}
        >
          <View style={[
            styles.checkbox,
            { borderColor: theme.border },
            confirmationChecks.dataDeleted && { backgroundColor: theme.error, borderColor: theme.error }
          ]}>
            {confirmationChecks.dataDeleted && (
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            )}
          </View>
          <Text style={[styles.checkboxText, { color: theme.text }]}>
            I want all my data permanently deleted
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  // Step 3: Type to Confirm
  const renderStep3 = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons name="keyboard" size={80} color={theme.error} />
      </View>
      
      <Text style={[styles.title, { color: theme.text }]}>Type to Confirm</Text>
      
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        To proceed, please type the following text exactly as shown:
      </Text>
      
      <View style={[styles.confirmationTextContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.confirmationTextExample, { color: theme.error }]}>
          DELETE MY ACCOUNT
        </Text>
      </View>
      
      <TextInput
        style={[
          styles.textInput,
          { 
            backgroundColor: theme.surface,
            borderColor: isStep3Valid() ? theme.error : theme.border,
            color: theme.text
          }
        ]}
        placeholder="Type here..."
        placeholderTextColor={theme.textSecondary}
        value={confirmationText}
        onChangeText={setConfirmationText}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      
      {confirmationText && !isStep3Valid() && (
        <Text style={[styles.validationText, { color: theme.error }]}>
          Text doesn't match. Please type exactly: DELETE MY ACCOUNT
        </Text>
      )}
    </Animated.View>
  );

  // Final Confirmation Modal
  const renderFinalModal = () => (
    <Modal
      visible={showFinalModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowFinalModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={styles.modalIconContainer}>
            <MaterialIcons name="delete-forever" size={60} color={theme.error} />
          </View>
          
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Final Confirmation
          </Text>
          
          <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
            Are you absolutely sure you want to delete your account? This action cannot be undone.
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: theme.border }]}
              onPress={() => setShowFinalModal(false)}
              disabled={loading}
            >
              <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalDeleteButton, loading && styles.disabledButton]}
              onPress={handleFinalDelete}
              disabled={loading}
            >
              <Text style={styles.modalDeleteText}>
                {loading ? 'Deleting...' : 'Delete Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const getCurrentStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  const getNextButtonText = () => {
    switch (currentStep) {
      case 1:
        return 'Continue';
      case 2:
        return 'Next';
      case 3:
        return 'Delete Account';
      default:
        return 'Continue';
    }
  };

  const isNextButtonEnabled = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return isStep2Valid();
      case 3:
        return isStep3Valid();
      default:
        return false;
    }
  };

  const handleNextButtonPress = () => {
    if (currentStep === 3) {
      setShowFinalModal(true);
    } else {
      handleNextStep();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Delete Account
          </Text>
          
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map((step) => (
            <View key={step} style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                { 
                  backgroundColor: step <= currentStep ? theme.error : theme.border,
                  borderColor: step <= currentStep ? theme.error : theme.border
                }
              ]}>
                {step < currentStep && (
                  <MaterialIcons name="check" size={16} color="#FFFFFF" />
                )}
                {step === currentStep && (
                  <Text style={[styles.progressNumber, { color: '#FFFFFF' }]}>{step}</Text>
                )}
                {step > currentStep && (
                  <Text style={[styles.progressNumber, { color: theme.textSecondary }]}>{step}</Text>
                )}
              </View>
              {step < 3 && (
                <View style={[
                  styles.progressLine,
                  { backgroundColor: step < currentStep ? theme.error : theme.border }
                ]} />
              )}
            </View>
          ))}
        </View>

        {/* Step Content */}
        <View style={styles.content}>
          {getCurrentStepContent()}
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={[styles.backStepButton, { borderColor: theme.border }]}
              onPress={handlePrevStep}
            >
              <Text style={[styles.backStepText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              { backgroundColor: isNextButtonEnabled() ? theme.error : theme.border },
              !isNextButtonEnabled() && styles.disabledButton,
              currentStep === 1 && styles.fullWidthButton
            ]}
            onPress={handleNextButtonPress}
            disabled={!isNextButtonEnabled()}
          >
            <Text style={[
              styles.nextButtonText,
              { color: isNextButtonEnabled() ? '#FFFFFF' : theme.textSecondary }
            ]}>
              {getNextButtonText()}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Final Confirmation Modal */}
      {renderFinalModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  backButton: {
    padding: SPACING.SM,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    marginLeft: -40, // Compensate for back button
  },
  headerSpacer: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.LG,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
  },
  progressLine: {
    width: 40,
    height: 2,
    marginHorizontal: SPACING.SM,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XL,
  },
  iconContainer: {
    marginBottom: SPACING.XL,
  },
  title: {
    fontSize: FONTS.SIZES.HEADER,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  description: {
    fontSize: FONTS.SIZES.MEDIUM,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.XL,
    paddingHorizontal: SPACING.MD,
  },
  warningList: {
    alignSelf: 'stretch',
    marginBottom: SPACING.XL,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
  },
  warningText: {
    flex: 1,
    fontSize: FONTS.SIZES.MEDIUM,
    marginLeft: SPACING.MD,
    lineHeight: 20,
  },
  cautionText: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.LG,
  },
  checkboxContainer: {
    alignSelf: 'stretch',
    marginBottom: SPACING.XL,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.LG,
    paddingHorizontal: SPACING.MD,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.MD,
  },
  checkboxText: {
    flex: 1,
    fontSize: FONTS.SIZES.MEDIUM,
    lineHeight: 20,
  },
  confirmationTextContainer: {
    alignSelf: 'stretch',
    padding: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    marginBottom: SPACING.LG,
  },
  confirmationTextExample: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  textInput: {
    alignSelf: 'stretch',
    padding: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 2,
    fontSize: FONTS.SIZES.MEDIUM,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SPACING.MD,
  },
  validationText: {
    fontSize: FONTS.SIZES.SMALL,
    textAlign: 'center',
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.LG,
    gap: SPACING.MD,
  },
  backStepButton: {
    flex: 1,
    paddingVertical: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    alignItems: 'center',
  },
  backStepText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    paddingVertical: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    alignItems: 'center',
    ...SHADOWS.MEDIUM,
  },
  fullWidthButton: {
    flex: 2,
  },
  nextButtonText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.XL,
    borderWidth: 1,
    ...SHADOWS.HEAVY,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  modalTitle: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  modalDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.XL,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: SPACING.LG,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: COLORS.ERROR,
    alignItems: 'center',
    ...SHADOWS.MEDIUM,
  },
  modalDeleteText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default DeleteAccountScreen;
