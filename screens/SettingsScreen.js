import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text } from 'react-native';
import { Button, TextInput, Modal, List } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const SettingsScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  
  // Settings state
  const [profile, setProfile] = useState(null);
  const [themeMode, setThemeMode] = useState('dark');
  const [language, setLanguage] = useState('English');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  
  // Form states
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const languages = [
    { label: 'English', value: 'English' },
    { label: 'Somali', value: 'Somali' },
    { label: 'Arabic', value: 'Arabic' },
  ];

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  //
  // ALSO NOTE (found while making this edit, not fixed here): this reads/
  // writes `profiles.theme_mode` / `.language` / `.notifications_enabled`,
  // columns not present in database/schema.sql or migration 003/004 --
  // this insert is likely failing (or silently adding unknown-column
  // errors) against the real schema. Needs its own follow-up.
  async function loadUserProfile() {
    if (!user) return;

    try {
      // Get or create user profile
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            email: user.email,
            theme_mode: 'dark',
            language: 'English',
            notifications_enabled: true
          }])
          .select()
          .single();

        if (createError) throw createError;
        profile = newProfile;
      } else if (error) {
        throw error;
      }

      setProfile(profile);
      setThemeMode(profile.theme_mode || 'dark');
      setLanguage(profile.language || 'English');
      setNotificationsEnabled(profile.notifications_enabled !== false);
      setEditName(profile.name || '');
      setEditEmail(profile.email || user.email);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserProfile();
  }, [user]);


  const updateProfileSetting = async (field, value) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert([{
          id: user.id,
          [field]: value
        }]);

      if (error) throw error;
      
      setProfile(prev => ({ ...prev, [field]: value }));
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      Alert.alert('Error', `Failed to update ${field}`);
    }
  };

  const handleThemeToggle = (value) => {
    const newTheme = value ? 'dark' : 'light';
    setThemeMode(newTheme);
    updateProfileSetting('theme_mode', newTheme);
  };

  const handleLanguageChange = (selectedLanguage) => {
    setLanguage(selectedLanguage);
    updateProfileSetting('language', selectedLanguage);
    setLanguagePickerVisible(false);
  };

  const handleNotificationsToggle = (value) => {
    setNotificationsEnabled(value);
    updateProfileSetting('notifications_enabled', value);
  };

  const handleEditProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: editName.trim() }
      });

      if (authError) throw authError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([{
          id: user.id,
          name: editName.trim(),
          email: editEmail
        }]);

      if (profileError) throw profileError;

      setProfile(prev => ({ ...prev, name: editName.trim(), email: editEmail }));
      setEditProfileVisible(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setChangePasswordVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change password');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will remove all your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: In production, you'd need an admin endpoint for this
              // For now, we'll just sign out and let the user know
              await signOut();
              Alert.alert('Account Deletion', 'Please contact support to complete account deletion.');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account');
            }
          }
        }
      ]
    );
  };

  const handleClearDownloads = async () => {
    Alert.alert(
      'Clear Downloads',
      'Remove all downloaded audio files?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const downloadDir = `${FileSystem.documentDirectory}downloads/`;
              const dirInfo = await FileSystem.getInfoAsync(downloadDir);
              
              if (dirInfo.exists) {
                await FileSystem.deleteAsync(downloadDir, { idempotent: true });
                
                // Clear download records from database
                const { error } = await supabase
                  .from('downloads')
                  .delete()
                  .eq('user_id', user.id);

                if (error) throw error;
              }

              Alert.alert('Success', 'All downloads cleared');
            } catch (error) {
              console.error('Error clearing downloads:', error);
              Alert.alert('Error', 'Failed to clear downloads');
            }
          }
        }
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://bookreaderapp.com/privacy');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigation will be handled by AuthContext
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 General</Text>

          {/*
            PHASE 1.6 FIX: this whole screen used <ListItem>/<Overlay>/<Input>
            (the React Native Elements API) without ever importing that
            library -- it isn't even a dependency of this project. Every one
            of those tags threw "X is not defined" the instant this screen
            rendered (caught only now, by adding ESLint -- there was no
            device or test that had ever exercised this screen). Rewritten
            below using react-native-paper's List.Item/Modal/TextInput/
            Button, which ARE already imported and used correctly elsewhere
            in this app.
          */}
          <List.Item
            style={styles.listItem}
            title="Dark Theme"
            titleStyle={styles.listTitle}
            description={themeMode === 'dark' ? 'Enabled' : 'Disabled'}
            descriptionStyle={styles.listSubtitle}
            left={() => <MaterialCommunityIcons name="theme-light-dark" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
            right={() => (
              <Switch
                value={themeMode === 'dark'}
                onValueChange={handleThemeToggle}
                trackColor={{ false: COLORS.BORDER, true: COLORS.BUTTON }}
                thumbColor={COLORS.TEXT}
              />
            )}
          />

          <TouchableOpacity onPress={() => setLanguagePickerVisible(true)}>
            <List.Item
              style={styles.listItem}
              title="Language"
              titleStyle={styles.listTitle}
              description={language}
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="translate" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.TEXT} />}
            />
          </TouchableOpacity>

          <List.Item
            style={styles.listItem}
            title="Notifications"
            titleStyle={styles.listTitle}
            description={notificationsEnabled ? 'Enabled' : 'Disabled'}
            descriptionStyle={styles.listSubtitle}
            left={() => <MaterialCommunityIcons name="bell" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
            right={() => (
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: COLORS.BORDER, true: COLORS.BUTTON }}
                thumbColor={COLORS.TEXT}
              />
            )}
          />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧍‍♂️ Account</Text>

          <TouchableOpacity onPress={() => setEditProfileVisible(true)}>
            <List.Item
              style={styles.listItem}
              title="Edit Profile"
              titleStyle={styles.listTitle}
              description="Update name and email"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="account-edit" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setChangePasswordVisible(true)}>
            <List.Item
              style={styles.listItem}
              title="Change Password"
              titleStyle={styles.listTitle}
              description="Update your password"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="lock-reset" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDeleteAccount}>
            <List.Item
              style={styles.listItem}
              title="Delete Account"
              titleStyle={[styles.listTitle, { color: COLORS.ERROR }]}
              description="Permanently delete account"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="account-remove" size={24} color={COLORS.ERROR} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.ERROR} />}
            />
          </TouchableOpacity>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ App</Text>

          <TouchableOpacity onPress={handleClearDownloads}>
            <List.Item
              style={styles.listItem}
              title="Clear Downloads"
              titleStyle={styles.listTitle}
              description="Remove all offline content"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="download-off" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePrivacyPolicy}>
            <List.Item
              style={styles.listItem}
              title="Privacy Policy"
              titleStyle={styles.listTitle}
              description="View privacy policy"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="shield-account" size={24} color={COLORS.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout}>
            <List.Item
              style={styles.listItem}
              title="Logout"
              titleStyle={[styles.listTitle, { color: COLORS.ERROR }]}
              description="Sign out of your account"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="logout" size={24} color={COLORS.ERROR} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.ERROR} />}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileVisible}
        onDismiss={() => setEditProfileVisible(false)}
        contentContainerStyle={styles.overlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Profile</Text>

          <TextInput
            mode="outlined"
            label="Name"
            value={editName}
            onChangeText={setEditName}
            placeholder="Enter your name"
            style={styles.modalInput}
          />

          <TextInput
            mode="outlined"
            label="Email"
            value={editEmail}
            onChangeText={setEditEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            style={styles.modalInput}
            editable={false}
          />

          <View style={styles.modalButtons}>
            <Button mode="outlined" style={styles.cancelButton} labelStyle={styles.cancelButtonText} onPress={() => setEditProfileVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" style={styles.saveButton} labelStyle={styles.saveButtonText} onPress={handleEditProfile}>
              Save
            </Button>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordVisible}
        onDismiss={() => setChangePasswordVisible(false)}
        contentContainerStyle={styles.overlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Change Password</Text>

          <TextInput
            mode="outlined"
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            secureTextEntry
            style={styles.modalInput}
          />

          <TextInput
            mode="outlined"
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            style={styles.modalInput}
          />

          <View style={styles.modalButtons}>
            <Button mode="outlined" style={styles.cancelButton} labelStyle={styles.cancelButtonText} onPress={() => setChangePasswordVisible(false)}>
              Cancel
            </Button>
            <Button mode="contained" style={styles.saveButton} labelStyle={styles.saveButtonText} onPress={handleChangePassword}>
              Change
            </Button>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={languagePickerVisible}
        onDismiss={() => setLanguagePickerVisible(false)}
        contentContainerStyle={styles.overlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Language</Text>

          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.value}
              style={styles.languageOption}
              onPress={() => handleLanguageChange(lang.value)}
            >
              <Text style={[
                styles.languageText,
                language === lang.value && { color: COLORS.BUTTON }
              ]}>
                {lang.label}
              </Text>
              {language === lang.value && (
                <MaterialCommunityIcons name="check" size={24} color={COLORS.BUTTON} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: COMMON_STYLES.container,
  scrollView: {
    flex: 1,
  },
  loadingText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
  },
  section: {
    marginBottom: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.BUTTON,
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.SM,
    marginTop: SPACING.MD,
  },
  listItem: {
    backgroundColor: COLORS.BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    paddingVertical: SPACING.MD,
  },
  listIcon: {
    alignSelf: 'center',
    marginLeft: SPACING.SM,
  },
  listTitle: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: '600',
  },
  listSubtitle: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.MEDIUM,
    opacity: 0.7,
    marginTop: 2,
  },
  overlay: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    padding: 0,
    margin: SPACING.LG,
    maxWidth: 400,
    width: '90%',
  },
  modalContent: {
    padding: SPACING.LG,
  },
  modalTitle: {
    ...COMMON_STYLES.title,
    fontSize: FONTS.SIZES.TITLE,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  modalInput: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
  },
  modalLabel: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.LG,
  },
  cancelButton: {
    borderColor: COLORS.ERROR,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.LG,
    flex: 0.45,
  },
  cancelButtonText: {
    color: COLORS.ERROR,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.LG,
    flex: 0.45,
  },
  saveButtonText: {
    color: COLORS.BUTTON_TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  languageText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
  },
});

export default SettingsScreen;
