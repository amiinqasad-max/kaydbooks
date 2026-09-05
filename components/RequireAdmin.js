import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, SPACING } from '../constants/theme';

/**
 * UX-level gate for admin-only screens. This is NOT the security
 * boundary -- a user who reaches this screen by some other means (deep
 * link, a future navigator change) still cannot actually create, edit, or
 * delete a book, because the `is_admin()` Row Level Security policy on
 * `books`/`storage.objects` enforces that in Postgres regardless of what
 * this component does. This component exists purely so a non-admin who
 * lands here sees a clear message instead of a screen full of confusing
 * "row-level security policy" errors from failed requests.
 */
const RequireAdmin = ({ children }) => {
  const { isAdmin, role } = useAuth();
  const navigation = useNavigation();

  // role === null means "still loading" -- don't flash the denial screen.
  if (role === null) return null;

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Admins only</Text>
        <Text style={styles.body}>
          This section is for content administrators. If you believe you
          should have access, ask a super admin to grant your account the
          admin role.
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
          Go back
        </Button>
      </View>
    );
  }

  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.LG || 24,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  body: {
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 8,
  },
});

export default RequireAdmin;
