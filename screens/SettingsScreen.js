import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native';
import { Button, TextInput, Modal, List } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import { FONTS, TYPOGRAPHY, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const SettingsScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  // PHASE 2 fix: this switch used to only manage a local `themeMode`
  // state and persist it to `profiles.theme_mode` -- nothing in the app
  // ever read that value back to change a single rendered color, so
  // toggling "Dark Theme" here had ZERO visible effect anywhere. Now
  // reads/writes the real, app-wide ThemeContext (see
  // contexts/ThemeContext.js), which components/ui/* actually consumes.
  const { themeMode, setThemeMode, colors } = useTheme();
  const styles = createStyles(colors);

  // Settings state
  const [profile, setProfile] = useState(null);
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
  // PHASE 1.8 NOTE (resolved): this reads/writes `profiles.theme_mode` /
  // `.language` / `.notifications_enabled`. As of Phase 1.7 those columns
  // did not exist in database/schema.sql or migrations 003/004, so this
  // insert was likely failing against the real schema. Fixed in
  // supabase/migrations/005_schema_reconciliation.sql, which adds all
  // three as owner-only preference columns -- this code itself needed no
  // change, only the schema underneath it.
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
      // theme_mode is intentionally NOT set from here -- ThemeContext
      // already independently loads and reconciles the same
      // profiles.theme_mode column (see contexts/ThemeContext.js);
      // duplicating that here would just be a second, redundant read of
      // the same value into a second place to keep in sync.
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
    // ThemeContext.setThemeMode already persists to both AsyncStorage
    // and profiles.theme_mode (see contexts/ThemeContext.js) -- no
    // separate updateProfileSetting call needed here.
    setThemeMode(value ? 'dark' : 'light');
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
            left={() => <MaterialCommunityIcons name="theme-light-dark" size={24} color={colors.BUTTON} style={styles.listIcon} />}
            right={() => (
              <Switch
                value={themeMode === 'dark'}
                onValueChange={handleThemeToggle}
                trackColor={{ false: colors.BORDER, true: colors.BUTTON }}
                thumbColor={colors.TEXT}
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
              left={() => <MaterialCommunityIcons name="translate" size={24} color={colors.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.TEXT} />}
            />
          </TouchableOpacity>

          <List.Item
            style={styles.listItem}
            title="Notifications"
            titleStyle={styles.listTitle}
            description={notificationsEnabled ? 'Enabled' : 'Disabled'}
            descriptionStyle={styles.listSubtitle}
            left={() => <MaterialCommunityIcons name="bell" size={24} color={colors.BUTTON} style={styles.listIcon} />}
            right={() => (
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.BORDER, true: colors.BUTTON }}
                thumbColor={colors.TEXT}
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
              left={() => <MaterialCommunityIcons name="account-edit" size={24} color={colors.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setChangePasswordVisible(true)}>
            <List.Item
              style={styles.listItem}
              title="Change Password"
              titleStyle={styles.listTitle}
              description="Update your password"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="lock-reset" size={24} color={colors.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.TEXT} />}
            />
          </TouchableOpacity>

          {/* PHASE 2 fix (#24 real data, #30 duplicate cleanup): this used
              to have its own local handleDeleteAccount that just signed
              the user out and told them to "contact support to complete
              account deletion" -- it never actually deleted anything,
              while a real, working DeleteAccountScreen.js already exists
              and is reachable from ProfileScreen. Now navigates there
              instead of a fake local flow. */}
          <TouchableOpacity onPress={() => navigation.navigate('DeleteAccount')}>
            <List.Item
              style={styles.listItem}
              title="Delete Account"
              titleStyle={[styles.listTitle, { color: colors.ERROR }]}
              description="Permanently delete account"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="account-remove" size={24} color={colors.ERROR} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.ERROR} />}
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
              left={() => <MaterialCommunityIcons name="download-off" size={24} color={colors.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.TEXT} />}
            />
          </TouchableOpacity>

          {/* PHASE 2 fix (#24 real data): this used to
              Linking.openURL('https://bookreaderapp.com/privacy') -- a
              placeholder domain that is not KaydBooks (leftover from a
              template), sending users to a page that isn't this app's
              actual policy. screens/PrivacyPolicyScreen.js is a real,
              already-built in-app screen (also linked from
              ProfileScreen.js) -- now used here too instead. */}
          <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
            <List.Item
              style={styles.listItem}
              title="Privacy Policy"
              titleStyle={styles.listTitle}
              description="View privacy policy"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="shield-account" size={24} color={colors.BUTTON} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.TEXT} />}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout}>
            <List.Item
              style={styles.listItem}
              title="Logout"
              titleStyle={[styles.listTitle, { color: colors.ERROR }]}
              description="Sign out of your account"
              descriptionStyle={styles.listSubtitle}
              left={() => <MaterialCommunityIcons name="logout" size={24} color={colors.ERROR} style={styles.listIcon} />}
              right={() => <MaterialCommunityIcons name="chevron-right" size={24} color={colors.ERROR} />}
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
                language === lang.value && { color: colors.BUTTON }
              ]}>
                {lang.label}
              </Text>
              {language === lang.value && (
                <MaterialCommunityIcons name="check" size={24} color={colors.BUTTON} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
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
    ...TYPOGRAPHY.h3,
    color: colors.ACCENT,
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.SM,
    marginTop: SPACING.MD,
  },
  listItem: {
    backgroundColor: colors.BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: colors.BORDER,
    paddingVertical: SPACING.MD,
  },
  listIcon: {
    alignSelf: 'center',
    marginLeft: SPACING.SM,
  },
  listTitle: {
    ...TYPOGRAPHY.body,
    color: colors.TEXT,
    fontWeight: '600',
  },
  listSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.TEXT_MUTED,
    marginTop: 2,
  },
  // PHASE 2: MODAL_BACKGROUND (a distinct, elevated color as of this
  // phase's design-system update) instead of the flat screen BACKGROUND,
  // same fix applied to the reader/audio-player modals.
  overlay: {
    backgroundColor: colors.MODAL_BACKGROUND,
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
    ...TYPOGRAPHY.h2,
    color: colors.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  modalInput: {
    color: colors.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
  },
  modalLabel: {
    color: colors.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.LG,
  },
  cancelButton: {
    borderColor: colors.ERROR,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.LG,
    flex: 0.45,
  },
  cancelButtonText: {
    color: colors.ERROR,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.LG,
    flex: 0.45,
  },
  saveButtonText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: colors.BORDER,
  },
  languageText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
  },
});

export default SettingsScreen;
