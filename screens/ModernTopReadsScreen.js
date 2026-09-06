import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getBooks, addToFavorites, removeFromFavorites, isFavorite } from '../services/supabase';
import { FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - (SPACING.LG * 2);

const ModernTopReadsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const { colors, gradients } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    loadTopReads();
  }, []);

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function loadTopReads() {
    try {
      setLoading(true);
      const booksData = await getBooks();
      
      // Sort by some criteria to get "top reads" (you can modify this logic)
      const topBooks = booksData
        .sort((a, b) => (b.id - a.id)) // Most recent first, or add a rating field
        .slice(0, 20);
      
      setBooks(topBooks);

      // Load favorites if user is logged in
      if (user) {
        const favoritePromises = topBooks.map(book => isFavorite(user.id, book.id));
        const favoriteResults = await Promise.all(favoritePromises);
        const favoriteSet = new Set();
        favoriteResults.forEach((isFav, index) => {
          if (isFav) favoriteSet.add(topBooks[index].id);
        });
        setFavorites(favoriteSet);
      }
    } catch (error) {
      console.error('Error loading top reads:', error);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTopReads();
    setRefreshing(false);
  };

  const toggleFavorite = async (bookId) => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }

    try {
      const isFav = favorites.has(bookId);
      if (isFav) {
        await removeFromFavorites(user.id, bookId);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(bookId);
          return newSet;
        });
      } else {
        await addToFavorites(user.id, bookId);
        setFavorites(prev => new Set([...prev, bookId]));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const renderBookCard = ({ item, index }) => {
    const isFav = favorites.has(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.bookCard, { marginTop: index === 0 ? SPACING.MD : 0 }]}
        onPress={() => navigation.navigate('BookDetail', { book: item })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={gradients.HERO}
          style={styles.cardGradient}
        >
          {/* Rank Badge */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{index + 1}</Text>
          </View>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(item.id)}
          >
            <MaterialCommunityIcons
              name={isFav ? "heart" : "heart-outline"}
              size={24}
              color={isFav ? colors.ERROR : colors.TEXT}
            />
          </TouchableOpacity>

          <View style={styles.cardContent}>
            {/* Book Cover */}
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: item.cover_url }}
                style={styles.bookCover}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)']}
                style={styles.coverOverlay}
              />
            </View>

            {/* Book Info */}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                by {item.author}
              </Text>
              
              <View style={styles.categoryContainer}>
                <MaterialCommunityIcons name="tag" size={14} color={colors.BUTTON} />
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>

              <Text style={styles.pageCount}>
                {item.pages} pages
              </Text>

              {/* PHASE 2 fix: these were `Button` from react-native-paper
                  used with `title`/`buttonStyle`/`titleStyle` -- that's
                  the react-native-elements API, which paper's Button
                  doesn't have. Paper silently ignores unrecognized props,
                  so both buttons rendered with NO visible label (blank
                  pills) -- same bug class Phase 1.6 found in
                  SettingsScreen.js/DownloadsLibraryScreen.js and this
                  phase found again in CategoryBooksScreen.js. Fixed with
                  plain TouchableOpacity + Text using the styles that were
                  already correctly defined below (readButton/
                  readButtonText/listenButton/listenButtonText) but never
                  actually reachable through paper's Button. */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.readButton}
                  onPress={() => navigation.navigate('PDFViewScreen', {
                    // PHASE 1 FIX: "PDFViewer" isn't a registered route
                    // name (App.js registers "PDFViewScreen").
                    book: item, bookId: item?.id, pdfPath: item?.pdf_path || null, pdfUrl: item?.pdf_url,
                  })}
                >
                  <Text style={styles.readButtonText}>📖 Read</Text>
                </TouchableOpacity>

                {item.audio_url && (
                  <TouchableOpacity
                    style={styles.listenButton}
                    onPress={() => navigation.navigate('AudioPlayer', { book: item })}
                  >
                    <Text style={styles.listenButtonText}>🎧 Listen</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="book-open-outline" size={64} color={colors.BORDER} />
      <Text style={styles.emptyTitle}>No Books Available</Text>
      <Text style={styles.emptySubtitle}>Check back later for new releases</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <LinearGradient
        colors={gradients.ACCENT_BUTTON}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.BUTTON_TEXT} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>📚 Top Reads</Text>
          
          {/* PHASE 2 fix: had no onPress at all -- dead, non-functional
              icon, same class fixed in ModernExploreScreen.js this phase. */}
          <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Explore')} accessibilityLabel="Search">
            <MaterialCommunityIcons name="magnify" size={24} color={colors.BUTTON_TEXT} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Books List */}
      <FlatList
        data={books}
        renderItem={renderBookCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.BUTTON]}
            tintColor={colors.BUTTON}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: SPACING.LG,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 25, 69, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    color: colors.BUTTON_TEXT,
    flex: 1,
    textAlign: 'center',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(2, 25, 69, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    padding: SPACING.LG,
    paddingTop: SPACING.MD,
  },
  bookCard: {
    width: CARD_WIDTH,
    marginBottom: SPACING.LG,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: colors.BUTTON,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    flex: 1,
    borderRadius: BORDER_RADIUS.LG,
  },
  rankBadge: {
    position: 'absolute',
    top: SPACING.MD,
    left: SPACING.MD,
    backgroundColor: colors.BUTTON,
    borderRadius: 15,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    zIndex: 2,
  },
  rankText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
  },
  favoriteBtn: {
    position: 'absolute',
    top: SPACING.MD,
    right: SPACING.MD,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  cardContent: {
    flexDirection: 'row',
    padding: SPACING.LG,
  },
  coverContainer: {
    position: 'relative',
    marginRight: SPACING.LG,
  },
  bookCover: {
    width: 100,
    height: 140,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: colors.BORDER,
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    borderBottomLeftRadius: BORDER_RADIUS.MD,
    borderBottomRightRadius: BORDER_RADIUS.MD,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginBottom: SPACING.XS,
    lineHeight: 22,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT,
    opacity: 0.8,
    marginBottom: SPACING.SM,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  categoryText: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.BUTTON,
    marginLeft: SPACING.XS,
    fontWeight: '600',
  },
  pageCount: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.6,
    marginBottom: SPACING.MD,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  readButton: {
    backgroundColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  readButtonText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
  },
  listenButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  listenButtonText: {
    color: colors.BUTTON,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XXL,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  emptySubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default ModernTopReadsScreen;
