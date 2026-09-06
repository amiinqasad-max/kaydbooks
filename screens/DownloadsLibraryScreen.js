import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Text,
} from 'react-native';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getUserDownloads, removeFromUserDownloads } from '../services/supabase';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { EmptyState } from '../components/ui';

const DownloadsLibraryScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [downloads, setDownloads] = useState([]);
  const [filteredDownloads, setFilteredDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    if (user) {
      loadDownloads();
    }
  }, [user]);

  useEffect(() => {
    filterDownloads();
  }, [downloads, searchQuery]);

  // PHASE 1.7: `function` declarations (hoisted) instead of
  // `const ... = async () =>` / `const ... = () =>` (not hoisted) -- see
  // components/PremiumGate.js for the full rationale.
  async function loadDownloads() {
    try {
      setLoading(true);
      const userDownloads = await getUserDownloads(user.id);
      setDownloads(userDownloads);
    } catch (error) {
      console.error('Error loading downloads:', error);
      Alert.alert('Error', 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDownloads();
    setRefreshing(false);
  };

  function filterDownloads() {
    // PHASE 1: downloaded PDFs used to be hidden here because PDF
    // downloads were disabled app-wide (see services/supabase.js's
    // addToUserDownloads). Offline ebook reading is now real -- show both.
    if (!searchQuery.trim()) {
      setFilteredDownloads(downloads);
      return;
    }

    const filtered = downloads.filter(item =>
      item.books?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.books?.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.books?.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDownloads(filtered);
  }

  const removeDownload = async (downloadItem) => {
    Alert.alert(
      'Remove Download',
      `Remove "${downloadItem.books?.title}" from your downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromUserDownloads(user.id, downloadItem.book_id, downloadItem.download_type);
              await loadDownloads(); // Refresh the list
              Alert.alert('Removed', 'Download removed from your library');
            } catch (error) {
              console.error('Error removing download:', error);
              Alert.alert('Error', 'Failed to remove download');
            }
          }
        }
      ]
    );
  };

  const openBook = (downloadItem) => {
    const book = downloadItem.books;
    if (downloadItem.download_type === 'audio') {
      navigation.navigate('AudioPlayer', { book });
    } else if (downloadItem.download_type === 'pdf') {
      // PDFViewScreen resolves the local downloaded file automatically
      // when one exists (see contexts/AudioPlayerContext.js's sibling
      // logic in PDFViewScreen for the pdf path) -- this route name and
      // param shape must match App.js's registered "PDFViewScreen" screen.
      navigation.navigate('PDFViewScreen', {
        book,
        bookId: book?.id,
        pdfPath: book?.pdf_path || null,
        pdfUrl: book?.pdf_url,
      });
    } else {
      navigation.navigate('BookDetail', { book });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderDownloadItem = ({ item }) => (
    <TouchableOpacity
      style={styles.downloadCard}
      onPress={() => openBook(item)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(250, 181, 0, 0.1)', 'rgba(2, 25, 69, 0.95)']}
        style={styles.cardGradient}
      >
        {/* Book Cover */}
        <Image
          source={{ uri: item.books?.cover_url }}
          style={styles.coverImage}
          resizeMode="cover"
        />

        {/* Book Info */}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.books?.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            by {item.books?.author}
          </Text>
          <Text style={styles.bookCategory}>{item.books?.category}</Text>
          
          <View style={styles.downloadInfo}>
            <View style={styles.downloadMeta}>
              <MaterialCommunityIcons 
                name={item.download_type === 'audio' ? 'headphones' : 'file-pdf-box'} 
                size={16} 
                color={colors.BUTTON} 
              />
              <Text style={styles.downloadType}>
                {item.download_type.toUpperCase()}
              </Text>
            </View>
            
            <Text style={styles.downloadDate}>
              Downloaded {formatDate(item.download_date)}
            </Text>
            
            <Text style={styles.fileSize}>
              {formatFileSize(item.file_size)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => openBook(item)}
          >
            <MaterialCommunityIcons 
              name={item.download_type === 'audio' ? 'play' : 'eye'} 
              size={24} 
              color={colors.BUTTON} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeDownload(item)}
          >
            <MaterialCommunityIcons name="delete" size={20} color={colors.ERROR} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  // PHASE 2: shared component, was a hand-rolled duplicate of the same
  // empty state pattern also found in EnhancedLibraryScreen.js and
  // ModernExploreScreen.js.
  const renderEmptyState = () => (
    <EmptyState
      icon="download-off"
      title="No Downloads Yet"
      message="Download books and audiobooks to access them offline"
      actionLabel="Explore Books"
      onActionPress={() => navigation.navigate('Explore')}
    />
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.BACKGROUND, 'rgba(250, 181, 0, 0.1)']}
          style={styles.gradient}
        >
          <View style={styles.loginPrompt}>
            <MaterialCommunityIcons name="account-circle" size={80} color={colors.BORDER} />
            <Text style={styles.loginTitle}>Login Required</Text>
            <Text style={styles.loginSubtitle}>Please login to view your downloads</Text>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.BUTTON, 'rgba(250, 181, 0, 0.8)']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.BUTTON_TEXT} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>📥 My Downloads</Text>
          
          <View style={styles.headerStats}>
            <Text style={styles.statsText}>{downloads.length} items</Text>
          </View>
        </View>

        {/* Search Bar */}
        {/* PHASE 1.6 FIX: this was <SearchBar> (capital B, the React Native
            Elements component -- not installed in this project) instead of
            <Searchbar>, the react-native-paper component already imported
            above. Same crash class as SettingsScreen.js's ListItem/Overlay/
            Input: undefined in JSX, throws the instant this screen renders. */}
        <Searchbar
          placeholder="Search downloads..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchContainer}
          inputStyle={styles.searchInput}
        />
      </LinearGradient>

      {/* Downloads List */}
      <FlatList
        data={filteredDownloads}
        renderItem={renderDownloadItem}
        keyExtractor={(item) => `${item.user_id}-${item.book_id}-${item.download_type}`}
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
        ListEmptyComponent={!loading ? renderEmptyState : null}
      />
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND,
  },
  gradient: {
    flex: 1,
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
    marginBottom: SPACING.MD,
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
  headerStats: {
    alignItems: 'center',
  },
  statsText: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.BUTTON_TEXT,
    opacity: 0.8,
  },
  searchContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: SPACING.LG,
  },
  searchInputContainer: {
    backgroundColor: colors.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchInput: {
    color: colors.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
  },
  listContainer: {
    padding: SPACING.LG,
  },
  downloadCard: {
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
    flexDirection: 'row',
    padding: SPACING.LG,
    alignItems: 'center',
  },
  coverImage: {
    width: 80,
    height: 100,
    borderRadius: BORDER_RADIUS.SM,
    marginRight: SPACING.MD,
  },
  bookInfo: {
    flex: 1,
    marginRight: SPACING.MD,
  },
  bookTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginBottom: SPACING.XS,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.8,
    marginBottom: SPACING.XS,
  },
  bookCategory: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.BUTTON,
    marginBottom: SPACING.SM,
  },
  downloadInfo: {
    gap: SPACING.XS,
  },
  downloadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  downloadType: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.BUTTON,
    fontWeight: 'bold',
  },
  downloadDate: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.7,
  },
  fileSize: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.6,
  },
  actions: {
    alignItems: 'center',
    gap: SPACING.SM,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(250, 181, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.XL * 2,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.LARGE,
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
    marginBottom: SPACING.XL,
    paddingHorizontal: SPACING.LG,
  },
  exploreButton: {
    backgroundColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.MD,
  },
  exploreButtonText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.LG,
  },
  loginTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  loginSubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: SPACING.XL,
  },
  loginButton: {
    backgroundColor: colors.BUTTON,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.MD,
  },
  loginButtonText: {
    color: colors.BUTTON_TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
  },
});

export default DownloadsLibraryScreen;
