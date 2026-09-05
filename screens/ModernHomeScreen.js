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
import { getBooks, getContinueReadingBooks, getFavorites } from '../services/supabase';
import { sanitizeBookArray, sanitizeNestedBookRecord, sanitizeBookRecord } from '../utils/bookSanitizer';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';

const { width } = Dimensions.get('window');
const BOOK_CARD_WIDTH = 120;
const AUDIOBOOK_CARD_WIDTH = 140;

const ModernHomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [topReads, setTopReads] = useState([]);
  const [topAudiobooks, setTopAudiobooks] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, [user]);

  const loadHomeData = async () => {
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
      
      // Get continue reading if user is logged in
      if (user) {
        const continueReadingData = await getContinueReadingBooks(user.id);
        // DOUBLE SAFETY: Additional sanitization for nested book records
        const safeContinueReading = continueReadingData.map(sanitizeNestedBookRecord);
        setContinueReading(safeContinueReading.slice(0, 5));
      }
      
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  const getUserName = () => {
    if (!user) return 'Guest';
    return user.user_metadata?.name || user.email?.split('@')[0] || 'Reader';
  };

  const isAdmin = () => {
    if (!user) return false;
    // Check if user is admin - you can customize this logic
    // Option 1: Check user metadata
    if (user.user_metadata?.role === 'admin') return true;
    // Option 2: Check email domain or specific emails
    if (user.email === 'admin@yourdomain.com') return true;
    // Option 3: Check if email contains 'admin'
    if (user.email?.includes('admin')) return true;
    return false;
  };

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

  const renderTopReadCard = ({ item }) => (
    <TouchableOpacity
      style={styles.topReadCard}
      onPress={() => navigation.navigate('BookDetail', { book: sanitizeBookRecord(item) })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(250, 181, 0, 0.1)', 'rgba(2, 25, 69, 0.9)']}
        style={styles.topReadGradient}
      >
        <Image
          source={{ uri: item.cover_url }}
          style={styles.topReadCover}
          resizeMode="cover"
        />
        <View style={styles.topReadInfo}>
          <Text style={styles.topReadTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.topReadAuthor} numberOfLines={1}>
            {item.author}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

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
          <MaterialCommunityIcons name="play-circle" size={32} color={COLORS.BUTTON} />
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
        onPress={() => navigation.navigate('PDFViewer', { 
          book: sanitizeBookRecord(book), // CRITICAL: Sanitize before navigation
          startPage: currentPage 
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

  const renderCategoryCard = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigation.navigate('CategoryBooks', { category: item.name })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(250, 181, 0, 0.2)', 'rgba(2, 25, 69, 0.9)']}
        style={styles.categoryGradient}
      >
        <View style={styles.categoryIcon}>
          <MaterialCommunityIcons name={item.icon} size={28} color={COLORS.BUTTON} />
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
            colors={[COLORS.BUTTON]}
            tintColor={COLORS.BUTTON}
          />
        }
      >
        {/* Header Section */}
        <LinearGradient
          colors={[COLORS.BUTTON, 'rgba(250, 181, 0, 0.8)']}
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
              <MaterialCommunityIcons name="account-circle" size={32} color={COLORS.BUTTON_TEXT} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <TouchableOpacity
            style={styles.searchContainer}
            onPress={() => navigation.navigate('Explore')}
          >
            <MaterialCommunityIcons name="magnify" size={20} color={COLORS.TEXT} />
            <Text style={styles.searchPlaceholder}>{t('home.searchPlaceholder')}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Categories Section */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📚 {t('home.browseCategories')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Explore')}>
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            
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
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📖 {t('home.continueReading')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Library')}>
                <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            
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

        {/* Top Reads Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 {t('home.topReads')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TopReads')}>
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={topReads}
            renderItem={renderTopReadCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* Top Audiobooks Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎧 {t('home.topAudiobooks')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TopAudiobooks')}>
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          
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
                colors={['rgba(250, 181, 0, 0.2)', 'rgba(2, 25, 69, 0.9)']}
                style={styles.actionGradient}
              >
                <MaterialCommunityIcons name="compass" size={32} color={COLORS.BUTTON} />
                <Text style={styles.actionTitle}>Explore</Text>
                <Text style={styles.actionSubtitle}>Discover new books</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('Library')}
            >
              <LinearGradient
                colors={['rgba(250, 181, 0, 0.2)', 'rgba(2, 25, 69, 0.9)']}
                style={styles.actionGradient}
              >
                <MaterialCommunityIcons name="library" size={32} color={COLORS.BUTTON} />
                <Text style={styles.actionTitle}>Library</Text>
                <Text style={styles.actionSubtitle}>Your collection</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Actions (only for admin users) */}
        {user && isAdmin() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Admin Actions</Text>
            
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('AdminUpload')}
              >
                <LinearGradient
                  colors={['rgba(250, 181, 0, 0.3)', 'rgba(2, 25, 69, 0.9)']}
                  style={styles.actionGradient}
                >
                  <MaterialCommunityIcons name="upload" size={32} color={COLORS.BUTTON} />
                  <Text style={styles.actionTitle}>Upload Book</Text>
                  <Text style={styles.actionSubtitle}>Add new content</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => navigation.navigate('AdminManage')}
              >
                <LinearGradient
                  colors={['rgba(250, 181, 0, 0.3)', 'rgba(2, 25, 69, 0.9)']}
                  style={styles.actionGradient}
                >
                  <MaterialCommunityIcons name="cog" size={32} color={COLORS.BUTTON} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
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
    color: COLORS.BUTTON_TEXT,
    opacity: 0.8,
  },
  userName: {
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
    color: COLORS.BUTTON_TEXT,
    marginTop: SPACING.XS,
  },
  profileButton: {
    padding: SPACING.SM,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
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
    color: COLORS.TEXT,
    opacity: 0.8,
  },
  section: {
    marginBottom: SPACING.XL,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.MD,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  seeAllText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.BUTTON,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: SPACING.LG,
  },
  topReadCard: {
    width: BOOK_CARD_WIDTH,
    marginRight: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  topReadGradient: {
    flex: 1,
    padding: SPACING.SM,
  },
  topReadCover: {
    width: '100%',
    height: 140,
    borderRadius: BORDER_RADIUS.SM,
    marginBottom: SPACING.SM,
  },
  topReadInfo: {
    flex: 1,
  },
  topReadTitle: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
    lineHeight: 16,
  },
  topReadAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
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
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.XS,
    lineHeight: 16,
  },
  audiobookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
  continueCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.MD,
    marginRight: SPACING.MD,
    width: 280,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
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
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  continueProgress: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.BUTTON,
    fontWeight: '600',
    marginBottom: SPACING.SM,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: COLORS.BORDER,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.BUTTON,
    borderRadius: 2,
  },
  categoryCard: {
    width: 120,
    height: 100,
    marginRight: SPACING.MD,
    borderRadius: BORDER_RADIUS.LG,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.BUTTON,
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
    backgroundColor: 'rgba(250, 181, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.SM,
  },
  categoryName: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  categoryCount: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
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
    shadowColor: COLORS.BUTTON,
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
    color: COLORS.TEXT,
    marginTop: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  actionSubtitle: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
    textAlign: 'center',
  },
});

export default ModernHomeScreen;
