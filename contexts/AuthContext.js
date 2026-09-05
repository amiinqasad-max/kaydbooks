import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getCurrentUser } from '../services/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // `role` is fetched from `profiles.role` for UX only (e.g. hiding the
  // Admin tab from a regular user). It is NOT a security boundary -- the
  // real one is the `is_admin()` RLS policy enforced by Postgres on every
  // write, regardless of what this client-side value says. See
  // supabase/migrations/003_authorization_and_schema_fixes.sql.
  const [role, setRole] = useState(null);

  const fetchRole = async (currentUser) => {
    if (!currentUser) {
      setRole(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();
      setRole(data?.role || 'user');
    } catch (error) {
      setRole('user');
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        await fetchRole(currentUser);
      } catch (error) {
        // Error getting initial session
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        await fetchRole(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        // Error signing in
        throw error;
      }
      setUser(data.user);
      return data;
    } catch (error) {
      // Sign in error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, userData = {}) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });
      if (error) {
        // Error signing up
        throw error;
      }
      return data;
    } catch (error) {
      // Sign up error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Error signing out
        throw error;
      }
      setUser(null);
    } catch (error) {
      // Sign out error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    role,
    isAdmin: role === 'admin' || role === 'super_admin',
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
