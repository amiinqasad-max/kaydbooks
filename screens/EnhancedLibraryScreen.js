import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Text } from 'react-native';
import { Appbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { BookCard, EmptyState, ShelfSkeleton } from '../components/ui';
import {
  getFavorites,
  getContinueReadingBooks,
  getContinueListeningBooks,
  getUserDownloads,
  removeFromFavorites,
  removeDownloadRecord,
} from '../services/supabase';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

// PHASE 2 rewrite (#14: Library, ownership + progress).
//
// Two real findings fixed here:
//   - This screen had no "Continue Listening" section at all, even though
//     services/supabase.js has had a working getContinueListeningBooks
//     (audio_progress-backed, same shape as getContinueReadingBooks) since
//     Phase 0/1 -- Library only ever surfaced ebook progress. Given
//     KaydBooks' own "read + listen + continue" identity (Phase 2 brief
//     header) and #13's read<->listen parity requirement, that's a real
//     content gap, not a design choice -- added as a fourth tab using the
//     function that already existed and was already used elsewhere
//     (ModernHomeScreen's "Continue Listening" shelf).
//   - Row rendering used `fontFamily: FONTS.MEDIUM`, a token that does not
//     exist on the FONTS object (only REGULAR/BOLD/SERIF) -- silently
//     resolved to the platform default font, not a crash, but not the
//     intended weight either. Replaced with the TYPOGRAPHY scale, which
//     doesn't have this class of bug (every entry carries a real
//     fontWeight).
//
// Row rendering itself now uses the shared BookCard component (which
// already renders a progress bar + Read/Listen actions) instead of a
// bespoke TouchableOpacity row -- the same component CategoryBooksScreen
// was moved onto earlier this phase.
const TABS = [
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'reading', label: 'Continue Reading', icon: 'book-open-page-variant' },
  { key: 'listening', label: 'Continue Listening', icon: 'headphones' },
  { key: 'downloads', label: 'Downloads', icon: 'download' },
];

const EMPTY_MESSAGES = {
  favorites: { icon: 'heart-outline', title: 'No Favorites Yet', subtitle: 'Books you favorite will appear here.' },
  reading: { icon: 'book-outline', title: 'No Reading in Progress', subtitle: 'Books you start reading will appear here.' },
  listening: { icon: 'headphones', title: 'No Listening in Progress', subtitle: 'Audiobooks you start listening to will appear here.' },
  downloads: { icon: 'download-outline', title: 'No Downloads Yet', subtitle: 'Downloaded books will appear here.' },
};

const EnhancedLibraryScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [continueListening, setContinueListening] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const styles = createStyles(colors);

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
        setFavorites((await getFavorites(user.id)) || []);
      } else if (activeTab === 'downloads') {
        setDownloads((await getUserDownloads(user.id)) || []);
      } else if (activeTab === 'reading') {
        setContinueReading((await getContinueReadingBooks(user.id)) || []);
      } else if (activeTab === 'listening') {
        setContinueListening((await getContinueListeningBooks(user.id)) || []);
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
      setFavorites((prev) => prev.filter((item) => (item.books?.id || item.id) !== bookId));
    } catch (error) {
      console.error('Error removing favorite:', error);
    }
  };

  const handleRemoveDownload = async (bookId) => {
    try {
      await removeDownloadRecord(user.id, bookId);
      setDownloads((prev) => prev.filter((item) => (item.books?.id || item.id) !== bookId));
    } catch (error) {
      console.error('Error removing download:', error);
    }
  };

  const getCurrentData = () => {
    switch (activeTab) {
      case 'favorites': return favorites;
      case 'downloads': return downloads;
      case 'reading': return continueReading;
      case 'listening': return continueListening;
      default: return [];
    }
  };

  const openReader = (book) =>
    navigation.navigate('PDFViewScreen', { book, bookId: book?.id, pdfPath: book?.pdf_path || null, pdfUrl: book?.pdf_url });
  const openPlayer = (book) => navigation.navigate('AudioPlayer', { book });
  const openDetail = (book) => navigation.navigate('BookDetail', { book });

  const renderBookItem = ({ item }) => {
    const book = item.books || item;
    const progress = (activeTab === 'reading' || activeTab === 'listening') && typeof item.progress_percentage === 'number'
      ? item.progress_percentage
      : undefined;

    return (
      <View style={styles.cardWrapper}>
        <BookCard
          book={book}
          progress={progress}
          onPress={() => openDetail(book)}
          onReadPress={book.pdf_url ? () => openReader(book) : undefined}
          onListenPress={book.audio_url ? () => openPlayer(book) : undefined}
        />
        {activeTab === 'favorites' && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveFavorite(book.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${book.title} from favorites`}
          >
            <MaterialCommunityIcons name="heart-off" size={18} color={colors.ERROR} />
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        )}
        {activeTab === 'downloads' && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveDownload(book.id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete downloaded copy of ${book.title}`}
          >
            <MaterialCommunityIcons name="delete-outline" size={18} color={colors.ERROR} />
            <Text style={styles.removeBtnText}>Delete download</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    const message = EMPTY_MESSAGES[activeTab];
    return (
      <EmptyState
        icon={message.icon}
        title={message.title}
        message={message.subtitle}
        actionLabel="Browse Books"
        onActionPress={() => navigation.navigate('Home')}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title={t('library.title')} titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      {/* PHASE 2: fourth tab (Continue Listening) added; each tab uses the
          real accent-soft token instead of the old colors.BUTTON_LIGHT
          literal, and the TYPOGRAPHY scale instead of the nonexistent
          FONTS.MEDIUM. */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TABS}
        keyExtractor={(tab) => tab.key}
        contentContainerStyle={styles.tabContainer}
        renderItem={({ item: tab }) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <MaterialCommunityIcons name={tab.icon} size={18} color={isActive ? colors.ACCENT : colors.TEXT_SECONDARY} />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading && getCurrentData().length === 0 ? (
        <ShelfSkeleton count={4} />
      ) : (
        <FlatList
          data={getCurrentData()}
          renderItem={renderBookItem}
          keyExtractor={(item) => (item.books?.id || item.id).toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ACCENT} />}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND,
  },
  appbar: {
    backgroundColor: colors.SURFACE,
  },
  appbarTitle: {
    ...TYPOGRAPHY.h3,
    color: colors.TEXT,
  },
  tabContainer: {
    paddingHorizontal: SPACING.SM_MD,
    paddingVertical: SPACING.SM,
    backgroundColor: colors.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: colors.BORDER,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.SM_MD,
    borderRadius: BORDER_RADIUS.MD,
    marginRight: SPACING.SM,
    gap: SPACING.XS,
  },
  activeTab: {
    backgroundColor: colors.ACCENT_SOFT,
  },
  tabText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.TEXT_SECONDARY,
  },
  activeTabText: {
    color: colors.ACCENT,
    fontWeight: '700',
  },
  listContainer: {
    padding: SPACING.MD,
    flexGrow: 1,
  },
  cardWrapper: {
    marginBottom: SPACING.SM,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: -SPACING.XS,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
  },
  removeBtnText: {
    ...TYPOGRAPHY.caption,
    color: colors.ERROR,
  },
});

export default EnhancedLibraryScreen;
