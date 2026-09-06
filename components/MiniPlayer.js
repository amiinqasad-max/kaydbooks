import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

/**
 * Persistent mini-player. Mounted once (see navigation/TabNavigator.js) so
 * it's visible from Home, Library, and Explore alike whenever a book is
 * loaded -- tapping it opens the full player. It reads from
 * AudioPlayerContext, the single source of truth for playback state, so
 * this and the full player screen can never disagree about what's playing.
 */
const MiniPlayer = () => {
  const navigation = useNavigation();
  const { currentBook, isPlaying, position, duration, toggle } = useAudioPlayer();
  const { colors } = useTheme();

  if (!currentBook) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.SURFACE, borderTopColor: colors.BORDER }]}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('AudioPlayer', { book: currentBook })}
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${currentBook.title}. Open full player.`}
    >
      <View style={[styles.progressTrack, { backgroundColor: colors.PROGRESS_BACKGROUND }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.BUTTON, width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Image source={{ uri: currentBook.cover_url }} style={[styles.cover, { backgroundColor: colors.BORDER }]} />
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.TEXT }]} numberOfLines={1}>{currentBook.title}</Text>
          <Text style={[styles.author, { color: colors.TEXT_SECONDARY }]} numberOfLines={1}>{currentBook.author}</Text>
        </View>
        <TouchableOpacity
          style={styles.playButton}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.TEXT} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.SM,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.SM,
  },
  title: {
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  author: {
    fontSize: FONTS.SIZES.SMALL - 2,
  },
  playButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
