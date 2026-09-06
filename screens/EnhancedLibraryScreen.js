import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Text,
} from 'react-native';
import { Button, Appbar, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  getFavorites,
  getContinueReadingBooks,
  getUserDownloads,
  removeFromFavorites,
  removeDownloadRecord,
} from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const EnhancedLibraryScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadLibraryData();
    }
  }, [user, activeTab]);

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function loadLibraryData() {
    if (!user) return;

    try {
      setLoading(true);

      if (activeTab === 'favorites') {
        const favoritesData = await getFavorites(user.id);
        setFavorites(favoritesData || []);
      } else if (activeTab === 'downloads') {
        const downloadsData = await getUserDownloads(user.id);
        setDownloads(downloadsData || []);
      } else if (activeTab === 'continue') {
        const continueData = await getContinueReadingBooks(user.id);
        setContinueReading(continueData || []);
      }
    } catch (error) {
      console.error('Error loading library data:', error);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLibraryData();
    setRefreshing(false);
  };

  const handleRemoveFavorite = async (bookId) => {
    try {
      await removeFromFavorites(user.id, bookId);
      setFavorites(prev => prev.filter(item => item.id !== bookId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  const handleRemoveDownload = async (bookId) => {
    try {
      await removeDownloadRecord(user.id, bookId);
      setDownloads(prev => prev.filter(item => item.id !== bookId));
    } catch (error) {
      console.error('Error removing download:', error);
    }
  };

  const renderBookItem = ({ item }) => {
    const book = item.books || item;
    
    return (
      <TouchableOpacity
        style={styles.bookItem}
        onPress={() => navigation.navigate('BookDetail', { book })}
      >
        <Image source={{ uri: book.cover_url }} style={styles.bookCover} />
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            by {book.author}
          </Text>
          <Text style={styles.bookCategory}>{book.category}</Text>
          
          {activeTab === 'continue' && item.progress_percentage && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Progress: {Math.round(item.progress_percentage)}%
              </Text>
              <ProgressBar
                progress={item.progress_percentage / 100}
                color={COLORS.BUTTON}
                style={styles.progressBar}
              />
            </View>
          )}
          
          <View style={styles.bookActions}>
            <Button
              mode="contained"
              style={styles.actionBtn}
              onPress={() => navigation.navigate('BookDetail', { book })}
            >
              📖 View Details
            </Button>
            
            {activeTab === 'favorites' && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemoveFavorite(book.id)}
              >
                <MaterialCommunityIcons name="heart-off" size={20} color={COLORS.ERROR} />
              </TouchableOpacity>
            )}
            
            {activeTab === 'downloads' && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemoveDownload(book.id)}
              >
                <MaterialCommunityIcons name="delete" size={20} color={COLORS.ERROR} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const emptyMessages = {
      favorites: {
        icon: 'heart-outline',
        title: 'No Favorites Yet',
        subtitle: 'Books you favorite will appear here'
      },
      downloads: {
        icon: 'download-outline',
        title: 'No Downloads Yet',
        subtitle: 'Downloaded books will appear here'
      },
      continue: {
        icon: 'book-outline',
        title: 'No Reading Progress',
        subtitle: 'Books you start reading will appear here'
      }
    };

    const message = emptyMessages[activeTab];

    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons 
          name={message.icon} 
          size={64} 
          color={COLORS.BORDER} 
        />
        <Text style={styles.emptyTitle}>{message.title}</Text>
        <Text style={styles.emptySubtitle}>{message.subtitle}</Text>
        <Button
          mode="contained"
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Home')}
        >
          Browse Books
        </Button>
      </View>
    );
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'favorites':
        return favorites;
      case 'downloads':
        return downloads;
      case 'continue':
        return continueReading;
      default:
        return [];
    }
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: COLORS.BACKGROUND }}>
        <Appbar.Content title={t('library.title')} titleStyle={COMMON_STYLES.headerTitle} />
      </Appbar.Header>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
          onPress={() => setActiveTab('favorites')}
        >
          <MaterialCommunityIcons 
            name="heart" 
            size={20} 
            color={activeTab === 'favorites' ? COLORS.BUTTON : COLORS.TEXT_SECONDARY} 
          />
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>
            Favorites
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'downloads' && styles.activeTab]}
          onPress={() => setActiveTab('downloads')}
        >
          <MaterialCommunityIcons 
            name="download" 
            size={20} 
            color={activeTab === 'downloads' ? COLORS.BUTTON : COLORS.TEXT_SECONDARY} 
          />
          <Text style={[styles.tabText, activeTab === 'downloads' && styles.activeTabText]}>
            Downloads
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'continue' && styles.activeTab]}
          onPress={() => setActiveTab('continue')}
        >
          <MaterialCommunityIcons 
            name="book-open-page-variant" 
            size={20} 
            color={activeTab === 'continue' ? COLORS.BUTTON : COLORS.TEXT_SECONDARY} 
          />
          <Text style={[styles.tabText, activeTab === 'continue' && styles.activeTabText]}>
            Continue Reading
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={getCurrentData()}
        renderItem={renderBookItem}
        keyExtractor={(item) => (item.books?.id || item.id).toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.XS,
    borderRadius: BORDER_RADIUS.MD,
  },
  activeTab: {
    backgroundColor: COLORS.BUTTON_LIGHT,
  },
  tabText: {
    marginLeft: SPACING.XS,
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: FONTS.MEDIUM,
  },
  activeTabText: {
    color: COLORS.BUTTON,
  },
  listContainer: {
    padding: SPACING.MD,
    flexGrow: 1,
  },
  bookItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
    elevation: 2,
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookCover: {
    width: 80,
    height: 120,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: COLORS.BORDER,
  },
  bookInfo: {
    flex: 1,
    marginLeft: SPACING.MD,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  bookCategory: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.BUTTON,
    marginBottom: SPACING.SM,
  },
  progressContainer: {
    marginBottom: SPACING.SM,
  },
  progressText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.XS,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  bookActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    marginRight: SPACING.SM,
  },
  removeBtn: {
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: COLORS.ERROR_LIGHT,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.XXL,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.XL,
  },
  browseBtn: {
    paddingHorizontal: SPACING.XL,
  },
});

export default EnhancedLibraryScreen;
