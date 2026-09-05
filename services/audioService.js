import TrackPlayer, {
  Capability,
  State,
  Event,
  RepeatMode,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateAudioProgress } from './supabase';

class AudioService {
  constructor() {
    this.isInitialized = false;
    this.currentBook = null;
    this.progressUpdateInterval = null;
    this.setupTrackPlayer();
  }

  async setupTrackPlayer() {
    try {
      if (this.isInitialized) return;

      await TrackPlayer.setupPlayer({
        maxCacheSize: 1024 * 10, // 10MB cache
      });

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        progressUpdateEventInterval: 1,
      });

      this.isInitialized = true;
      this.setupEventListeners();
    } catch (error) {
      console.error('Error setting up track player:', error);
    }
  }

  setupEventListeners() {
    TrackPlayer.addEventListener(Event.PlaybackState, (data) => {
      console.log('Playback state changed:', data);
    });

    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
      this.handleProgressUpdate(data);
    });

    TrackPlayer.addEventListener(Event.PlaybackTrackChanged, (data) => {
      console.log('Track changed:', data);
    });
  }

  async loadBook(book, userId = null, startPosition = 0) {
    try {
      await this.setupTrackPlayer();
      
      this.currentBook = book;
      
      const track = {
        id: book.id.toString(),
        url: book.audio_url,
        title: book.title,
        artist: book.author,
        artwork: book.cover_url,
        duration: book.audio_duration || 0,
      };

      await TrackPlayer.reset();
      await TrackPlayer.add(track);
      
      if (startPosition > 0) {
        await TrackPlayer.seekTo(startPosition);
      }

      // Load saved position from AsyncStorage
      const savedPosition = await this.getSavedPosition(book.id, userId);
      if (savedPosition > 0) {
        await TrackPlayer.seekTo(savedPosition);
      }

      return true;
    } catch (error) {
      console.error('Error loading book:', error);
      return false;
    }
  }

  async play() {
    try {
      await TrackPlayer.play();
      this.startProgressTracking();
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause() {
    try {
      await TrackPlayer.pause();
      this.stopProgressTracking();
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async stop() {
    try {
      await TrackPlayer.stop();
      this.stopProgressTracking();
    } catch (error) {
      console.error('Error stopping:', error);
    }
  }

  async seekTo(position) {
    try {
      await TrackPlayer.seekTo(position);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  async skipForward(seconds = 30) {
    try {
      const position = await TrackPlayer.getPosition();
      await TrackPlayer.seekTo(position + seconds);
    } catch (error) {
      console.error('Error skipping forward:', error);
    }
  }

  async skipBackward(seconds = 15) {
    try {
      const position = await TrackPlayer.getPosition();
      const newPosition = Math.max(0, position - seconds);
      await TrackPlayer.seekTo(newPosition);
    } catch (error) {
      console.error('Error skipping backward:', error);
    }
  }

  async setRate(rate) {
    try {
      await TrackPlayer.setRate(rate);
    } catch (error) {
      console.error('Error setting rate:', error);
    }
  }

  async getState() {
    try {
      return await TrackPlayer.getState();
    } catch (error) {
      console.error('Error getting state:', error);
      return State.None;
    }
  }

  async getPosition() {
    try {
      return await TrackPlayer.getPosition();
    } catch (error) {
      console.error('Error getting position:', error);
      return 0;
    }
  }

  async getDuration() {
    try {
      return await TrackPlayer.getDuration();
    } catch (error) {
      console.error('Error getting duration:', error);
      return 0;
    }
  }

  async getProgress() {
    try {
      return await TrackPlayer.getProgress();
    } catch (error) {
      console.error('Error getting progress:', error);
      return { position: 0, duration: 0, buffered: 0 };
    }
  }

  startProgressTracking() {
    if (this.progressUpdateInterval) return;

    this.progressUpdateInterval = setInterval(async () => {
      try {
        const progress = await this.getProgress();
        if (this.currentBook && progress.position > 0) {
          await this.saveProgress(this.currentBook.id, progress.position, progress.duration);
        }
      } catch (error) {
        console.error('Error tracking progress:', error);
      }
    }, 5000); // Update every 5 seconds
  }

  stopProgressTracking() {
    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval);
      this.progressUpdateInterval = null;
    }
  }

  async saveProgress(bookId, position, duration) {
    try {
      // Save to AsyncStorage for offline access
      const progressData = {
        position,
        duration,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(
        `audio_progress_${bookId}`,
        JSON.stringify(progressData)
      );

      // Save to Supabase if user is logged in
      // This will be called from the component with user context
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }

  async getSavedPosition(bookId, userId = null) {
    try {
      const savedData = await AsyncStorage.getItem(`audio_progress_${bookId}`);
      if (savedData) {
        const { position } = JSON.parse(savedData);
        return position || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting saved position:', error);
      return 0;
    }
  }

  async handleProgressUpdate(data) {
    if (this.currentBook) {
      const progressPercent = (data.position / data.duration) * 100;
      
      // Emit progress update event for UI components
      if (this.onProgressUpdate) {
        this.onProgressUpdate({
          position: data.position,
          duration: data.duration,
          percent: progressPercent,
        });
      }
    }
  }

  setProgressUpdateCallback(callback) {
    this.onProgressUpdate = callback;
  }

  async createBookmark(name = null) {
    try {
      const position = await this.getPosition();
      const bookmark = {
        bookId: this.currentBook?.id,
        position,
        name: name || `Bookmark at ${this.formatTime(position)}`,
        timestamp: Date.now(),
      };

      const bookmarks = await this.getBookmarks(this.currentBook?.id);
      bookmarks.push(bookmark);
      
      await AsyncStorage.setItem(
        `bookmarks_${this.currentBook?.id}`,
        JSON.stringify(bookmarks)
      );

      return bookmark;
    } catch (error) {
      console.error('Error creating bookmark:', error);
      return null;
    }
  }

  async getBookmarks(bookId) {
    try {
      const bookmarksData = await AsyncStorage.getItem(`bookmarks_${bookId}`);
      return bookmarksData ? JSON.parse(bookmarksData) : [];
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return [];
    }
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async setSleepTimer(minutes) {
    try {
      if (this.sleepTimer) {
        clearTimeout(this.sleepTimer);
      }

      this.sleepTimer = setTimeout(async () => {
        await this.pause();
        console.log('Sleep timer activated - playback paused');
      }, minutes * 60 * 1000);

      return true;
    } catch (error) {
      console.error('Error setting sleep timer:', error);
      return false;
    }
  }

  clearSleepTimer() {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }

  async destroy() {
    try {
      this.stopProgressTracking();
      this.clearSleepTimer();
      await TrackPlayer.destroy();
      this.isInitialized = false;
    } catch (error) {
      console.error('Error destroying audio service:', error);
    }
  }
}

// Export singleton instance
export default new AudioService();
