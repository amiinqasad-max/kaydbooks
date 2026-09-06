import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import AppInitializer from './components/AppInitializer';
import { COLORS } from './constants/theme';
import { setupReactNativeErrorHandler } from './utils/reactNativeErrorHandler';
import './i18n/index.js'; // Initialize i18n

// CRITICAL: Setup React Native compatible error handler to catch level3 errors
setupReactNativeErrorHandler();

// Suppress warnings and add SDK 53+ specific warnings
LogBox.ignoreLogs([
  'Warning: TextElement: Support for defaultProps',
  'Warning: Failed prop type: Invalid prop `textStyle` of type `array`',
  'Warning: componentWillReceiveProps has been renamed',
  'Warning: componentWillMount has been renamed',
  'expo-notifications: Android Push notifications',
  'expo-notifications functionality is not fully supported',
  'expo-av has been deprecated',
  'StatusBar backgroundColor is not supported',
  'Dynamic import blocked / patched',
  'Failed to import',
  // New suppressions for cleaner console
  'Push notifications disabled in Expo Go SDK 53+',
  'StatusBar backgroundColor is not supported with edge-to-edge enabled',
  'i18next: languageChanged',
  'i18next: initialized',
  // CRITICAL: Suppress level3 errors as backup
  'Cannot read property \'level3\' of undefined',
  'Cannot read properties of undefined (reading \'level3\')',
  'TypeError: Cannot read property \'level3\'',
  'level3',
  // CRITICAL: Suppress runtime errors from global error handler
  'runtime not ready',
  'TypeError: window.addEventListener is not a function',
  'addEventListener is not a function',
  'setupErrorHandler',
]);

// Screens
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import BookDetailScreen from './screens/BookDetailScreen';
import PDFViewScreen from './screens/PDFViewScreen';
import PremiumAudioPlayerScreen from './screens/PremiumAudioPlayerScreen';
// Admin Screens
import AdminUploadScreen from './screens/AdminUploadScreen';
import AdminManageScreen from './screens/AdminManageScreen';
import ModernTopReadsScreen from './screens/ModernTopReadsScreen';
import ModernTopAudiobooksScreen from './screens/ModernTopAudiobooksScreen';
import CategoryBooksScreen from './screens/CategoryBooksScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReadingStatsScreen from './screens/ReadingStatsScreen';
import DownloadsLibraryScreen from './screens/DownloadsLibraryScreen';
// App Store Compliance Screens
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import DeleteAccountScreen from './screens/DeleteAccountScreen';
import PremiumSubscriptionScreen from './screens/PremiumSubscriptionScreen';

// Navigation
import TabNavigator from './navigation/TabNavigator';
import RequireAdmin from './components/RequireAdmin';

const AdminUploadScreenGated = (props) => (
  <RequireAdmin><AdminUploadScreen {...props} /></RequireAdmin>
);
const AdminManageScreenGated = (props) => (
  <RequireAdmin><AdminManageScreen {...props} /></RequireAdmin>
);

const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={TabNavigator} />
    <Stack.Screen name="BookDetail" component={BookDetailScreen} />
    <Stack.Screen name="PDFViewScreen" component={PDFViewScreen} />
    <Stack.Screen name="AudioPlayer" component={PremiumAudioPlayerScreen} />
    {/* Admin Screens */}
    <Stack.Screen name="AdminUpload" component={AdminUploadScreenGated} />
    <Stack.Screen name="AdminManage" component={AdminManageScreenGated} />
    <Stack.Screen name="TopReads" component={ModernTopReadsScreen} />
    <Stack.Screen name="TopAudiobooks" component={ModernTopAudiobooksScreen} />
    <Stack.Screen name="CategoryBooks" component={CategoryBooksScreen} />
    <Stack.Screen name="Settings" component={SettingsScreen} />
    <Stack.Screen name="ReadingStats" component={ReadingStatsScreen} />
    <Stack.Screen name="Downloads" component={DownloadsLibraryScreen} />
    {/* App Store Compliance Screens */}
    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
    <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    <Stack.Screen name="PremiumSubscription" component={PremiumSubscriptionScreen} />
  </Stack.Navigator>
);

const Navigation = () => {
  const { user, loading } = useAuth();
  const [showSubscription, setShowSubscription] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);
  
  const Stack = createStackNavigator();

  const handleAppInitialized = (result) => {
    setAppInitialized(true);
    
    if (result.showSubscription) {
      setShowSubscription(true);
    }
    
    if (result.error) {
      console.error('App initialization error:', result.error);
    }
  };

  if (loading) {
    return null; // You can add a loading screen here
  }

  const darkTheme = {
    dark: true,
    colors: {
      primary: COLORS.BUTTON,
      background: COLORS.BACKGROUND,
      card: COLORS.BACKGROUND,
      text: COLORS.TEXT,
      border: COLORS.BORDER,
      notification: COLORS.BUTTON,
    },
  };

  return (
    <NavigationContainer theme={darkTheme}>
      {user ? (
        <AppInitializer onInitialized={handleAppInitialized}>
          {showSubscription ? (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="PremiumSubscription" component={PremiumSubscriptionScreen} />
            </Stack.Navigator>
          ) : (
            appInitialized ? <AppStack /> : null
          )}
        </AppInitializer>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
};

// Reads the active theme so the OS status bar (icon color, background)
// matches whichever palette is actually active, instead of being
// hardcoded to the dark palette regardless of the user's real choice.
const ThemedStatusBar = () => {
  const { colors, isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.BACKGROUND} />;
};

export default function App() {

  const paperTheme = {
    colors: {
      primary: COLORS.BUTTON,
      background: COLORS.BACKGROUND,
      surface: COLORS.SURFACE,
      text: COLORS.TEXT,
      onSurface: COLORS.TEXT,
      placeholder: COLORS.TEXT_SECONDARY,
    },
  };

  return (
    <PaperProvider theme={paperTheme}>
      <LanguageProvider>
        <AuthProvider>
          {/* ThemeProvider needs useAuth() (to reconcile with
              profiles.theme_mode for a signed-in user), so it must sit
              inside AuthProvider -- see contexts/ThemeContext.js for the
              real bug this closes (the Settings "Dark Theme" switch used
              to persist to the database with zero visible effect). */}
          <ThemeProvider>
            {/* Mounted once at the app root, above navigation, so the audio
                engine and its state survive navigating between screens --
                this is what makes a persistent mini-player and real
                background playback possible (see contexts/AudioPlayerContext.js). */}
            <AudioPlayerProvider>
              <Navigation />
            </AudioPlayerProvider>
            <ThemedStatusBar />
          </ThemeProvider>
        </AuthProvider>
      </LanguageProvider>
    </PaperProvider>
  );
}
