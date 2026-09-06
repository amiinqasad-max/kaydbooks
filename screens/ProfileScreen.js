import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native';
import { Avatar, Card, List, Button, Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  supabase,
} from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
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
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'You will receive an email with instructions to reset your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(user.email);
              if (error) throw error;
              
              Alert.alert(
                'Email Sent',
                'Please check your email for password reset instructions.'
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to send reset email');
            }
          }
        }
      ]
    );
  };

  const formatMemberSince = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.loginPrompt}>
          <MaterialCommunityIcons name="account-outline" size={80} color={COLORS.BORDER} />
          <Text style={styles.loginTitle}>Sign In Required</Text>
          <Text style={styles.loginSubtitle}>
            Please sign in to view your profile and reading statistics
          </Text>
          <Button
            mode="contained"
            style={styles.signInBtn}
            onPress={() => navigation.navigate('Login')}
          >
            Sign In
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <Avatar.Text
                size={80}
                label={user.email?.charAt(0).toUpperCase() || 'U'}
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.userName}>
                  {user.user_metadata?.name || user.email?.split('@')[0]}
                </Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <Text style={styles.memberSince}>
                  Member since {formatMemberSince(user.created_at)}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>


        {/* Settings */}
        <Card style={styles.settingsCard}>
          <Card.Content>
            <Text style={styles.settingsTitle}>⚙️ Settings & Account</Text>

            {/* PHASE 2 fix (#16, #2 dead UI): SettingsScreen.js (theme,
                language, notifications, clear downloads) was a fully
                registered route (App.js) that literally nothing in the
                app ever navigated to -- confirmed via a full-repo grep
                for navigate('Settings'). It was completely unreachable.
                This is the entry point. */}
            <List.Item
              title="Settings"
              description="Theme, language, notifications, storage"
              left={(props) => <List.Icon {...props} icon="cog" color={COLORS.BUTTON} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={COLORS.TEXT_SECONDARY} />}
              onPress={() => navigation.navigate('Settings')}
              style={styles.listItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />

            <List.Item
              title="Premium Subscription"
              description="Upgrade to access all features"
              left={(props) => <List.Icon {...props} icon="crown" color={COLORS.BUTTON} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={COLORS.TEXT_SECONDARY} />}
              onPress={() => navigation.navigate('PremiumSubscription', { fromProfile: true })}
              style={styles.listItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            
            <List.Item
              title="Change Password"
              description="Update your account password"
              left={(props) => <List.Icon {...props} icon="lock-reset" color={COLORS.WARNING} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={COLORS.TEXT_SECONDARY} />}
              onPress={handleChangePassword}
              style={styles.listItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <List.Item
              title="Privacy Policy & Terms"
              description="Review our privacy policy and terms"
              left={(props) => <List.Icon {...props} icon="shield-check" color={COLORS.INFO} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={COLORS.TEXT_SECONDARY} />}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              style={styles.listItem}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <List.Item
              title="Delete Account"
              description="Permanently delete your account and data"
              left={(props) => <List.Icon {...props} icon="delete-forever" color={COLORS.ERROR} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={COLORS.TEXT_SECONDARY} />}
              onPress={() => navigation.navigate('DeleteAccount')}
              style={[styles.listItem, styles.dangerItem]}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
          </Card.Content>
        </Card>

        {/* Sign Out Button */}
        <View style={styles.signOutContainer}>
          <Button
            mode="outlined"
            style={styles.signOutButton}
            onPress={handleSignOut}
            icon="logout"
            textColor={COLORS.BUTTON}
          >
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.XL,
  },
  loginTitle: {
    fontSize: FONTS.SIZES.TITLE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  loginSubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.XL,
    lineHeight: 22,
  },
  signInBtn: {
    backgroundColor: COLORS.BUTTON,
    paddingHorizontal: SPACING.XL,
  },
  profileCard: {
    backgroundColor: COLORS.SURFACE,
    margin: SPACING.MD,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: COLORS.BUTTON,
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.LG,
  },
  userName: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  userEmail: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  memberSince: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  settingsCard: {
    backgroundColor: COLORS.SURFACE,
    margin: SPACING.MD,
    elevation: 2,
  },
  settingsTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.MD,
  },
  listItem: {
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  listItemTitle: {
    color: COLORS.TEXT,
    fontFamily: FONTS.BOLD,
  },
  listItemDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONTS.REGULAR,
  },
  dangerItem: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  signOutContainer: {
    padding: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  signOutButton: {
    borderColor: COLORS.BORDER,
    paddingVertical: SPACING.SM,
  },
});

export default ProfileScreen;
