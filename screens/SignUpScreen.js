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
import { signUp } from '../services/supabase';
import { COLORS, TYPOGRAPHY, SPACING, COMMON_STYLES } from '../constants/theme';

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      Alert.alert(
        'Success',
        'Account created successfully! Please check your email for verification.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Sign Up Error', error.message);
    } finally {
      setLoading(false);
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
              Create Account
            </Text>
            <Text style={styles.subtitle}>
              Join us to start reading
            </Text>

            <TextInput
              label="Name"
              placeholder="Name"
              value={name}
              onChangeText={setName}
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

            <TextInput
              label="Confirm Password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
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
                  icon={showConfirmPassword ? "eye-off" : "eye"}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  iconColor={COLORS.TEXT_SECONDARY}
                />
              }
            />

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              style={styles.button}
            >
              Sign Up
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
              textColor={COLORS.BUTTON}
            >
              Already have an account? Sign In
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
  // PHASE 2: card now uses SURFACE (elevated, distinct from the flat
  // screen BACKGROUND) -- same fix as LoginScreen.js. Title/subtitle
  // moved onto the TYPOGRAPHY scale.
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
    fontSize: TYPOGRAPHY.h3.fontSize,
  },
  linkButton: {
    marginTop: SPACING.LG,
  },
});

export default SignUpScreen;
