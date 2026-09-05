import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants/theme';

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

  if (!currentBook) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('AudioPlayer', { book: currentBook })}
      accessibilityRole="button"
      accessibilityLabel={`Now playing: ${currentBook.title}. Open full player.`}
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <Image source={{ uri: currentBook.cover_url }} style={styles.cover} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentBook.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{currentBook.author}</Text>
        </View>
        <TouchableOpacity
          style={styles.playButton}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={26} color={COLORS.TEXT} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.SURFACE || '#1c1c1e',
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  progressFill: {
    height: 2,
    backgroundColor: COLORS.BUTTON,
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
    backgroundColor: COLORS.BORDER,
  },
  info: {
    flex: 1,
    marginLeft: SPACING.SM,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  author: {
    color: COLORS.TEXT_SECONDARY,
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
