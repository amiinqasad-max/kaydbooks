import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
} from 'react-native-paper';
import { signIn, supabase } from '../services/supabase';
import { COLORS, TYPOGRAPHY, SPACING, COMMON_STYLES } from '../constants/theme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Navigation will be handled by AuthContext
    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // PHASE 2 fix (#16/#19 real functionality): before this, the only
  // password-reset path in the whole app was buried in ProfileScreen --
  // which requires already being signed in. A signed-out user who
  // genuinely forgot their password had no way at all to recover their
  // account from the login screen. Uses the same real, already-working
  // `supabase.auth.resetPasswordForEmail` call ProfileScreen uses, not a
  // new/fabricated capability.
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Type your email above first, then tap "Forgot password?" again.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert('Email sent', 'Check your email for password reset instructions.');
    } catch (_error) {
      Alert.alert('Error', 'Failed to send reset email.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>
              Welcome Back
            </Text>
            <Text style={styles.subtitle}>
              Sign in to your account
            </Text>

          <TextInput
            label="Email"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
            theme={{ 
              colors: { 
                primary: COLORS.BUTTON,
                onSurface: COLORS.TEXT,
                onSurfaceVariant: COLORS.TEXT_SECONDARY,
                outline: COLORS.BORDER,
                surface: COLORS.BACKGROUND,
                surfaceVariant: COLORS.BACKGROUND,
              } 
            }}
            textColor={COLORS.TEXT}
            placeholderTextColor={COLORS.TEXT_SECONDARY}
          />

          <TextInput
            label="Password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            mode="outlined"
            style={styles.input}
            theme={{ 
              colors: { 
                primary: COLORS.BUTTON,
                onSurface: COLORS.TEXT,
                onSurfaceVariant: COLORS.TEXT_SECONDARY,
                outline: COLORS.BORDER,
                surface: COLORS.BACKGROUND,
                surfaceVariant: COLORS.BACKGROUND,
              } 
            }}
            textColor={COLORS.TEXT}
            placeholderTextColor={COLORS.TEXT_SECONDARY}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
                iconColor={COLORS.TEXT_SECONDARY}
              />
            }
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
          >
            Sign In
          </Button>

            <Button
              mode="text"
              onPress={handleForgotPassword}
              style={styles.forgotButton}
              textColor={COLORS.TEXT_SECONDARY}
            >
              Forgot password?
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('SignUp')}
              style={styles.linkButton}
              textColor={COLORS.BUTTON}
            >
              Don&apos;t have an account? Sign Up
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    ...COMMON_STYLES.container,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.LG,
  },
  // PHASE 2: card now uses SURFACE (a distinct, elevated color as of this
  // phase's design-system update) instead of the flat screen BACKGROUND,
  // so the auth card actually reads as a card rather than blending into
  // the screen. Title/subtitle moved onto the TYPOGRAPHY scale.
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.XL,
  },
  input: {
    marginBottom: SPACING.MD,
  },
  button: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: 25,
    paddingVertical: SPACING.SM,
    marginTop: SPACING.SM,
  },
  buttonText: {
    ...COMMON_STYLES.buttonText,
  },
  forgotButton: {
    marginTop: SPACING.SM,
  },
  linkButton: {
    marginTop: SPACING.SM,
  },
});

export default LoginScreen;
