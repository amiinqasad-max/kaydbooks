import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  RefreshControl,
  Text,
} from 'react-native';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { getBooks, getContinueReadingBooks, getContinueListeningBooks, getFavorites } from '../services/supabase';
import { sanitizeBookArray, sanitizeNestedBookRecord, sanitizeBookRecord } from '../utils/bookSanitizer';
import { FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { SectionHeader, HorizontalBookList } from '../components/ui';

const { width } = Dimensions.get('window');
const AUDIOBOOK_CARD_WIDTH = 140;

const ModernHomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [topReads, setTopReads] = useState([]);
  const [topAudiobooks, setTopAudiobooks] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [continueListening, setContinueListening] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, gradients } = useTheme();
  const styles = createStyles(colors);

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Fiction': 'book-open-variant',
      'History': 'history',
      'Self Development': 'account-arrow-up',
      'Novel': 'book-open-page-variant',
      'General': 'book-multiple',
      'Diini': 'mosque',
      'Science': 'flask',
      'Technology': 'laptop',
      'Business': 'briefcase',
      'Health': 'heart-pulse'
    };
    return iconMap[category] || 'book';
  };

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  async function loadHomeData() {
    try {
      setLoading(true);
      
      // Load all books - already sanitized in getBooks()
      const allBooks = await getBooks();
      
      // DOUBLE SAFETY: Additional sanitization layer to prevent level3 undefined
      const safeBooksArray = sanitizeBookArray(allBooks);
      
      // Get top reads (most recent)
      const topReadsData = safeBooksArray.slice(0, 10);
      setTopReads(topReadsData);
      
      // Get audiobooks
      const audiobooksData = safeBooksArray.filter(book => book.audio_url).slice(0, 8);
      setTopAudiobooks(audiobooksData);
      
      // Get categories
      const uniqueCategories = [...new Set(safeBooksArray.map(book => book.category))].filter(Boolean);
      const categoryData = uniqueCategories.map(category => ({
        name: category,
        count: safeBooksArray.filter(book => book.category === category).length,
        icon: getCategoryIcon(category)
      }));
      setCategories(categoryData.slice(0, 6)); // Show max 6 categories
      
      // Get continue reading / continue listening if user is logged in.
      // These are two independent queries against reading_progress and
      // audio_progress respectively (see services/supabase.js) -- a book
      // can appear in both if the user reads AND listens to it.
      if (user) {
        const [continueReadingData, continueListeningData] = await Promise.all([
          getContinueReadingBooks(user.id),
          getContinueListeningBooks(user.id),
        ]);
        setContinueReading(continueReadingData.map(sanitizeNestedBookRecord).slice(0, 5));
        setContinueListening(continueListeningData.map(sanitizeNestedBookRecord).slice(0, 5));
      }

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHomeData();
  }, [user]);


  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  const getUserName = () => {
    if (!user) return 'Guest';
    return user.user_metadata?.name || user.email?.split('@')[0] || 'Reader';
  };

  // PHASE 2 fix (#24 real data, #30 duplicate cleanup): this used to be a
  // local, insecure guess -- `user.email?.includes('admin')` would match
  // any email containing that substring (e.g. "badminton@x.com"), and
  // `user.email === 'admin@yourdomain.com'` checked a placeholder domain
  // that was never real. AuthContext.js has provided a real, backend-
  // verified `isAdmin` (derived from `profiles.role` via the RLS-checked
  // query added in migration 003) since Phase 0 -- this screen was simply
  // never updated to use it. Now destructured from useAuth() above
  // instead of a local function.

  const renderAudiobookCard = ({ item }) => (
    <TouchableOpacity
      style={styles.audiobookCard}
      onPress={() => navigation.navigate('AudioPlayer', { book: sanitizeBookRecord(item) })}
      activeOpacity={0.8}
    >
      <View style={styles.audiobookCoverContainer}>
        <Image
          source={{ uri: item.cover_url }}
          style={styles.audiobookCover}
          resizeMode="cover"
        />
        <View style={styles.playOverlay}>
          <MaterialCommunityIcons name="play-circle" size={32} color={colors.BUTTON} />
        </View>
      </View>
      <Text style={styles.audiobookTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.audiobookAuthor} numberOfLines={1}>
        {item.author}
      </Text>
    </TouchableOpacity>
  );

  const renderContinueReadingCard = ({ item }) => {
    // Safe access to nested properties with TRIPLE SANITIZATION
    const rawBook = item?.books || item || {};
    const book = sanitizeBookRecord(rawBook); // CRITICAL: Sanitize before any use
    const coverUrl = book?.cover_url || '';
    const title = book?.title || 'Unknown Title';
    const currentPage = item?.current_page || item?.last_page || 1;
    
    return (
      <TouchableOpacity
        style={styles.continueCard}
        onPress={() => navigation.navigate('PDFViewScreen', {
          // PHASE 1 FIX: this pointed at a route named "PDFViewer", which
          // doesn't exist (App.js registers "PDFViewScreen") -- tapping
          // "Continue Reading" from Home silently did nothing.
          book,
          bookId: book?.id,
          pdfPath: book?.pdf_path || null,
          pdfUrl: book?.pdf_url,
        })}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: coverUrl }}
          style={styles.continueCover}
        resizeMode="cover"
      />
      <View style={styles.continueInfo}>
        <Text style={styles.continueTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.continueProgress}>
          {Math.round(item?.progress_percentage || 0)}% complete
        </Text>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${item?.progress_percentage || 0}%` }
            ]} 
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

  const renderContinueListeningCard = ({ item }) => {
    const rawBook = item?.books || item || {};
    const book = sanitizeBookRecord(rawBook);
    const progressPct = item?.progress_percentage || 0;

    return (
      <TouchableOpacity
        style={styles.continueCard}
        onPress={() => navigation.navigate('AudioPlayer', { book, startPosition: item?.current_position || 0 })}
        activeOpacity={0.8}
      >
        <Image source={{ uri: book?.cover_url }} style={styles.continueCover} resizeMode="cover" />
        <View style={styles.continueInfo}>
          <Text style={styles.continueTitle} numberOfLines={1}>{book?.title || 'Unknown Title'}</Text>
          <Text style={styles.continueProgress}>{Math.round(progressPct)}% complete</Text>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategoryCard = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigation.navigate('CategoryBooks', { category: item.name })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradients.HERO_STRONG}
        style={styles.categoryGradient}
      >
        <View style={styles.categoryIcon}>
          <MaterialCommunityIcons name={item.icon} size={28} color={colors.BUTTON} />
        </View>
        <Text style={styles.categoryName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.categoryCount}>
          {item.count} book{item.count !== 1 ? 's' : ''}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.BUTTON]}
            tintColor={colors.BUTTON}
          />
        }
      >
        {/* Header Section */}
        <LinearGradient
          colors={gradients.ACCENT_BUTTON}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>{t('home.welcomeBack')}</Text>
              <Text style={styles.userName}>{getUserName()}! 📚</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <MaterialCommunityIcons name="account-circle" size={32} color={colors.BUTTON_TEXT} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <TouchableOpacity
            style={styles.searchContainer}
            onPress={() => navigation.navigate('Explore')}
          >
            <MaterialCommunityIcons name="magnify" size={20} color={colors.TEXT} />
            <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Categories Section. PHASE 2: the sectionHeader/sectionTitle/
            seeAllText row was hand-copied identically 5 times in this
            file -- now the shared SectionHeader component. */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={`📚 ${t('home.browseCategories')}`}
              actionLabel={t('home.seeAll')}
              onActionPress={() => navigation.navigate('Explore')}
            />

            <FlatList
              data={categories}
              renderItem={renderCategoryCard}
              keyExtractor={(item) => item.name}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Continue Reading Section */}
        {user && continueReading.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={`📖 ${t('home.continueReading')}`}
              actionLabel={t('home.seeAll')}
              onActionPress={() => navigation.navigate('Library')}
            />

            <FlatList
              data={continueReading}
              renderItem={renderContinueReadingCard}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Continue Listening Section */}
        {user && continueListening.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="🎧 Continue Listening"
              actionLabel={t('home.seeAll')}
              onActionPress={() => navigation.navigate('Library')}
            />

            <FlatList
              data={continueListening}
              renderItem={renderContinueListeningCard}
              keyExtractor={(item) => `listen-${item.id.toString()}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Top Reads Section. PHASE 2: swapped onto the shared
            HorizontalBookList/CompactBookCard (virtualized FlatList,
            Phase 2 #23) instead of a bespoke renderItem + LinearGradient
            wrapper -- Top Reads has no behavior beyond "open BookDetail",
            which HorizontalBookList already does. */}
        <View style={styles.section}>
          <SectionHeader
            title={`🔥 ${t('home.topReads')}`}
            actionLabel={t('home.seeAll')}
            onActionPress={() => navigation.navigate('TopReads')}
          />
          <HorizontalBookList
            data={topReads}
            onBookPress={(book) => navigation.navigate('BookDetail', { book: sanitizeBookRecord(book) })}
          />
        </View>

        {/* Top Audiobooks Section */}
        <View style={styles.section}>
          <SectionHeader
            title={`🎧 ${t('home.topAudiobooks')}`}
            actionLabel={t('home.seeAll')}
            onActionPress={() => navigation.navigate('TopAudiobooks')}
          />

          <FlatList
            data={topAudiobooks}
            renderItem={renderAudiobookCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
          
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Explore')}
            >
              <LinearGradient
                colors={gradients.HERO_STRONG}
                style={styles.actionGradient}
              >
                <MaterialCommunityIcons name="compass" size={32} color={colors.BUTTON} />
                <Text style={styles.actionTitle}>Explore</Text>
                <Text style={styles.actionSubtitle}>Discover new books</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Library')}
            >
              <LinearGradient
                colors={gradients.HERO_STRONG}
                style={styles.actionGradient}
              >
                <MaterialCommunityIcons name="library" size={32} color={colors.BUTTON} />
                <Text style={styles.actionTitle}>Library</Text>
                <Text style={styles.actionSubtitle}>Your collection</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Actions (only for admin users) */}
        {user && isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Admin Actions</Text>
            
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('AdminUpload')}
              >
                <LinearGradient
                  colors={gradients.HERO_STRONG}
                  style={styles.actionGradient}
                >
                  <MaterialCommunityIcons name="upload" size={32} color={colors.BUTTON} />
                  <Text style={styles.actionTitle}>Upload Book</Text>
                  <Text style={styles.actionSubtitle}>Add new content</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('AdminManage')}
              >
                <LinearGradient
                  colors={gradients.HERO_STRONG}
                  style={styles.actionGradient}
                >
                  <MaterialCommunityIcons name="cog" size={32} color={colors.BUTTON} />
                  <Text style={styles.actionTitle}>Manage Books</Text>
                  <Text style={styles.actionSubtitle}>Edit & organize</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: SPACING.LG,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.BUTTON_TEXT,
    opacity: 0.8,
  },
  userName: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    color: colors.BUTTON_TEXT,
    marginTop: SPACING.XS,
  },
  profileButton: {
    padding: SPACING.SM,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    marginHorizontal: SPACING.LG,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: SPACING.SM,
    fontSize: FONTS.SIZES.MEDIUM,
    color: colors.TEXT,
    opacity: 0.8,
  },
  section: {
    marginBottom: SPACING.XL,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: colors.TEXT,
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.MD,
  },
  horizontalList: {
    paddingHorizontal: SPACING.LG,
  },
  audiobookCard: {
    width: AUDIOBOOK_CARD_WIDTH,
    marginRight: SPACING.MD,
    alignItems: 'center',
  },
  audiobookCoverContainer: {
    position: 'relative',
    marginBottom: SPACING.SM,
  },
  audiobookCover: {
    width: AUDIOBOOK_CARD_WIDTH - 20,
    height: 120,
    borderRadius: BORDER_RADIUS.MD,
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: BORDER_RADIUS.MD,
  },
  audiobookTitle: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    color: colors.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.XS,
    lineHeight: 16,
  },
  audiobookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
  continueCard: {
    flexDirection: 'row',
    backgroundColor: colors.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    marginRight: SPACING.MD,
    width: 280,
    borderWidth: 1,
    borderColor: colors.BORDER,
  },
  continueCover: {
    width: 60,
    height: 80,
    borderRadius: BORDER_RADIUS.SM,
    marginRight: SPACING.MD,
  },
  continueInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  continueTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginBottom: SPACING.XS,
  },
  continueProgress: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.BUTTON,
    fontWeight: '600',
    marginBottom: SPACING.SM,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.BUTTON,
    borderRadius: 2,
  },
  categoryCard: {
    width: 120,
    height: 100,
    marginRight: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.BUTTON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  categoryGradient: {
    flex: 1,
    padding: SPACING.MD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.SM,
  },
  categoryName: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    color: colors.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  categoryCount: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    gap: SPACING.MD,
  },
  actionCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: colors.BUTTON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionGradient: {
    padding: SPACING.LG,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: colors.TEXT,
    marginTop: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  actionSubtitle: {
    fontSize: FONTS.SIZES.SMALL,
    color: colors.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default ModernHomeScreen;
