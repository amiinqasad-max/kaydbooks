import React, { useState, useEffect, useRef } from 'react';
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
import safeAudioService from '../services/safeAudioService';
import { 
  updateAudioProgress, 
  getAudioProgress, 
  addToUserDownloads, 
  checkIfDownloaded 
} from '../services/supabase';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');
const COVER_SIZE = width * 0.7;

const PremiumAudioPlayerScreen = ({ route, navigation }) => {
  const { book, startPosition = 0 } = route.params;
  const { user } = useAuth();
  
  // Debug: Log book data (removed excessive logging)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showSleepModal, setSleepModal] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [sleepTimer, setSleepTimer] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // Animations
  const rotationValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;

  const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const sleepTimers = [5, 10, 15, 30, 45, 60]; // minutes

  useEffect(() => {
    initializePlayer();
    setupProgressCallback();
    loadBookmarks();
    checkDownloadStatus();

    return () => {
      // Cleanup handled by safeAudioService
      safeAudioService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startRotationAnimation();
      startWaveAnimation();
    } else {
      stopRotationAnimation();
      stopWaveAnimation();
    }
  }, [isPlaying]);

  const initializePlayer = async () => {
    try {
      setIsLoading(true);
      
      
      // Check if book has audio URL
      if (!book.audio_url || book.audio_url.trim() === '') {
        
        // For testing: Add a sample audio URL if none exists
        book.audio_url = 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav'; // Test audio
        
        // Alert.alert('No Audio', 'This book does not have an audio version available.');
        // setIsLoading(false);
        // return;
      }
      
      // Load saved progress
      let savedPosition = startPosition;
      if (user) {
        const progressData = await getAudioProgress(user.id, book.id);
        if (progressData && progressData.current_position) {
          savedPosition = progressData.current_position;
        }
      }

      const success = await safeAudioService.loadBook(book, user?.id, savedPosition);
      
      if (success) {
        const status = await safeAudioService.getStatus();
        
        if (status && status.durationMillis) {
          setDuration(status.durationMillis / 1000);
          setPosition(savedPosition);
        } else {
          // Fallback: set some duration for testing
          setDuration(1800); // 30 minutes fallback
          setPosition(0);
        }
      } else {
        Alert.alert('Error', 'Failed to load audio. The audio file might be unavailable or corrupted.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to load audio: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const setupProgressCallback = () => {
    // Set up interval to check audio status
    const progressInterval = setInterval(async () => {
      try {
        const status = await safeAudioService.getStatus();
        if (status.isLoaded) {
          const currentPosition = status.positionMillis / 1000;
          const currentDuration = status.durationMillis / 1000;
          
          setPosition(currentPosition);
          setDuration(currentDuration);
          setIsPlaying(status.isPlaying);
          
          // Auto-save progress every 10 seconds
          if (user && Math.floor(currentPosition) % 10 === 0) {
            updateAudioProgress(user.id, book.id, currentPosition, currentDuration);
          }
        }
      } catch (error) {
        // Silently handle status errors
      }
    }, 1000);
    
    return () => clearInterval(progressInterval);
  };

  const saveProgressToSupabase = async (pos, dur, percent) => {
    try {
      await updateAudioProgress(user.id, book.id, {
        current_position: pos,
        total_duration: dur,
        progress_percentage: percent,
        last_listened: new Date().toISOString(),
      });
    } catch (error) {
      // Silently handle progress save errors
    }
  };

  const loadBookmarks = async () => {
    try {
      // Bookmarks functionality not implemented in safeAudioService yet
      // For now, initialize empty bookmarks
      setBookmarks([]);
    } catch (error) {
      // Silently handle bookmark loading errors
    }
  };

  const checkDownloadStatus = async () => {
    try {
      if (user) {
        const downloadData = await checkIfDownloaded(user.id, book.id, 'audio');
        setIsDownloaded(!!downloadData);
      }
    } catch (error) {
      // Silently handle download status check errors
    }
  };

  const togglePlayback = async () => {
    try {
      const status = await safeAudioService.getStatus();
      
      if (status.isPlaying) {
        await safeAudioService.pause();
        setIsPlaying(false);
      } else {
        await safeAudioService.play();
        setIsPlaying(true);
      }
    } catch (error) {
      // Silently handle playback toggle errors
    }
  };

  const handleSeek = async (value) => {
    try {
      await safeAudioService.seekTo(value);
      setPosition(value);
    } catch (error) {
      // Silently handle seek errors
    }
  };

  const skipForward = async () => {
    const newPosition = Math.min(position + 30, duration);
    await safeAudioService.seekTo(newPosition);
    setPosition(newPosition);
  };
  
  const skipBackward = async () => {
    const newPosition = Math.max(position - 15, 0);
    await safeAudioService.seekTo(newPosition);
    setPosition(newPosition);
  };

  const changePlaybackRate = async (rate) => {
    try {
      await safeAudioService.setRate(rate);
      setPlaybackRate(rate);
      setShowSpeedModal(false);
    } catch (error) {
      // Silently handle playback rate errors
    }
  };

  const createBookmark = async () => {
    try {
      // Simple bookmark creation without expoAudioService
      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };
      
      const bookmark = {
        id: Date.now(),
        position: position,
        title: `Bookmark at ${formatTime(position)}`,
        created_at: new Date().toISOString()
      };
      
      setBookmarks(prev => [...prev, bookmark]);
      Alert.alert('Bookmark Created', `Saved at ${formatTime(position)}`);
    } catch (error) {
      // Silently handle bookmark creation errors
    }
  };

  const goToBookmark = async (bookmark) => {
    try {
      await safeAudioService.seekTo(bookmark.position);
      setPosition(bookmark.position);
      setShowBookmarks(false);
    } catch (error) {
      // Silently handle bookmark navigation errors
    }
  };

  const setSleepTimerMinutes = async (minutes) => {
    try {
      // Simple sleep timer implementation
      setSleepTimer(minutes);
      setSleepModal(false);
      Alert.alert('Sleep Timer Set', `Audio will stop in ${minutes} minutes`);
      
      // Set timeout to pause audio after specified minutes
      setTimeout(async () => {
        await safeAudioService.pause();
        setIsPlaying(false);
        setSleepTimer(null);
        Alert.alert('Sleep Timer', 'Audio paused automatically');
      }, minutes * 60 * 1000);
    } catch (error) {
      // Silently handle sleep timer errors
    }
  };

  const clearSleepTimerAction = () => {
    setSleepTimer(null);
    Alert.alert('Sleep Timer', 'Sleep timer cleared');
  };

  const downloadAudio = async () => {
    try {
      if (!user) {
        Alert.alert('Login Required', 'Please login to download audio files');
        return;
      }

      if (!book.audio_url) {
        Alert.alert('Error', 'No audio file available for download');
        return;
      }

      if (isDownloaded) {
        Alert.alert(
          'Already Downloaded',
          'This audio file is already in your downloads library.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);

      // Create filename for the downloaded audio
      const fileName = `${book.title.replace(/[^a-zA-Z0-9]/g, '_')}_audio.mp3`;
      const fileUri = FileSystem.documentDirectory + fileName;

      // Download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        book.audio_url,
        fileUri,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(Math.round(progress * 100));
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (result) {
        // Get file size
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        // Save to user's download library in Supabase
        await addToUserDownloads(user.id, book.id, {
          download_type: 'audio',
          file_path: fileUri,
          file_size: fileInfo.size || 0
        });

        setIsDownloaded(true);
        
        Alert.alert(
          'Added to Downloads',
          `"${book.title}" has been added to your downloads library!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Download Failed', 'Failed to add to downloads. Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Animations
  const startRotationAnimation = () => {
    Animated.loop(
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const stopRotationAnimation = () => {
    rotationValue.stopAnimation();
  };

  const startWaveAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopWaveAnimation = () => {
    waveAnimation.stopAnimation();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return duration > 0 ? (position / duration) * 100 : 0;
  };

  const getRemainingTime = () => {
    return duration - position;
  };

  const rotation = rotationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const waveScale = waveAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={[COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.1)']}
          style={styles.gradient}
        >
          <MaterialCommunityIcons name="loading" size={50} color={COLORS.BUTTON} />
          <Text style={styles.loadingText}>Loading audio...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.BACKGROUND, 'rgba(250, 181, 0, 0.05)']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="chevron-down" size={28} color={COLORS.TEXT} />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Now Playing</Text>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowBookmarks(true)}
          >
            <MaterialCommunityIcons name="bookmark" size={24} color={COLORS.TEXT} />
          </TouchableOpacity>
        </View>

        {/* Book Cover */}
        <View style={styles.coverContainer}>
          <Animated.View
            style={[
              styles.coverWrapper,
              {
                transform: [
                  { rotate: isPlaying ? rotation : '0deg' },
                  { scale: waveScale },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: book.cover_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            
            {/* Playing indicator */}
            {isPlaying && (
              <View style={styles.playingIndicator}>
                <MaterialCommunityIcons name="music-note" size={30} color={COLORS.BUTTON} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* Book Info */}
        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            by {book.author}
          </Text>
          <Text style={styles.bookCategory}>{book.category}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>-{formatTime(getRemainingTime())}</Text>
          </View>
          
          <Slider
            style={styles.progressSlider}
            value={position}
            minimumValue={0}
            maximumValue={duration}
            onValueChange={setPosition}
            onSlidingComplete={handleSeek}
            minimumTrackTintColor={COLORS.BUTTON}
            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
            thumbStyle={styles.sliderThumb}
            trackStyle={styles.sliderTrack}
          />
          
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {getProgressPercentage().toFixed(1)}% complete
            </Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={skipBackward}
          >
            <MaterialCommunityIcons name="rewind-15" size={32} color={COLORS.TEXT} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
          >
            <LinearGradient
              colors={[COLORS.BUTTON, 'rgba(250, 181, 0, 0.8)']}
              style={styles.playButtonGradient}
            >
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : "play"}
                size={40}
                color={COLORS.BUTTON_TEXT}
              />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={skipForward}
          >
            <MaterialCommunityIcons name="fast-forward-30" size={32} color={COLORS.TEXT} />
          </TouchableOpacity>
        </View>

        {/* Secondary Controls */}
        <View style={styles.secondaryControls}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowSpeedModal(true)}
          >
            <MaterialCommunityIcons name="speedometer" size={24} color={COLORS.TEXT} />
            <Text style={styles.secondaryButtonText}>{playbackRate}x</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={createBookmark}
          >
            <MaterialCommunityIcons name="bookmark-plus" size={24} color={COLORS.TEXT} />
            <Text style={styles.secondaryButtonText}>Bookmark</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={downloadAudio}
            disabled={isDownloading || isDownloaded}
          >
            <MaterialCommunityIcons 
              name={isDownloaded ? "download-circle" : isDownloading ? "download" : "download-outline"} 
              size={24} 
              color={isDownloaded ? COLORS.SUCCESS : isDownloading ? COLORS.BUTTON : COLORS.TEXT} 
            />
            <Text style={[
              styles.secondaryButtonText,
              isDownloading && { color: COLORS.BUTTON },
              isDownloaded && { color: COLORS.SUCCESS }
            ]}>
              {isDownloaded ? 'Downloaded' : isDownloading ? `${downloadProgress}%` : 'Download'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setSleepModal(true)}
          >
            <MaterialCommunityIcons 
              name="sleep" 
              size={24} 
              color={sleepTimer ? COLORS.BUTTON : COLORS.TEXT} 
            />
            <Text style={[
              styles.secondaryButtonText,
              sleepTimer && { color: COLORS.BUTTON }
            ]}>
              {sleepTimer ? `${sleepTimer}m` : 'Sleep'}
            </Text>
          </TouchableOpacity>

          {sleepTimer && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={clearSleepTimerAction}
            >
              <MaterialCommunityIcons name="sleep-off" size={24} color={COLORS.ERROR} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.ERROR }]}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Speed Control Modal */}
        <Modal
          visible={showSpeedModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSpeedModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Playback Speed</Text>
              
              <FlatList
                data={playbackRates}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.speedOption,
                      item === playbackRate && styles.speedOptionSelected
                    ]}
                    onPress={() => changePlaybackRate(item)}
                  >
                    <Text style={[
                      styles.speedOptionText,
                      item === playbackRate && styles.speedOptionTextSelected
                    ]}>
                      {item}x
                    </Text>
                  </TouchableOpacity>
                )}
              />
              
              <Button
                title="Cancel"
                buttonStyle={styles.modalButton}
                titleStyle={styles.modalButtonText}
                onPress={() => setShowSpeedModal(false)}
              />
            </View>
          </View>
        </Modal>

        {/* Sleep Timer Modal */}
        <Modal
          visible={showSleepModal}
          transparent
          animationType="slide"
          onRequestClose={() => setSleepModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sleep Timer</Text>
              
              <FlatList
                data={sleepTimers}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.sleepOption}
                    onPress={() => setSleepTimerMinutes(item)}
                  >
                    <Text style={styles.sleepOptionText}>
                      {item} minutes
                    </Text>
                  </TouchableOpacity>
                )}
              />
              
              <Button
                title="Cancel"
                buttonStyle={styles.modalButton}
                titleStyle={styles.modalButtonText}
                onPress={() => setSleepModal(false)}
              />
            </View>
          </View>
        </Modal>

        {/* Bookmarks Modal */}
        <Modal
          visible={showBookmarks}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBookmarks(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Bookmarks</Text>
              
              {bookmarks.length > 0 ? (
                <FlatList
                  data={bookmarks}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.bookmarkItem}
                      onPress={() => goToBookmark(item)}
                    >
                      <MaterialCommunityIcons name="bookmark" size={20} color={COLORS.BUTTON} />
                      <View style={styles.bookmarkInfo}>
                        <Text style={styles.bookmarkName}>{item.name}</Text>
                        <Text style={styles.bookmarkTime}>
                          {formatTime(item.position)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <Text style={styles.noBookmarksText}>No bookmarks yet</Text>
              )}
              
              <Button
                title="Close"
                buttonStyle={styles.modalButton}
                titleStyle={styles.modalButtonText}
                onPress={() => setShowBookmarks(false)}
              />
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    marginTop: SPACING.MD,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: 50,
    paddingBottom: SPACING.LG,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  coverContainer: {
    alignItems: 'center',
    marginVertical: SPACING.XL,
  },
  coverWrapper: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_SIZE / 2,
    elevation: 20,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  coverImage: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: COVER_SIZE / 2,
  },
  playingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.XL,
  },
  bookTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.LARGE,
    color: COLORS.TEXT,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  bookCategory: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.BUTTON,
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.XL,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.SM,
  },
  timeText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.8,
  },
  progressSlider: {
    height: 40,
    marginBottom: SPACING.SM,
  },
  sliderThumb: {
    backgroundColor: COLORS.BUTTON,
    width: 20,
    height: 20,
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
  },
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.XL,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.LG,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginHorizontal: SPACING.XL,
  },
  playButtonGradient: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.XL,
  },
  secondaryButton: {
    alignItems: 'center',
    padding: SPACING.SM,
  },
  secondaryButtonText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    marginTop: SPACING.XS,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.LG,
    padding: SPACING.LG,
    width: width * 0.8,
    maxHeight: height * 0.6,
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  speedOption: {
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.SM,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  speedOptionSelected: {
    backgroundColor: COLORS.BUTTON,
  },
  speedOptionText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  speedOptionTextSelected: {
    color: COLORS.BUTTON_TEXT,
    fontWeight: 'bold',
  },
  sleepOption: {
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.SM,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sleepOptionText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MD,
    marginBottom: SPACING.SM,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bookmarkInfo: {
    flex: 1,
    marginLeft: SPACING.MD,
  },
  bookmarkName: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    fontWeight: 'bold',
  },
  bookmarkTime: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
  },
  noBookmarksText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT,
    textAlign: 'center',
    opacity: 0.7,
    marginVertical: SPACING.LG,
  },
  modalButton: {
    backgroundColor: COLORS.BUTTON,
    borderRadius: BORDER_RADIUS.MD,
    marginTop: SPACING.LG,
  },
  modalButtonText: {
    color: COLORS.BUTTON_TEXT,
    fontWeight: 'bold',
  },
});

export default PremiumAudioPlayerScreen;
