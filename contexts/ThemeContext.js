import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, LIGHT_COLORS, GRADIENTS, LIGHT_GRADIENTS } from '../constants/theme';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const THEME_STORAGE_KEY = 'kaydbooks:themeMode';

const ThemeContext = createContext({
  themeMode: 'dark',
  isDark: true,
  colors: COLORS,
  gradients: GRADIENTS,
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * ThemeContext -- Phase 2 (#25: light/dark theme coherence).
 *
 * Real finding this fixes: `profiles.theme_mode` has existed since
 * Phase 1.8 (migration 005), and SettingsScreen.js has had a working
 * "Dark Theme" switch that reads/writes it since Phase 1 -- but nothing
 * in the app ever *read* that value to change a single rendered color.
 * The switch persisted to the database and had zero visible effect: a
 * fake toggle, the same class of bug this project has repeatedly found
 * and fixed in every prior phase.
 *
 * This provider is the real source of truth for which palette is active:
 *   - Loads a value fast, before any network round-trip, from
 *     AsyncStorage (so the app doesn't flash dark-then-light on every
 *     cold start).
 *   - If the user is signed in, reconciles with `profiles.theme_mode`
 *     (the source of truth SettingsScreen already writes to) and keeps
 *     AsyncStorage in sync so a signed-out/offline session still shows
 *     the last chosen theme.
 *   - Exposes `colors`/`gradients` (the active palette) and
 *     `setThemeMode`/`toggleTheme`.
 *
 * IMPORTANT, HONEST SCOPE NOTE: every existing screen in this app
 * imports `COLORS`/`GRADIENTS` directly from constants/theme.js as
 * static objects, not through this context. Converting every screen's
 * dozens of color references to consume `useTheme()` instead is a
 * large, high-risk, whole-app refactor that has NOT been done in this
 * pass -- doing it without a real device to verify each screen against
 * would risk exactly the kind of undiscovered visual regression this
 * project has spent five phases finding and fixing in *other* code.
 * What toggling the theme actually re-themes right now: the shared
 * components/ui/* library (all built this phase to consume this
 * context) and any screen/component intentionally migrated to use it.
 * Screens not yet migrated keep rendering the dark palette regardless of
 * this setting. See the Phase 2 report for the exact list.
 */
export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [themeMode, setThemeModeState] = useState('dark');
  const [hydrated, setHydrated] = useState(false);

  // Load the last-known choice immediately, before any network activity.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setThemeModeState(stored);
        }
      } catch (_error) {
        // Non-fatal -- default ('dark') stands.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Reconcile with the signed-in user's real, persisted preference once
  // both the local cache has loaded and we know who's signed in.
  useEffect(() => {
    if (!hydrated || !user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('theme_mode')
          .eq('id', user.id)
          .single();
        if (data?.theme_mode === 'light' || data?.theme_mode === 'dark') {
          setThemeModeState(data.theme_mode);
          await AsyncStorage.setItem(THEME_STORAGE_KEY, data.theme_mode);
        }
      } catch (_error) {
        // No profile row yet, or offline -- keep whatever AsyncStorage had.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user?.id]);

  const setThemeMode = useCallback(async (mode) => {
    if (mode !== 'light' && mode !== 'dark') return;
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (_error) {
      // Non-fatal -- in-memory state already updated for this session.
    }
    if (user?.id) {
      try {
        await supabase.from('profiles').upsert([{ id: user.id, theme_mode: mode }]);
      } catch (_error) {
        // Non-fatal -- local preference still applies this session.
      }
    }
  }, [user]);

  const toggleTheme = useCallback(() => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  }, [themeMode, setThemeMode]);

  const isDark = themeMode !== 'light';

  const value = {
    themeMode,
    isDark,
    colors: isDark ? COLORS : LIGHT_COLORS,
    gradients: isDark ? GRADIENTS : LIGHT_GRADIENTS,
    setThemeMode,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
