import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native';
import { Card } from 'react-native-paper';
import { ProgressBar } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES } from '../constants/theme';
import { LoadingState } from '../components/ui';

const { width } = Dimensions.get('window');

const ReadingStatsScreen = ({ navigation }) => {
  const { user } = useAuth();
  
  const [stats, setStats] = useState({
    booksRead: 0,
    hoursRead: 0,
    pagesRead: 0,
    favoriteCategory: 'Fiction',
    weeklyMinutes: [0, 0, 0, 0, 0, 0, 0],
    monthlyBooks: [0, 0, 0, 0, 0, 0],
    achievements: []
  });
  const [loading, setLoading] = useState(true);

  // PHASE 1.8 FIX: `reading_sessions` rows have `created_at` (a full
  // timestamp) and `session_duration` (seconds) -- see
  // supabase/migrations/003_authorization_and_schema_fixes.sql. This used
  // to filter on a `date` column and sum `duration_minutes`, neither of
  // which exist on that table.
  const getWeeklyReadingData = async (sessions) => {
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const daySeconds = sessions?.filter(session => session.created_at?.startsWith(dateString))
        .reduce((sum, session) => sum + (session.session_duration || 0), 0) || 0;

      weeklyData[6 - i] = Math.round(daySeconds / 60); // minutes
    }

    return weeklyData;
  };

  const getMonthlyBooksData = async (completedBooks) => {
    const monthlyData = [0, 0, 0, 0, 0, 0];
    const today = new Date();
    
    for (let i = 0; i < 6; i++) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      
      const monthBooks = completedBooks?.filter(book => {
        const bookDate = new Date(book.updated_at);
        return bookDate >= month && bookDate < nextMonth;
      }).length || 0;
      
      monthlyData[5 - i] = monthBooks;
    }
    
    return monthlyData;
  };

  const calculateAchievements = (booksRead, hoursRead, sessions) => {
    const achievements = [];
    
    if (booksRead >= 1) achievements.push({ name: 'First Book', icon: 'book', color: COLORS.SUCCESS });
    if (booksRead >= 5) achievements.push({ name: 'Bookworm', icon: 'book-multiple', color: COLORS.BUTTON });
    if (booksRead >= 10) achievements.push({ name: 'Book Lover', icon: 'heart', color: COLORS.ERROR });
    if (hoursRead >= 10) achievements.push({ name: 'Dedicated Reader', icon: 'clock', color: COLORS.INFO });
    if (hoursRead >= 50) achievements.push({ name: 'Reading Master', icon: 'trophy', color: COLORS.BUTTON });
    
    // Check for reading streak (PHASE 1.8 FIX: `created_at`, not `date`)
    const recentDays = sessions?.filter(session => {
      const sessionDate = new Date(session.created_at);
      const daysDiff = (new Date() - sessionDate) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length || 0;
    
    if (recentDays >= 3) achievements.push({ name: 'Consistent Reader', icon: 'fire', color: COLORS.WARNING });
    
    return achievements;
  };

  // PHASE 1.7: `function` (hoisted) instead of `const ... = async () =>`
  // (not hoisted) -- see components/PremiumGate.js for the full rationale.
  //
  // PHASE 1.8 FIX (database reconciliation): this used to query a
  // `progress` table and a `reading_sessions` shape (`duration_minutes`,
  // `date`) that don't match anything the rest of the app writes:
  //   - Every real ebook progress write goes to `reading_progress`
  //     (services/supabase.js's updateReadingProgressDetailed) and every
  //     real audiobook progress write goes to `audio_progress` -- the
  //     `progress` table (from the original database/schema.sql) has
  //     never been written to by any code path in this app.
  //   - `reading_sessions` IS the correct table (created by migration 003
  //     with columns `session_duration`/`created_at`), but nothing in the
  //     app currently calls services/supabase.js's addReadingSession() to
  //     populate it -- so time-based stats (hours read, weekly minutes,
  //     reading streak) are honestly zero, not broken; they need session
  //     logging wired into the reader/player, which is a separate,
  //     larger feature and out of scope for this reconciliation pass.
  // Fixed to read from the tables the app actually writes (reading_progress
  // + audio_progress, matching services/supabase.js's own getReadingStats),
  // with the correct reading_sessions column names for when session
  // logging is eventually added -- rather than inventing new tables/columns
  // or fabricating numbers.
  async function loadReadingStats() {
    try {
      // "Books read" and "favorite category" count completions across BOTH
      // formats, consistent with how the rest of the app treats reading
      // and listening as two ways to finish the same book.
      const [readingResult, audioResult, sessionsResult] = await Promise.all([
        supabase
          .from('reading_progress')
          .select('book_id, last_page, updated_at, books(category)')
          .eq('user_id', user.id)
          .eq('progress_percentage', 100),
        supabase
          .from('audio_progress')
          .select('book_id, updated_at, books(category)')
          .eq('user_id', user.id)
          .eq('progress_percentage', 100),
        // Real table, correct columns -- see the note above on why this
        // will be empty until session logging is added.
        supabase
          .from('reading_sessions')
          .select('session_duration, created_at')
          .eq('user_id', user.id),
      ]);

      if (readingResult.error) throw readingResult.error;
      if (audioResult.error) throw audioResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const completedBooks = [...(readingResult.data || []), ...(audioResult.data || [])];
      const sessions = sessionsResult.data || [];

      // Pages read only has meaning for the ebook side (audio progress has
      // no page concept) -- sum from the same reading_progress rows.
      const pagesRead = (readingResult.data || []).reduce((sum, p) => sum + (p.last_page || 0), 0);

      const booksRead = completedBooks.length;
      const totalSeconds = sessions.reduce((sum, session) => sum + (session.session_duration || 0), 0);
      const hoursRead = Math.round((totalSeconds / 3600) * 10) / 10;

      // Find favorite category
      const categoryCount = {};
      completedBooks.forEach(book => {
        const category = book.books?.category || 'Unknown';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
      const favoriteCategory = Object.keys(categoryCount).length
        ? Object.keys(categoryCount).reduce((a, b) => (categoryCount[a] > categoryCount[b] ? a : b))
        : 'Not enough data yet';

      // Get weekly reading data (last 7 days)
      const weeklyMinutes = await getWeeklyReadingData(sessions);

      // Get monthly books data (last 6 months)
      const monthlyBooks = await getMonthlyBooksData(completedBooks);

      // Calculate achievements
      const achievements = calculateAchievements(booksRead, hoursRead, sessions);

      setStats({
        booksRead,
        hoursRead,
        pagesRead,
        favoriteCategory,
        weeklyMinutes,
        monthlyBooks,
        achievements
      });

    } catch (error) {
      console.error('Error loading reading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadReadingStats();
    }
  }, [user]);



  const chartConfig = {
    backgroundColor: COLORS.SURFACE,
    backgroundGradientFrom: COLORS.SURFACE,
    backgroundGradientTo: COLORS.SURFACE,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(250, 181, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: BORDER_RADIUS.MD,
    },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: COLORS.BUTTON
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState label="Loading statistics..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Overview</Text>
          
          <View style={styles.statsGrid}>
            <Card containerStyle={styles.statCard}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons name="book-multiple" size={32} color={COLORS.BUTTON} />
                <Text style={styles.statNumber}>{stats.booksRead}</Text>
                <Text style={styles.statLabel}>Books Read</Text>
              </View>
            </Card>

            <Card containerStyle={styles.statCard}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons name="clock" size={32} color={COLORS.BUTTON} />
                <Text style={styles.statNumber}>{stats.hoursRead}h</Text>
                <Text style={styles.statLabel}>Hours Read</Text>
              </View>
            </Card>

            <Card containerStyle={styles.statCard}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons name="file-document" size={32} color={COLORS.BUTTON} />
                <Text style={styles.statNumber}>{stats.pagesRead}</Text>
                <Text style={styles.statLabel}>Pages Read</Text>
              </View>
            </Card>

            <Card containerStyle={styles.statCard}>
              <View style={styles.statContent}>
                <MaterialCommunityIcons name="heart" size={32} color={COLORS.BUTTON} />
                <Text style={styles.statNumber}>{stats.favoriteCategory}</Text>
                <Text style={styles.statLabel}>Favorite Genre</Text>
              </View>
            </Card>
          </View>
        </View>

        {/* Circular Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Reading Progress</Text>
          
          <Card containerStyle={styles.progressCard}>
            <View style={styles.circularProgressContainer}>
              <AnimatedCircularProgress
                size={120}
                width={8}
                fill={Math.min((stats.booksRead / 10) * 100, 100)}
                tintColor={COLORS.BUTTON}
                backgroundColor={COLORS.PROGRESS_BACKGROUND}
                rotation={0}
              >
                {() => (
                  <View style={styles.circularProgressContent}>
                    <Text style={styles.circularProgressNumber}>{stats.booksRead}</Text>
                    <Text style={styles.circularProgressLabel}>/ 10 Books</Text>
                  </View>
                )}
              </AnimatedCircularProgress>
              
              <View style={styles.progressInfo}>
                <Text style={styles.progressTitle}>Annual Goal Progress</Text>
                <Text style={styles.progressSubtitle}>
                  {Math.round((stats.booksRead / 10) * 100)}% Complete
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Weekly Reading Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Weekly Reading</Text>
          
          <Card containerStyle={styles.chartCard}>
            <LineChart
              data={{
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                  data: stats.weeklyMinutes,
                  strokeWidth: 3,
                }]
              }}
              width={width - 60}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
            <Text style={styles.chartLabel}>Minutes read per day (last 7 days)</Text>
          </Card>
        </View>

        {/* Monthly Books Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 Monthly Progress</Text>
          
          <Card containerStyle={styles.chartCard}>
            <BarChart
              data={{
                labels: ['6m', '5m', '4m', '3m', '2m', '1m'],
                datasets: [{
                  data: stats.monthlyBooks,
                }]
              }}
              width={width - 60}
              height={200}
              chartConfig={chartConfig}
              style={styles.chart}
            />
            <Text style={styles.chartLabel}>Books completed per month</Text>
          </Card>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Achievements</Text>
          
          <View style={styles.achievementsGrid}>
            {stats.achievements.map((achievement, index) => (
              <Card key={index} containerStyle={styles.achievementCard}>
                <View style={styles.achievementContent}>
                  <MaterialCommunityIcons 
                    name={achievement.icon} 
                    size={24} 
                    color={achievement.color} 
                  />
                  <Text style={styles.achievementName}>{achievement.name}</Text>
                </View>
              </Card>
            ))}
            
            {stats.achievements.length === 0 && (
              <Card containerStyle={styles.noAchievementsCard}>
                <View style={styles.noAchievementsContent}>
                  <MaterialCommunityIcons name="trophy-outline" size={32} color={COLORS.TEXT} />
                  <Text style={styles.noAchievementsText}>
                    Start reading to unlock achievements!
                  </Text>
                </View>
              </Card>
            )}
          </View>
        </View>

        {/* Reading Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Insights</Text>
          
          <Card containerStyle={styles.insightCard}>
            <View style={styles.insightContent}>
              <MaterialCommunityIcons name="lightbulb" size={24} color={COLORS.BUTTON} />
              <Text style={styles.insightText}>
                {stats.hoursRead > 0 
                  ? `You've spent ${stats.hoursRead} hours reading! That's equivalent to ${Math.round(stats.hoursRead / 24)} full days of reading.`
                  : "Start your reading journey today! Even 15 minutes a day can help you read 12+ books per year."
                }
              </Text>
            </View>
          </Card>

          <Card containerStyle={styles.insightCard}>
            <View style={styles.insightContent}>
              <MaterialCommunityIcons name="chart-line" size={24} color={COLORS.BUTTON} />
              <Text style={styles.insightText}>
                {stats.booksRead > 0
                  ? `Your favorite genre is ${stats.favoriteCategory}. Try exploring new genres to broaden your reading experience!`
                  : "Complete your first book to see your reading preferences and get personalized recommendations."
                }
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: COMMON_STYLES.container,
  scrollView: {
    flex: 1,
  },
  loadingText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
  },
  section: {
    marginBottom: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.BUTTON,
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.MD,
    marginTop: SPACING.MD,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
  },
  statCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    width: '48%',
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statContent: {
    alignItems: 'center',
    padding: SPACING.SM,
  },
  statNumber: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.XXLARGE,
    fontWeight: 'bold',
    marginTop: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  statLabel: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.SMALL,
    opacity: 0.8,
    textAlign: 'center',
  },
  progressCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    marginHorizontal: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  circularProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  circularProgressContent: {
    alignItems: 'center',
  },
  circularProgressNumber: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.TITLE,
    fontWeight: 'bold',
  },
  circularProgressLabel: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.SMALL,
    opacity: 0.8,
  },
  progressInfo: {
    flex: 1,
    marginLeft: SPACING.LG,
  },
  progressTitle: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: '600',
    marginBottom: SPACING.XS,
  },
  progressSubtitle: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.MEDIUM,
    opacity: 0.8,
  },
  chartCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.LG,
    marginHorizontal: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACING.SM,
  },
  chart: {
    borderRadius: BORDER_RADIUS.MD,
  },
  chartLabel: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.SMALL,
    textAlign: 'center',
    marginTop: SPACING.SM,
    opacity: 0.8,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
  },
  achievementCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: BORDER_RADIUS.MD,
    width: '48%',
    marginBottom: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  achievementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.XS,
  },
  achievementName: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.SMALL,
    marginLeft: SPACING.XS,
    flex: 1,
  },
  noAchievementsCard: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  noAchievementsContent: {
    alignItems: 'center',
    padding: SPACING.LG,
  },
  noAchievementsText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.MEDIUM,
    textAlign: 'center',
    marginTop: SPACING.SM,
    opacity: 0.8,
  },
  insightCard: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.MD,
  },
  insightText: {
    ...COMMON_STYLES.text,
    fontSize: FONTS.SIZES.MEDIUM,
    flex: 1,
    marginLeft: SPACING.SM,
    lineHeight: 20,
  },
});

export default ReadingStatsScreen;
