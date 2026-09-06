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
  IconButton,
} from 'react-native-paper';
import { signIn } from '../services/supabase';
import { COLORS, FONTS, SPACING, COMMON_STYLES } from '../constants/theme';

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
  card: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 12,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  title: {
    ...COMMON_STYLES.title,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  subtitle: {
    ...COMMON_STYLES.text,
    textAlign: 'center',
    marginBottom: SPACING.XL,
    fontSize: FONTS.SIZES.LARGE,
    opacity: 0.8,
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
  linkButton: {
    marginTop: SPACING.MD,
  },
});

export default LoginScreen;
