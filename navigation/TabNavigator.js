import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import MiniPlayer from '../components/MiniPlayer';

// Import screens
import ModernHomeScreen from '../screens/ModernHomeScreen';
import EnhancedLibraryScreen from '../screens/EnhancedLibraryScreen';
import ModernExploreScreen from '../screens/ModernExploreScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      key={currentLanguage} // Force re-render when language changes
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'bookshelf' : 'bookshelf';
          } else if (route.name === 'Explore') {
            iconName = focused ? 'compass' : 'compass-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.BUTTON,
        tabBarInactiveTintColor: colors.TEXT_MUTED,
        tabBarStyle: {
          backgroundColor: colors.SURFACE,
          borderTopWidth: 1,
          borderTopColor: colors.BORDER,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={ModernHomeScreen}
        options={{
          tabBarLabel: t('navigation.home'),
        }}
      />
      <Tab.Screen 
        name="Library" 
        component={EnhancedLibraryScreen}
        options={{
          tabBarLabel: t('navigation.library'),
        }}
      />
      <Tab.Screen 
        name="Explore" 
        component={ModernExploreScreen}
        options={{
          tabBarLabel: t('navigation.explore'),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: t('navigation.profile'),
        }}
      />
    </Tab.Navigator>
    {/* Persistent across Home/Library/Explore/Profile; hides itself via
        MiniPlayer's own `if (!currentBook) return null` when nothing is
        loaded. Absolutely positioned just above the 60px tab bar
        (tabBarStyle.height above) rather than inside a tab screen, so it
        survives switching tabs instead of resetting per-screen. */}
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 60 }}>
      <MiniPlayer />
    </View>
    </View>
  );
};

export default TabNavigator;
