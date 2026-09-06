import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Searchbar,
  Chip,
  Surface,
  IconButton,
  Menu,
  FAB,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getBooks, deleteBook, updateBook } from '../services/supabase';
import { sanitizeBookArray } from '../utils/bookSanitizer';
import { FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Books' },
  { key: 'premium', label: 'Premium' },
  { key: 'featured', label: 'Featured' },
  { key: 'regular', label: 'Regular' },
];

const AdminManageScreen = () => {
  const navigation = useNavigation();
  
  // State
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [menuVisible, setMenuVisible] = useState({});
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // Load books
  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading books...');
      const booksData = await getBooks();
      console.log('Books loaded:', booksData?.length || 0, 'books');
      
      // DOUBLE SAFETY: Additional sanitization layer for admin screen
      const safeBooksData = sanitizeBookArray(booksData || []);
      setBooks(safeBooksData);
      
      // If no books found, show info message
      if (!safeBooksData || safeBooksData.length === 0) {
        console.log('No books found in database');
      }
    } catch (error) {
      console.error('Error loading books:', error);
      Alert.alert('Error', 'Failed to load books: ' + error.message);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBooks();
    setRefreshing(false);
  }, [loadBooks]);

  // Load books on screen focus
  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  // Filter books based on search and filter
  useEffect(() => {
    let filtered = [...books];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(book => 
        book.title?.toLowerCase().includes(query) ||
        book.author?.toLowerCase().includes(query) ||
        book.category?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(book => {
        switch (selectedFilter) {
          case 'premium':
            return book.is_premium;
          case 'featured':
            return book.is_featured;
          case 'regular':
            return !book.is_premium && !book.is_featured;
          default:
            return true;
        }
      });
    }

    setFilteredBooks(filtered);
  }, [books, searchQuery, selectedFilter]);

  // Delete book handler
  const handleDeleteBook = useCallback(async (bookId, bookTitle) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${bookTitle}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBook(bookId);
              Alert.alert('Success', 'Book deleted successfully');
              await loadBooks();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete book: ' + error.message);
            }
          },
        },
      ]
    );
  }, [loadBooks]);

  // Toggle book status
  const handleToggleStatus = useCallback(async (bookId, field, currentValue, bookTitle) => {
    const newValue = !currentValue;
    const statusName = field === 'is_premium' ? 'Premium' : 'Featured';
    
    try {
      await updateBook(bookId, { [field]: newValue });
      Alert.alert('Success', `"${bookTitle}" ${newValue ? 'marked as' : 'removed from'} ${statusName}`);
      await loadBooks();
    } catch (error) {
      Alert.alert('Error', `Failed to update book status: ${error.message}`);
    }
  }, [loadBooks]);

  // Menu handlers
  const toggleMenu = (bookId) => {
    setMenuVisible(prev => ({
      ...prev,
      [bookId]: !prev[bookId]
    }));
  };

  const closeMenu = (bookId) => {
    setMenuVisible(prev => ({
      ...prev,
      [bookId]: false
    }));
  };

  // Render book card
  const renderBookCard = useCallback((book) => {
    if (!book || !book.id) return null;

    return (
      <Card key={book.id} style={styles.bookCard} elevation={2}>
        <View style={styles.bookCardContent}>
          
          {/* Book Cover */}
          <View style={styles.coverContainer}>
            {book.cover_url ? (
              <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
            ) : (
              <View style={styles.placeholderCover}>
                <Text style={styles.placeholderText}>📚</Text>
              </View>
            )}
          </View>

          {/* Book Info */}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>
              {book.title || 'Untitled'}
            </Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>
              by {book.author || 'Unknown Author'}
            </Text>
            <Text style={styles.bookCategory} numberOfLines={1}>
              {book.category || 'Uncategorized'}
            </Text>

            {/* Status Chips */}
            <View style={styles.statusChips}>
              {book.is_premium && (
                <Chip style={styles.premiumChip} textStyle={styles.chipText} compact>
                  💎 Premium
                </Chip>
              )}
              {book.is_featured && (
                <Chip style={styles.featuredChip} textStyle={styles.chipText} compact>
                  ⭐ Featured
                </Chip>
              )}
              {book.audio_url && (
                <Chip style={styles.audioChip} textStyle={styles.chipText} compact>
                  🎵 Audio
                </Chip>
              )}
            </View>
          </View>

          {/* Actions Menu */}
          <View style={styles.actionsContainer}>
            <Menu
              visible={menuVisible[book.id] || false}
              onDismiss={() => closeMenu(book.id)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={24}
                  onPress={() => toggleMenu(book.id)}
                />
              }
              contentStyle={styles.menuContent}
            >
              <Menu.Item
                onPress={() => {
                  closeMenu(book.id);
                  handleToggleStatus(book.id, 'is_premium', book.is_premium, book.title);
                }}
                title={book.is_premium ? 'Remove Premium' : 'Make Premium'}
                leadingIcon={book.is_premium ? 'diamond-stone' : 'diamond-outline'}
              />
              <Menu.Item
                onPress={() => {
                  closeMenu(book.id);
                  handleToggleStatus(book.id, 'is_featured', book.is_featured, book.title);
                }}
                title={book.is_featured ? 'Remove Featured' : 'Make Featured'}
                leadingIcon={book.is_featured ? 'star' : 'star-outline'}
              />
              <Menu.Item
                onPress={() => {
                  closeMenu(book.id);
                  handleDeleteBook(book.id, book.title);
                }}
                title="Delete Book"
                leadingIcon="delete"
                titleStyle={styles.deleteMenuText}
              />
            </Menu>
          </View>

        </View>
      </Card>
    );
  }, [menuVisible, handleToggleStatus, handleDeleteBook, styles]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading books...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Header */}
      <Surface style={styles.headerSurface} elevation={1}>
        <Text style={styles.title}>📚 Manage Books</Text>
        <Text style={styles.subtitle}>
          {books.length} book{books.length !== 1 ? 's' : ''} in library
        </Text>

        {/* Search Bar */}
        <Searchbar
          placeholder="Search books, authors, categories..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
          {FILTER_OPTIONS.map((filter) => (
            <Chip
              key={filter.key}
              selected={selectedFilter === filter.key}
              onPress={() => setSelectedFilter(filter.key)}
              style={[
                styles.filterChip,
                selectedFilter === filter.key && styles.selectedFilterChip
              ]}
              textStyle={[
                styles.filterChipText,
                selectedFilter === filter.key && styles.selectedFilterChipText
              ]}
            >
              {filter.label}
            </Chip>
          ))}
        </ScrollView>
      </Surface>

      {/* Books List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredBooks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery || selectedFilter !== 'all' ? 'No books found' : 'No books yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedFilter !== 'all' 
                ? 'Try adjusting your search or filter'
                : 'Upload your first book to get started'
              }
            </Text>
            {(!searchQuery && selectedFilter === 'all') && (
              <Button
                mode="contained"
                onPress={() => navigation.navigate('AdminUpload')}
                style={styles.emptyButton}
                icon="plus"
              >
                Upload First Book
              </Button>
            )}
          </View>
        ) : (
          filteredBooks.map(renderBookCard)
        )}
      </ScrollView>

      {/* Floating Action Button */}
      {books.length > 0 && (
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={() => navigation.navigate('AdminUpload')}
          label="Upload"
        />
      )}

    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND, // Dark blue #021945
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.BACKGROUND, // Dark blue
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT_SECONDARY, // Light gray
    marginTop: SPACING.MD,
  },
  headerSurface: {
    backgroundColor: colors.BACKGROUND, // Dark blue
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: colors.BORDER,
  },
  title: {
    fontSize: FONTS.SIZES.HEADER,
    color: colors.TEXT, // White text
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT_SECONDARY, // Light gray
    textAlign: 'center',
    marginBottom: SPACING.MD,
  },
  searchBar: {
    backgroundColor: colors.BACKGROUND, // Dark blue
    marginBottom: SPACING.MD,
  },
  searchInput: {
    color: colors.TEXT, // White text
  },
  filtersContainer: {
    marginBottom: SPACING.SM,
  },
  filterChip: {
    marginRight: SPACING.SM,
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderWidth: 1,
    borderColor: colors.BORDER,
  },
  selectedFilterChip: {
    backgroundColor: colors.BUTTON, // Yellow when selected
  },
  filterChipText: {
    color: colors.TEXT, // White text
  },
  selectedFilterChipText: {
    color: colors.BUTTON_TEXT, // Dark blue text on yellow
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.MD,
    paddingBottom: 100, // Space for FAB
  },
  bookCard: {
    marginBottom: SPACING.MD,
    backgroundColor: colors.BACKGROUND, // Dark blue
    borderWidth: 1,
    borderColor: colors.BORDER,
    borderRadius: BORDER_RADIUS.MD,
  },
  bookCardContent: {
    flexDirection: 'row',
    padding: SPACING.MD,
  },
  coverContainer: {
    marginRight: SPACING.MD,
  },
  coverImage: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: colors.BACKGROUND, // Dark blue
  },
  placeholderCover: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: colors.BACKGROUND, // Dark blue
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.TEXT_SECONDARY, // Light gray border
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 24,
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  bookTitle: {
    fontSize: FONTS.SIZES.LARGE,
    color: colors.TEXT, // White text
    fontWeight: '600',
    marginBottom: SPACING.XS,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT_SECONDARY, // Light gray
    marginBottom: SPACING.XS,
  },
  bookCategory: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT_SECONDARY, // Light gray
    marginBottom: SPACING.SM,
  },
  statusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.XS,
  },
  premiumChip: {
    backgroundColor: colors.BUTTON, // Yellow
  },
  featuredChip: {
    backgroundColor: colors.SUCCESS, // Green
  },
  audioChip: {
    backgroundColor: colors.INFO, // Blue
  },
  chipText: {
    color: colors.BUTTON_TEXT, // Dark blue text
    fontSize: 10,
    fontWeight: '600',
  },
  actionsContainer: {
    alignItems: 'flex-end',
  },
  menuContent: {
    backgroundColor: colors.BACKGROUND, // Dark blue
  },
  deleteMenuText: {
    color: colors.ERROR, // Red
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.XL,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.MD,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.LARGE,
    color: colors.TEXT, // White text
    fontWeight: '600',
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT_SECONDARY, // Light gray
    textAlign: 'center',
    marginBottom: SPACING.LG,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: colors.BUTTON, // Yellow
    borderRadius: BORDER_RADIUS.SM,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: colors.BUTTON, // Yellow
  },
});

export default AdminManageScreen;
