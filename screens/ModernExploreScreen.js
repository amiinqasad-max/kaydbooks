import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Text,
} from 'react-native';
import { Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { getBooks, addToFavorites, removeFromFavorites, isFavorite } from '../services/supabase';
import { FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState, SearchInput, Chip } from '../components/ui';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - (SPACING.LG * 3)) / 2;

const ModernExploreScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());
  const { colors, gradients } = useTheme();
  const styles = createStyles(colors);

  // PHASE 2 (#24, real data only): was a hardcoded static category list
  // that could drift from what's actually in the `books` table (missing
  // a real category, or showing an empty one). Derived from the loaded
  // books instead, so the chips always match real content.
  const categories = ['All', ...Array.from(new Set(books.map((b) => b.category).filter(Boolean))).sort()];

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    filterBooks();
  }, [books, searchQuery, selectedCategory]);

  // PHASE 1.7: `function` declarations (hoisted) instead of
  // `const ... = async () =>` / `const ... = () =>` (not hoisted) -- see
  // components/PremiumGate.js for the full rationale.
  async function loadBooks() {
    try {
      setLoading(true);
      const booksData = await getBooks();
      setBooks(booksData);

      // Load favorites if user is logged in
      if (user) {
        const favoritePromises = booksData.map(book => isFavorite(user.id, book.id));
        const favoriteResults = await Promise.all(favoritePromises);
        const favoriteSet = new Set();
        favoriteResults.forEach((isFav, index) => {
          if (isFav) favoriteSet.add(booksData[index].id);
        });
        setFavorites(favoriteSet);
      }
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterBooks() {
    let filtered = books;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(book => book.category === selectedCategory);
    }

    setFilteredBooks(filtered);
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

  // PHASE 2: shared Chip component (components/ui/Badge.js) instead of a
  // bespoke TouchableOpacity + conditional style pair.
  const renderCategoryChip = ({ item }) => (
    <Chip label={item} selected={item === selectedCategory} onPress={() => setSelectedCategory(item)} />
  );

  const renderBookCard = ({ item }) => {
    const isFav = favorites.has(item.id);
    
    return (
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => navigation.navigate('BookDetail', { book: item })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={gradients.HERO}
          style={styles.cardGradient}
        >
          {/* Book Cover */}
          <View style={styles.coverContainer}>
            <Image
              source={{ uri: item.cover_url }}
              style={styles.bookCover}
              resizeMode="cover"
            />
            
            {/* Favorite Button */}
            <TouchableOpacity
              style={styles.favoriteBtn}
              onPress={() => toggleFavorite(item.id)}
            >
              <MaterialCommunityIcons
                name={isFav ? "heart" : "heart-outline"}
                size={18}
                color={isFav ? colors.ERROR : colors.TEXT}
              />
            </TouchableOpacity>
          </View>

          {/* Book Info */}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>
              {item.author}
            </Text>
            
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.readBtn}
                onPress={() => navigation.navigate('PDFViewScreen', {
                  // PHASE 1 FIX: "PDFViewer" isn't a registered route name
                  // (App.js registers "PDFViewScreen") -- this Read button
                  // silently did nothing.
                  book: item, bookId: item?.id, pdfPath: item?.pdf_path || null, pdfUrl: item?.pdf_url,
                })}
              >
                <MaterialCommunityIcons name="book-open" size={16} color={colors.BUTTON_TEXT} />
                <Text style={styles.actionBtnText}>Read</Text>
              </TouchableOpacity>
              
              {item.audio_url && (
                <TouchableOpacity
                  style={styles.listenBtn}
                  onPress={() => navigation.navigate('AudioPlayer', { book: item })}
                >
                  <MaterialCommunityIcons name="headphones" size={16} color={colors.BUTTON} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // PHASE 2: shared component (Phase 2 #9 also asks for a distinct
  // "no-result state" for search specifically -- reflected here via the
  // message text, which differs depending on whether a search is active).
  const renderEmptyState = () => (
    <EmptyState
      icon="book-search-outline"
      title={searchQuery ? 'No matching books' : 'No Books Found'}
      message={searchQuery ? `We couldn't find a book matching "${searchQuery}".` : 'Try a different category.'}
    />
  );

  return (
    <View style={styles.container}>
      {/* Modern Header with Search */}
      <LinearGradient
        colors={gradients.ACCENT_BUTTON}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🔍 {t('explore.title')}</Text>

          {/* PHASE 2: shared SearchInput (components/ui/SearchInput.js)
              instead of a hand-rolled TextInput + icon row. */}
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('explore.searchPlaceholder')}
            style={styles.searchInputWrapper}
          />
        </View>
      </LinearGradient>

      {/* Category Filter */}
      <View style={styles.categoriesSection}>
        <FlatList
          data={categories}
          renderItem={renderCategoryChip}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        />
      </View>

      {/* Results Count. PHASE 2: removed the "tune" filter icon that sat
          here -- it had no onPress handler at all (dead, non-functional
          UI -- tapping it did nothing), and no filter sheet exists
          anywhere in the app to wire it to. Category chips above are the
          app's real, working filter mechanism. */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      {/* Books Grid */}
      <FlatList
        data={filteredBooks}
        renderItem={renderBookCard}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.booksContainer}
        columnWrapperStyle={styles.bookRow}
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
    paddingHorizontal: SPACING.LG,
  },
  headerTitle: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    color: colors.BUTTON_TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  searchInputWrapper: {
    backgroundColor: colors.BACKGROUND,
  },
  categoriesSection: {
    backgroundColor: colors.BACKGROUND,
    paddingVertical: SPACING.MD,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.LG,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  resultsText: {
    color: colors.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    opacity: 0.8,
  },
  booksContainer: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  bookRow: {
    justifyContent: 'space-between',
  },
  bookCard: {
    width: CARD_WIDTH,
    marginBottom: SPACING.LG,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.BUTTON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardGradient: {
    flex: 1,
    borderRadius: BORDER_RADIUS.LG,
  },
  coverContainer: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: SPACING.MD,
  },
  bookCover: {
    width: CARD_WIDTH - 40,
    height: 120,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: colors.BORDER,
  },
  favoriteBtn: {
    position: 'absolute',
    top: SPACING.SM,
    right: SPACING.SM,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    padding: SPACING.MD,
    flex: 1,
  },
  bookTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginBottom: SPACING.XS,
    lineHeight: 18,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.7,
    marginBottom: SPACING.SM,
  },
  categoryBadge: {
    backgroundColor: colors.ACCENT_SOFT,
    borderRadius: BORDER_RADIUS.SM,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    alignSelf: 'flex-start',
    marginBottom: SPACING.SM,
  },
  categoryBadgeText: {
    color: colors.BUTTON,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readBtn: {
    backgroundColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.SM,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.XS,
  },
  actionBtnText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    marginLeft: SPACING.XS,
  },
  listenBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.SM,
    padding: SPACING.XS,
    alignItems: 'center',
    justifyContent: 'center',
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

export default ModernExploreScreen;
