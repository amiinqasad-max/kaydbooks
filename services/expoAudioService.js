import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateAudioProgress } from './supabase';
import safeAudioService from './safeAudioService';
import EnvironmentDetector from '../utils/environmentDetection';

class ExpoAudioService {
  constructor() {
    this.sound = null;
    this.currentBook = null;
    this.progressUpdateInterval = null;
    this.isLoaded = false;
    this.setupAudio();
  }

  async setupAudio() {
    try {
      console.log('🎵 ExpoAudioService: Delegating to SafeAudioService for SDK 53+ compatibility');
      // This service now acts as a wrapper around SafeAudioService
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  }

  async loadBook(book, userId = null, startPosition = 0) {
    try {
      console.log('🎵 ExpoAudioService: Loading book via SafeAudioService:', book.title);
      this.currentBook = book;
      
      // Delegate to SafeAudioService
      const result = await safeAudioService.loadBook(book, userId, startPosition);
      this.isLoaded = result;
      
      return result;
    } catch (error) {
      console.error('Error loading book:', error);
      return false;
    }
  }

  async play() {
    try {
      return await safeAudioService.play();
    } catch (error) {
      console.error('Error playing:', error);
    }
  }

  async pause() {
    try {
      return await safeAudioService.pause();
    } catch (error) {
      console.error('Error pausing:', error);
    }
  }

  async stop() {
    try {
      return await safeAudioService.stop();
    } catch (error) {
      console.error('Error stopping:', error);
    }
  }

  async seekTo(positionSeconds) {
    try {
      return await safeAudioService.seekTo(positionSeconds);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  }

  async skipForward(seconds = 30) {
    try {
      const status = await this.getStatus();
      if (status.isLoaded) {
        const newPosition = (status.positionMillis / 1000) + seconds;
        return await this.seekTo(newPosition);
      }
    } catch (error) {
      console.error('Error skipping forward:', error);
    }
  }

  async skipBackward(seconds = 15) {
    try {
      const status = await this.getStatus();
      if (status.isLoaded) {
        const newPosition = Math.max(0, (status.positionMillis / 1000) - seconds);
        return await this.seekTo(newPosition);
      }
    } catch (error) {
      console.error('Error skipping backward:', error);
    }
  }

  async setRate(rate) {
    try {
      return await safeAudioService.setRate(rate);
    } catch (error) {
      console.error('Error setting rate:', error);
    }
  }

  async getStatus() {
    try {
      return await safeAudioService.getStatus();
    } catch (error) {
      console.error('Error getting status:', error);
      return { isLoaded: false, isPlaying: false };
    }
  }

  async getPosition() {
    try {
      const status = await this.getStatus();
      return status.positionMillis ? status.positionMillis / 1000 : 0;
    } catch (error) {
      console.error('Error getting position:', error);
      return 0;
    }
  }

  async getDuration() {
    try {
      const status = await this.getStatus();
      return status.durationMillis ? status.durationMillis / 1000 : 0;
    } catch (error) {
      console.error('Error getting duration:', error);
      return 0;
    }
  }

  async getProgress() {
    try {
      const status = await this.getStatus();
      return {
        position: status.positionMillis ? status.positionMillis / 1000 : 0,
        duration: status.durationMillis ? status.durationMillis / 1000 : 0,
        buffered: 0
      };
    } catch (error) {
      console.error('Error getting progress:', error);
      return { position: 0, duration: 0, buffered: 0 };
    }
  }

  handlePlaybackStatusUpdate(status) {
    if (status.isLoaded && this.currentBook && this.onProgressUpdate) {
      const position = status.positionMillis / 1000;
      const duration = status.durationMillis ? status.durationMillis / 1000 : 0;
      const percent = duration > 0 ? (position / duration) * 100 : 0;

      this.onProgressUpdate({
        position,
        duration,
        percent,
        isPlaying: status.isPlaying,
        isBuffering: status.isBuffering,
      });
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
      
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
        this.isLoaded = false;
      }
    } catch (error) {
      console.error('Error destroying audio service:', error);
    }
  }
}

// Export singleton instance
export default new ExpoAudioService();
