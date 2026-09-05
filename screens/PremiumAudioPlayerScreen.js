import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Modal,
  FlatList,
  Animated,
  Easing,
  Text,
} from 'react-native';
import { Button } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import {
  addToUserDownloads,
  checkIfDownloaded,
  addAudioBookmark,
  getAudioBookmarks,
  deleteAudioBookmark,
} from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { downloadAudioBook } from '../services/downloadManager';

const { width, height } = Dimensions.get('window');
const COVER_SIZE = width * 0.7;

/**
 * This screen no longer owns the playback engine -- it's a thin UI over
 * AudioPlayerContext (contexts/AudioPlayerContext.js), the single source
 * of truth also used by the persistent mini-player. Two consequences that
 * fix real bugs from the previous version:
 *   - Navigating back from here no longer stops playback (the context
 *     lives at the app root, not on this screen).
 *   - There is exactly one interval polling playback status and one place
 *     progress gets written to Supabase, so the mini-player and this
 *     screen can never show different positions for the same book.
 *
 * Also fixed here: this screen used to inject a hardcoded sample audio URL
 * (`soundjay.com/.../bell-ringing-05.wav`) whenever a book had no real
 * audio_url, which shipped fake content to users. That branch is gone --
 * a book with no audio now shows a clear, honest error state instead.
 */
const PremiumAudioPlayerScreen = ({ route, navigation }) => {
  const { book, startPosition } = route.params;
  const { user } = useAuth();
  const {
    currentBook,
    chapters,
    currentChapter,
    isPlaying,
    isLoading,
    position,
    duration,
    playbackRate,
    sleepMinutes,
    error,
    loadBook,
    toggle,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    previousChapter,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
  } = useAudioPlayer();

  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);

  const rotationValue = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const sleepTimerOptions = [5, 10, 15, 30, 45, 60];

  // Only (re)load if this isn't already the book playing (e.g. arrived via
  // the mini-player, which should NOT restart from the top).
  useEffect(() => {
    if (!currentBook || currentBook.id !== book.id) {
      loadBook(book, { startPositionSeconds: startPosition });
    }
    refreshBookmarks();
    checkDownloadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    if (isPlaying) {
      startRotationAnimation();
      startWaveAnimation();
    } else {
      rotationValue.stopAnimation();
      waveAnimation.stopAnimation();
    }
  }, [isPlaying]);

  useEffect(() => {
    setSliderValue(position);
  }, [position]);

  const refreshBookmarks = async () => {
    if (!user) return;
    try {
      setBookmarks(await getAudioBookmarks(user.id, book.id));
    } catch (err) {
      console.error('Failed to load bookmarks:', err.message);
    }
  };

  const checkDownloadStatus = async () => {
    try {
      if (user) setIsDownloaded(!!(await checkIfDownloaded(user.id, book.id)));
    } catch (err) {
      console.error('Failed to check download status:', err.message);
    }
  };

  const createBookmark = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save bookmarks.');
      return;
    }
    try {
      await addAudioBookmark(user.id, book.id, position, { chapterId: currentChapter?.id });
      await refreshBookmarks();
      Alert.alert('Bookmark saved', `Saved at ${formatTime(position)}`);
    } catch (err) {
      Alert.alert('Could not save bookmark', err.message);
    }
  };

  const removeBookmark = async (bookmarkId) => {
    if (!user) return;
    try {
      await deleteAudioBookmark(user.id, bookmarkId);
      await refreshBookmarks();
    } catch (err) {
      Alert.alert('Could not remove bookmark', err.message);
    }
  };

  const downloadAudio = async () => {
    try {
      if (!user) {
        Alert.alert('Sign in required', 'Sign in to download audio files.');
        return;
      }
      if (isDownloaded) return;

      setIsDownloading(true);
      setDownloadProgress(0);

      // downloadManager resolves an authorized (signed, if gated) URL and
      // enforces the same access rules as playback -- see
      // services/downloadManager.js for why this isn't just `book.audio_url`.
      const result = await downloadAudioBook(book, user.id, (pct) => setDownloadProgress(pct));

      await addToUserDownloads(user.id, book.id, {
        download_type: 'audio',
        file_path: result.localUri,
        file_size: result.fileSize,
      });

      setIsDownloaded(true);
      Alert.alert('Downloaded', `"${book.title}" is now available offline.`);
    } catch (err) {
      Alert.alert('Download failed', err.message || 'Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const startRotationAnimation = () => {
    Animated.loop(
      Animated.timing(rotationValue, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  };

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimation, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  };

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const remaining = Math.max(duration - position, 0);

  const rotation = rotationValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const waveScale = waveAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  if (isLoading && (!currentBook || currentBook.id !== book.id)) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient colors={[COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.1)']} style={styles.gradient}>
          <MaterialCommunityIcons name="loading" size={50} color={COLORS.BUTTON} />
          <Text style={styles.loadingText}>Loading audio...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (error && (!currentBook || currentBook.id !== book.id)) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient colors={[COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.1)']} style={styles.gradient}>
          <MaterialCommunityIcons name="alert-circle-outline" size={50} color={COLORS.TEXT} />
          <Text style={styles.loadingText}>{error}</Text>
          <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: SPACING.LG }}>
            Go back
          </Button>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.05)']} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="Minimize player">
            <MaterialCommunityIcons name="chevron-down" size={28} color={COLORS.TEXT} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Now Playing</Text>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowBookmarks(true)} accessibilityLabel="Bookmarks">
            <MaterialCommunityIcons name="bookmark" size={24} color={COLORS.TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.coverContainer}>
          <Animated.View style={[styles.coverWrapper, { transform: [{ rotate: isPlaying ? rotation : '0deg' }, { scale: waveScale }] }]}>
            <Image source={{ uri: book.cover_url }} style={styles.coverImage} resizeMode="cover" />
            {isPlaying && (
              <View style={styles.playingIndicator}>
                <MaterialCommunityIcons name="music-note" size={30} color={COLORS.BUTTON} />
              </View>
            )}
          </Animated.View>
        </View>

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>by {book.author}</Text>
          {currentChapter?.title ? (
            <Text style={styles.chapterText} numberOfLines={1}>{currentChapter.title}</Text>
          ) : null}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(sliderValue)}</Text>
            <Text style={styles.timeText}>-{formatTime(Math.max(duration - sliderValue, 0))}</Text>
          </View>
          <Slider
            style={styles.progressSlider}
            value={sliderValue}
            minimumValue={0}
            maximumValue={duration || 1}
            onValueChange={setSliderValue}
            onSlidingComplete={seekTo}
            minimumTrackTintColor={COLORS.BUTTON}
            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
          />
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>{progressPercent.toFixed(1)}% complete</Text>
          </View>
        </View>

        <View style={styles.mainControls}>
          {chapters.length > 1 && (
            <TouchableOpacity style={styles.chapterButton} onPress={previousChapter} accessibilityLabel="Previous chapter">
              <MaterialCommunityIcons name="skip-previous" size={26} color={COLORS.TEXT} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.controlButton} onPress={() => skipBackward(15)} accessibilityLabel="Back 15 seconds">
            <MaterialCommunityIcons name="rewind-15" size={32} color={COLORS.TEXT} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playButton} onPress={toggle} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
            <LinearGradient colors={[COLORS.BUTTON, 'rgba(250, 181, 0, 0.8)']} style={styles.playButtonGradient}>
              <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={40} color={COLORS.BUTTON_TEXT} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => skipForward(30)} accessibilityLabel="Forward 30 seconds">
            <MaterialCommunityIcons name="fast-forward-30" size={32} color={COLORS.TEXT} />
          </TouchableOpacity>
          {chapters.length > 1 && (
            <TouchableOpacity style={styles.chapterButton} onPress={nextChapter} accessibilityLabel="Next chapter">
              <MaterialCommunityIcons name="skip-next" size={26} color={COLORS.TEXT} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.secondaryControls}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowSpeedModal(true)}>
            <MaterialCommunityIcons name="speedometer" size={24} color={COLORS.TEXT} />
            <Text style={styles.secondaryButtonText}>{playbackRate}x</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={createBookmark}>
            <MaterialCommunityIcons name="bookmark-plus" size={24} color={COLORS.TEXT} />
            <Text style={styles.secondaryButtonText}>Bookmark</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={downloadAudio} disabled={isDownloading || isDownloaded}>
            <MaterialCommunityIcons
              name={isDownloaded ? 'download-circle' : isDownloading ? 'download' : 'download-outline'}
              size={24}
              color={isDownloaded ? COLORS.SUCCESS : isDownloading ? COLORS.BUTTON : COLORS.TEXT}
            />
            <Text style={[styles.secondaryButtonText, isDownloading && { color: COLORS.BUTTON }, isDownloaded && { color: COLORS.SUCCESS }]}>
              {isDownloaded ? 'Downloaded' : isDownloading ? `${downloadProgress}%` : 'Download'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowSleepModal(true)}>
            <MaterialCommunityIcons name="sleep" size={24} color={sleepMinutes ? COLORS.BUTTON : COLORS.TEXT} />
            <Text style={[styles.secondaryButtonText, sleepMinutes && { color: COLORS.BUTTON }]}>
              {sleepMinutes ? `${sleepMinutes}m` : 'Sleep'}
            </Text>
          </TouchableOpacity>

          {sleepMinutes && (
            <TouchableOpacity style={styles.secondaryButton} onPress={clearSleepTimer}>
              <MaterialCommunityIcons name="sleep-off" size={24} color={COLORS.ERROR} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.ERROR }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={showSpeedModal} transparent animationType="slide" onRequestClose={() => setShowSpeedModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Playback Speed</Text>
              <FlatList
                data={playbackRates}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.speedOption, item === playbackRate && styles.speedOptionSelected]}
                    onPress={() => { setPlaybackRate(item); setShowSpeedModal(false); }}
                  >
                    <Text style={[styles.speedOptionText, item === playbackRate && styles.speedOptionTextSelected]}>{item}x</Text>
                  </TouchableOpacity>
                )}
              />
              <Button mode="contained" onPress={() => setShowSpeedModal(false)} style={styles.modalButton}>Cancel</Button>
            </View>
          </View>
        </Modal>

        <Modal visible={showSleepModal} transparent animationType="slide" onRequestClose={() => setShowSleepModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sleep Timer</Text>
              <FlatList
                data={sleepTimerOptions}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.sleepOption} onPress={() => { setSleepTimer(item); setShowSleepModal(false); }}>
                    <Text style={styles.sleepOptionText}>{item} minutes</Text>
                  </TouchableOpacity>
                )}
              />
              <Button mode="contained" onPress={() => setShowSleepModal(false)} style={styles.modalButton}>Cancel</Button>
            </View>
          </View>
        </Modal>

        <Modal visible={showBookmarks} transparent animationType="slide" onRequestClose={() => setShowBookmarks(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Bookmarks</Text>
              {bookmarks.length > 0 ? (
                <FlatList
                  data={bookmarks}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.bookmarkItem}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        onPress={() => { seekTo(item.position_seconds); setShowBookmarks(false); }}
                      >
                        <MaterialCommunityIcons name="bookmark" size={20} color={COLORS.BUTTON} />
                        <View style={styles.bookmarkInfo}>
                          <Text style={styles.bookmarkName}>{item.label || 'Bookmark'}</Text>
                          <Text style={styles.bookmarkTime}>{formatTime(item.position_seconds)}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeBookmark(item.id)} accessibilityLabel="Delete bookmark">
                        <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.ERROR} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              ) : (
                <Text style={styles.noBookmarksText}>No bookmarks yet</Text>
              )}
              <Button mode="contained" onPress={() => setShowBookmarks(false)} style={styles.modalButton}>Close</Button>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.TEXT, fontSize: FONTS.SIZES.MEDIUM, marginTop: SPACING.MD, textAlign: 'center', paddingHorizontal: SPACING.LG },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.LG, paddingTop: 50, paddingBottom: SPACING.LG },
  headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONTS.SIZES.LARGE, fontWeight: 'bold', color: COLORS.TEXT },
  coverContainer: { alignItems: 'center', marginVertical: SPACING.XL },
  coverWrapper: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: COVER_SIZE / 2, elevation: 20, shadowColor: COLORS.BUTTON, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },
  coverImage: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: COVER_SIZE / 2 },
  playingIndicator: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -15 }, { translateY: -15 }], width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0, 0, 0, 0.7)', alignItems: 'center', justifyContent: 'center' },
  bookInfo: { alignItems: 'center', paddingHorizontal: SPACING.LG, marginBottom: SPACING.XL },
  bookTitle: { fontSize: FONTS.SIZES.XLARGE, fontWeight: 'bold', color: COLORS.TEXT, textAlign: 'center', marginBottom: SPACING.SM },
  bookAuthor: { fontSize: FONTS.SIZES.LARGE, color: COLORS.TEXT, opacity: 0.8, textAlign: 'center', marginBottom: SPACING.XS },
  chapterText: { fontSize: FONTS.SIZES.MEDIUM, color: COLORS.BUTTON, textAlign: 'center' },
  progressContainer: { paddingHorizontal: SPACING.LG, marginBottom: SPACING.XL },
  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.SM },
  timeText: { fontSize: FONTS.SIZES.SMALL, color: COLORS.TEXT, opacity: 0.8 },
  progressSlider: { height: 40, marginBottom: SPACING.SM },
  progressInfo: { alignItems: 'center' },
  progressText: { fontSize: FONTS.SIZES.SMALL, color: COLORS.TEXT, opacity: 0.7 },
  mainControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.LG, marginBottom: SPACING.XL },
  chapterButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginHorizontal: SPACING.SM },
  controlButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center', marginHorizontal: SPACING.MD },
  playButton: { width: 80, height: 80, borderRadius: 40, marginHorizontal: SPACING.LG },
  playButtonGradient: { flex: 1, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryControls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: SPACING.LG, marginBottom: SPACING.XL },
  secondaryButton: { alignItems: 'center', padding: SPACING.SM },
  secondaryButtonText: { fontSize: FONTS.SIZES.SMALL, color: COLORS.TEXT, marginTop: SPACING.XS },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.BACKGROUND, borderRadius: BORDER_RADIUS.LG, padding: SPACING.LG, width: width * 0.8, maxHeight: height * 0.6 },
  modalTitle: { fontSize: FONTS.SIZES.LARGE, fontWeight: 'bold', color: COLORS.TEXT, textAlign: 'center', marginBottom: SPACING.LG },
  speedOption: { padding: SPACING.MD, borderRadius: BORDER_RADIUS.MD, marginBottom: SPACING.SM, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  speedOptionSelected: { backgroundColor: COLORS.BUTTON },
  speedOptionText: { fontSize: FONTS.SIZES.MEDIUM, color: COLORS.TEXT, textAlign: 'center' },
  speedOptionTextSelected: { color: COLORS.BUTTON_TEXT, fontWeight: 'bold' },
  sleepOption: { padding: SPACING.MD, borderRadius: BORDER_RADIUS.MD, marginBottom: SPACING.SM, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  sleepOptionText: { fontSize: FONTS.SIZES.MEDIUM, color: COLORS.TEXT, textAlign: 'center' },
  bookmarkItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.MD, borderRadius: BORDER_RADIUS.MD, marginBottom: SPACING.SM, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  bookmarkInfo: { flex: 1, marginLeft: SPACING.MD },
  bookmarkName: { fontSize: FONTS.SIZES.MEDIUM, color: COLORS.TEXT, fontWeight: 'bold' },
  bookmarkTime: { fontSize: FONTS.SIZES.SMALL, color: COLORS.TEXT, opacity: 0.7 },
  noBookmarksText: { fontSize: FONTS.SIZES.MEDIUM, color: COLORS.TEXT, textAlign: 'center', opacity: 0.7, marginVertical: SPACING.LG },
  modalButton: { marginTop: SPACING.LG },
});

export default PremiumAudioPlayerScreen;
