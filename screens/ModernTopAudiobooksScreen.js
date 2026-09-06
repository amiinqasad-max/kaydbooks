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
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES, GRADIENTS } from '../constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - (SPACING.LG * 2);

const ModernTopAudiobooksScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [audiobooks, setAudiobooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    loadTopAudiobooks();
  }, []);

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function loadTopAudiobooks() {
    try {
      setLoading(true);
      const booksData = await getBooks();
      
      // Filter only books with audio_url
      const audiobooksData = booksData
        .filter(book => book.audio_url)
        .sort((a, b) => (b.id - a.id)) // Most recent first
        .slice(0, 15);
      
      setAudiobooks(audiobooksData);

      // Load favorites if user is logged in
      if (user) {
        const favoritePromises = audiobooksData.map(book => isFavorite(user.id, book.id));
        const favoriteResults = await Promise.all(favoritePromises);
        const favoriteSet = new Set();
        favoriteResults.forEach((isFav, index) => {
          if (isFav) favoriteSet.add(audiobooksData[index].id);
        });
        setFavorites(favoriteSet);
      }
    } catch (error) {
      console.error('Error loading top audiobooks:', error);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTopAudiobooks();
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

  const renderAudiobookCard = ({ item, index }) => {
    const isFav = favorites.has(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.audiobookCard, { marginTop: index === 0 ? SPACING.MD : 0 }]}
        onPress={() => navigation.navigate('BookDetail', { book: item })}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={GRADIENTS.HERO}
          style={styles.cardGradient}
        >
          {/* Audio Badge */}
          <View style={styles.audioBadge}>
            <MaterialCommunityIcons name="headphones" size={16} color={COLORS.BUTTON_TEXT} />
            <Text style={styles.audioBadgeText}>Audio</Text>
          </View>

          {/* Favorite Button */}
          <TouchableOpacity
            style={styles.favoriteBtn}
            onPress={() => toggleFavorite(item.id)}
          >
            <MaterialCommunityIcons
              name={isFav ? "heart" : "heart-outline"}
              size={24}
              color={isFav ? COLORS.ERROR : COLORS.TEXT}
            />
          </TouchableOpacity>

          <View style={styles.cardContent}>
            {/* Book Cover with Play Overlay */}
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: item.cover_url }}
                style={styles.bookCover}
                resizeMode="cover"
              />
              
              {/* Play Button Overlay */}
              <View style={styles.playOverlay}>
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.playGradient}
                >
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => navigation.navigate('AudioPlayer', { book: item })}
                  >
                    <MaterialCommunityIcons name="play" size={24} color={COLORS.TEXT} />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
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
                <MaterialCommunityIcons name="tag" size={14} color={COLORS.BUTTON} />
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>

              {/* PHASE 2 fix (#24 real data): every single card used to
                  show the literal fixed string "~2-4 hours" regardless of
                  the book's actual audio length. books.audio_duration is
                  a real column (database/schema.sql) -- shown when
                  present, omitted entirely otherwise rather than
                  fabricated. */}
              {item.audio_duration ? (
                <View style={styles.audioInfo}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.TEXT} />
                  <Text style={styles.durationText}>{item.audio_duration}</Text>
                </View>
              ) : null}

              {/* PHASE 2 fix: these were `Button` from react-native-paper
                  used with `title`/`buttonStyle`/`titleStyle` -- the
                  react-native-elements API, which paper's Button doesn't
                  have. Paper silently ignores unrecognized props, so both
                  buttons rendered with NO visible label -- same bug class
                  found in ModernTopReadsScreen.js and
                  CategoryBooksScreen.js this phase. Fixed with plain
                  TouchableOpacity + Text using the already-correct
                  listenButton/readButton styles below. */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.listenButton}
                  onPress={() => navigation.navigate('AudioPlayer', { book: item })}
                >
                  <Text style={styles.listenButtonText}>🎧 Listen Now</Text>
                </TouchableOpacity>

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
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="headphones" size={64} color={COLORS.BORDER} />
      <Text style={styles.emptyTitle}>No Audiobooks Available</Text>
      <Text style={styles.emptySubtitle}>Check back later for new audio content</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <LinearGradient
        colors={GRADIENTS.ACCENT_BUTTON}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.BUTTON_TEXT} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>🎧 Top Audiobooks</Text>
          
          {/* PHASE 2 fix: had no onPress at all -- dead, non-functional
              icon, same class fixed in ModernExploreScreen.js this phase. */}
          <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('Explore')} accessibilityLabel="Search">
            <MaterialCommunityIcons name="magnify" size={24} color={COLORS.BUTTON_TEXT} />
          </TouchableOpacity>
        </View>

        {/* PHASE 2 fix (#24 real data): "∞ Hours" and "HD Quality" were
            fixed, unmeasured labels shown regardless of the actual
            catalog -- neither total listening hours nor audio quality is
            tracked anywhere in this app. Replaced with a second real,
            computed stat (distinct categories among these audiobooks)
            instead of inventing numbers. */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{audiobooks.length}</Text>
            <Text style={styles.statLabel}>Audiobooks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{new Set(audiobooks.map((b) => b.category).filter(Boolean)).size}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Audiobooks List */}
      <FlatList
        data={audiobooks}
        renderItem={renderAudiobookCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
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
    color: COLORS.BUTTON_TEXT,
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.BUTTON_TEXT,
  },
  statLabel: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.BUTTON_TEXT,
    opacity: 0.8,
    marginTop: SPACING.XS,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(2, 25, 69, 0.3)',
    marginHorizontal: SPACING.MD,
  },
  listContainer: {
    padding: SPACING.LG,
    paddingTop: SPACING.MD,
  },
  audiobookCard: {
    width: CARD_WIDTH,
    marginBottom: SPACING.LG,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardGradient: {
    flex: 1,
    borderRadius: BORDER_RADIUS.LG,
  },
  audioBadge: {
    position: 'absolute',
    top: SPACING.MD,
    left: SPACING.MD,
    backgroundColor: COLORS.BUTTON,
    borderRadius: 15,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  audioBadgeText: {
    color: COLORS.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    marginLeft: SPACING.XS,
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
    backgroundColor: COLORS.BORDER,
  },
  playOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: BORDER_RADIUS.MD,
    borderBottomRightRadius: BORDER_RADIUS.MD,
    overflow: 'hidden',
  },
  playGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(250, 181, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
    lineHeight: 22,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
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
    color: COLORS.BUTTON,
    marginLeft: SPACING.XS,
    fontWeight: '600',
  },
  audioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  durationText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.6,
    marginLeft: SPACING.XS,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  listenButton: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  listenButtonText: {
    color: COLORS.BUTTON_TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
  },
  readButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  readButtonText: {
    color: COLORS.BUTTON,
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

export default ModernTopAudiobooksScreen;
