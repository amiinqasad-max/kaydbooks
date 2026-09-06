import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import {
  getBooksByCategory,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
} from '../services/supabase';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';
import { BookCard, EmptyState, ShelfSkeleton } from '../components/ui';

// PHASE 2 REWRITE (was an entirely light-themed screen -- white background,
// #333/#666 text -- the only screen in the app styled that way; every
// other screen uses the dark-blue/yellow KaydBooks theme). Also fixed a
// real functional bug: this screen imported `Button` from
// `react-native-paper` but used it with `title`/`buttonStyle`/`titleStyle`
// props, which is the `react-native-elements` Button API, not paper's
// (paper uses `children` + `style`/`labelStyle`) -- paper's Button
// silently ignores unrecognized props, so the Read/Listen buttons
// rendered with no visible label. Same bug class Phase 1.6 found and
// fixed in SettingsScreen.js/DownloadsLibraryScreen.js. Replaced with the
// shared BookCard component (components/ui/BookCard.js), which already
// renders correct Read/Listen actions, and the shared EmptyState/
// ShelfSkeleton components for the empty/loading cases.
//
// `toggleFavorite` is unused by BookCard (BookCard has no favorite icon
// slot -- see components/ui/BookCard.js) but is kept here, wired to a
// heart badge, matching Phase 2's "real data only" rule: favorites are
// real, DB-backed state (services/supabase.js's favorites table), so the
// UI to toggle them is preserved, just moved into the row via a badge.
const CategoryBooksScreen = ({ navigation, route }) => {
  const { category } = route.params;
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState({});

  useEffect(() => {
    loadBooks();
  }, [category]);

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function loadBooks() {
    try {
      setLoading(true);
      const booksData = await getBooksByCategory(category, 50);
      setBooks(booksData);

      if (user) {
        const favoritesStatus = {};
        await Promise.all(
          booksData.map(async (book) => {
            const isFav = await isFavorite(user.id, book.id);
            favoritesStatus[book.id] = isFav;
          })
        );
        setFavorites(favoritesStatus);
      }
    } catch (error) {
      console.error('Error loading category books:', error);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBooks();
    setRefreshing(false);
  };

  const toggleFavorite = async (bookId) => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    try {
      const currentlyFavorite = favorites[bookId];
      if (currentlyFavorite) {
        await removeFromFavorites(user.id, bookId);
      } else {
        await addToFavorites(user.id, bookId);
      }
      setFavorites((prev) => ({ ...prev, [bookId]: !currentlyFavorite }));
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const openBook = (book) => navigation.navigate('BookDetail', { book });

  const openReader = (book) =>
    navigation.navigate('PDFViewScreen', {
      book, bookId: book?.id, pdfPath: book?.pdf_path || null, pdfUrl: book?.pdf_url,
    });

  const openPlayer = (book) => navigation.navigate('AudioPlayer', { book });

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction color={COLORS.TEXT} onPress={() => navigation.goBack()} />
        <Appbar.Content title={category} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      {loading && books.length === 0 ? (
        <ShelfSkeleton count={6} />
      ) : (
        <FlatList
          data={books}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <BookCard
                book={item}
                onPress={() => openBook(item)}
                onReadPress={() => openReader(item)}
                onListenPress={item.audio_url ? () => openPlayer(item) : undefined}
              />
              <Text
                onPress={() => toggleFavorite(item.id)}
                accessibilityRole="button"
                accessibilityLabel={favorites[item.id] ? 'Remove from favorites' : 'Add to favorites'}
                style={[styles.favoriteHint, favorites[item.id] && styles.favoriteHintActive]}
              >
                {favorites[item.id] ? '♥ Saved' : '♡ Save'}
              </Text>
            </View>
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ACCENT} />
          }
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              <Text style={styles.categoryTitle}>{category} Books</Text>
              <Text style={styles.bookCount}>
                {books.length} book{books.length !== 1 ? 's' : ''} available
              </Text>
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="book-outline"
                title={`No books in ${category} yet`}
                message="Check back later for new additions in this category."
              />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  appbar: {
    backgroundColor: COLORS.SURFACE,
  },
  appbarTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT,
  },
  listContainer: {
    padding: SPACING.MD,
  },
  headerContainer: {
    marginBottom: SPACING.MD,
    paddingBottom: SPACING.SM_MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.DIVIDER,
  },
  categoryTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.TEXT,
  },
  bookCount: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.TEXT_MUTED,
    marginTop: 4,
  },
  cardWrapper: {
    marginBottom: SPACING.XS,
  },
  favoriteHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_MUTED,
    alignSelf: 'flex-end',
    marginTop: -SPACING.SM,
    marginBottom: SPACING.SM,
    paddingHorizontal: SPACING.SM,
  },
  favoriteHintActive: {
    color: COLORS.ERROR,
  },
});

export default CategoryBooksScreen;
