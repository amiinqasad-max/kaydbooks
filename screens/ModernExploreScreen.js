import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
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
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

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

  const categories = ['All', 'Fiction', 'History', 'Self Development', 'Novel', 'General', 'Diini'];

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

  const renderCategoryChip = ({ item }) => {
    const isSelected = item === selectedCategory;
    
    return (
      <TouchableOpacity
        style={[styles.categoryChip, isSelected && styles.selectedCategoryChip]}
        onPress={() => setSelectedCategory(item)}
      >
        <Text style={[styles.categoryChipText, isSelected && styles.selectedCategoryChipText]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBookCard = ({ item }) => {
    const isFav = favorites.has(item.id);
    
    return (
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => navigation.navigate('BookDetail', { book: item })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(250, 181, 0, 0.05)', 'rgba(2, 25, 69, 0.95)']}
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
                color={isFav ? COLORS.ERROR : COLORS.TEXT}
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
                <MaterialCommunityIcons name="book-open" size={16} color={COLORS.BUTTON_TEXT} />
                <Text style={styles.actionBtnText}>Read</Text>
              </TouchableOpacity>
              
              {item.audio_url && (
                <TouchableOpacity
                  style={styles.listenBtn}
                  onPress={() => navigation.navigate('AudioPlayer', { book: item })}
                >
                  <MaterialCommunityIcons name="headphones" size={16} color={COLORS.BUTTON} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="book-search-outline" size={64} color={COLORS.BORDER} />
      <Text style={styles.emptyTitle}>No Books Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? `No results for "${searchQuery}"` : 'Try a different category'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Modern Header with Search */}
      <LinearGradient
        colors={[COLORS.BUTTON, 'rgba(250, 181, 0, 0.8)']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🔍 {t('explore.title')}</Text>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color={COLORS.TEXT} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('explore.searchPlaceholder')}
              placeholderTextColor={COLORS.TEXT}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.TEXT} />
              </TouchableOpacity>
            )}
          </View>
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

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {filteredBooks.length} book{filteredBooks.length !== 1 ? 's' : ''} found
        </Text>
        <TouchableOpacity style={styles.filterBtn}>
          <MaterialCommunityIcons name="tune" size={20} color={COLORS.BUTTON} />
        </TouchableOpacity>
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
            colors={[COLORS.BUTTON]}
            tintColor={COLORS.BUTTON}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
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
    color: COLORS.BUTTON_TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.SM,
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
  },
  categoriesSection: {
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: SPACING.MD,
  },
  categoriesContainer: {
    paddingHorizontal: SPACING.LG,
  },
  categoryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginRight: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  selectedCategoryChip: {
    backgroundColor: COLORS.BUTTON,
    borderColor: COLORS.BUTTON,
  },
  categoryChipText: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  selectedCategoryChipText: {
    color: COLORS.BUTTON_TEXT,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  resultsText: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    opacity: 0.8,
  },
  filterBtn: {
    padding: SPACING.SM,
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
    shadowColor: COLORS.BUTTON,
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
    backgroundColor: COLORS.BORDER,
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
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
    lineHeight: 18,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
    marginBottom: SPACING.SM,
  },
  categoryBadge: {
    backgroundColor: 'rgba(250, 181, 0, 0.2)',
    borderRadius: BORDER_RADIUS.SM,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    alignSelf: 'flex-start',
    marginBottom: SPACING.SM,
  },
  categoryBadgeText: {
    color: COLORS.BUTTON,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readBtn: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.SM,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.XS,
  },
  actionBtnText: {
    color: COLORS.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    marginLeft: SPACING.XS,
  },
  listenBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.BUTTON,
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
    color: COLORS.TEXT,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  emptySubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default ModernExploreScreen;
