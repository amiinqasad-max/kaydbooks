import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import expoAudioService from '../services/expoAudioService';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width } = Dimensions.get('window');

const MiniPlayer = ({ navigation, currentBook }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (currentBook) {
      setIsVisible(true);
      setupProgressCallback();
      checkPlaybackState();
    } else {
      setIsVisible(false);
    }

    return () => {
      expoAudioService.setProgressUpdateCallback(null);
    };
  }, [currentBook]);

  const setupProgressCallback = () => {
    expoAudioService.setProgressUpdateCallback((progress) => {
      setPosition(progress.position);
      setDuration(progress.duration);
      setIsPlaying(progress.isPlaying || false);
    });
  };

  const checkPlaybackState = async () => {
    try {
      const status = await expoAudioService.getStatus();
      setIsPlaying(status.isPlaying || false);
    } catch (error) {
      console.error('Error checking playback state:', error);
    }
  };

  const togglePlayback = async () => {
    try {
      const status = await expoAudioService.getStatus();
      
      if (status.isPlaying) {
        await expoAudioService.pause();
        setIsPlaying(false);
      } else {
        await expoAudioService.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const openFullPlayer = () => {
    if (currentBook) {
      navigation.navigate('AudioPlayer', { book: currentBook });
    }
  };

  const getProgressPercentage = () => {
    return duration > 0 ? (position / duration) * 100 : 0;
  };

  if (!isVisible || !currentBook) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(250, 181, 0, 0.1)', COLORS.BACKGROUND]}
        style={styles.gradient}
      >
        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${getProgressPercentage()}%` }
            ]} 
          />
        </View>

        <TouchableOpacity
          style={styles.content}
          onPress={openFullPlayer}
          activeOpacity={0.8}
        >
          {/* Book Cover */}
          <Image
            source={{ uri: currentBook.cover_url }}
            style={styles.coverImage}
            resizeMode="cover"
          />

          {/* Book Info */}
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={1}>
              {currentBook.title}
            </Text>
            <Text style={styles.bookAuthor} numberOfLines={1}>
              by {currentBook.author}
            </Text>
          </View>

          {/* Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={togglePlayback}
          >
            <MaterialCommunityIcons
              name={isPlaying ? "pause" : "play"}
              size={24}
              color={COLORS.BUTTON}
            />
          </TouchableOpacity>

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsVisible(false)}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={COLORS.TEXT}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: COLORS.BUTTON,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gradient: {
    borderTopLeftRadius: BORDER_RADIUS.MD,
    borderTopRightRadius: BORDER_RADIUS.MD,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.BUTTON,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  coverImage: {
    width: 50,
    height: 50,
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
    color: COLORS.TEXT,
    marginBottom: SPACING.XS,
  },
  bookAuthor: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT,
    opacity: 0.7,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(250, 181, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.SM,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
