import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import EnvironmentDetector from '../utils/environmentDetection';

// Conditional imports for fallback audio modules
let TrackPlayer = null;

try {
  TrackPlayer = require('react-native-track-player');
} catch (error) {
  // Silently handle react-native-track-player unavailability
}

/**
 * Safe Audio Service for Expo SDK 53+
 * Uses expo-av for SDK 53+ and react-native-track-player as fallback
 * Provides safe audio playback with proper error handling
 */

class SafeAudioService {
  constructor() {
    this.isInitialized = false;
    this.audioModule = null;
    this.trackPlayerModule = null;
    this.currentSound = null;
    this.currentBook = null;
    this.audioMode = 'none'; // 'expo-av', 'track-player', 'fallback', 'none'
    
    this.init();
  }

  async init() {
    try {
      // Initializing Safe Audio Service with expo-av

      // Try expo-av first (preferred for SDK 53+)
      if (Audio) {
        try {
          this.audioModule = Audio;
          this.audioMode = 'expo-av';
          // Set audio mode for better performance
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (error) {
          // expo-av not available
        }
      }

      // Try react-native-track-player as fallback (dev/production builds only)
      if (!this.audioModule && !EnvironmentDetector.isExpoGo() && TrackPlayer) {
        try {
          this.trackPlayerModule = TrackPlayer;
          this.audioMode = 'track-player';
          
          // Initialize track player
          await TrackPlayer.setupPlayer();
        } catch (error) {
          // react-native-track-player not available
        }
      }

      // Fallback mode
      if (!this.audioModule && !this.trackPlayerModule) {
        this.audioMode = 'fallback';
      }

      this.isInitialized = true;
    } catch (error) {
      this.audioMode = 'none';
    } 
    this.isInitialized = true;
  }

  /**
   * Load audio book (safe)
   */
  async loadBook(book, userId = null, startPosition = 0) {
    try {
      
      if (!this.isInitialized) {
        await this.init();
      }

      // Loading book
      this.currentBook = book;

      switch (this.audioMode) {
        case 'expo-av':
          return await this._loadWithExpoAV(book, startPosition);
        
        case 'track-player':
          return await this._loadWithTrackPlayer(book, startPosition);
        
        case 'fallback':
          return true;
          
        default:
          return true;
      }
    } catch (error) {
      console.error('❌ SafeAudioService loadBook error:', error);
      return false;
    }
  }

  async _loadWithExpoAV(book, startPosition) {
    try {
      
      // Unload previous sound
      if (this.currentSound) {
        await this.currentSound.unloadAsync();
        this.currentSound = null;
      }

      // Create new sound using expo-av (SDK 53+ correct way)
      const sound = new Audio.Sound();
      await sound.loadAsync({ uri: book.audio_url });

      this.currentSound = sound;

      if (startPosition > 0) {
        await sound.setPositionAsync(startPosition * 1000);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async _loadWithTrackPlayer(book, startPosition) {
    try {
      await this.trackPlayerModule.reset();
      
      await this.trackPlayerModule.add({
        id: book.id.toString(),
        url: book.audio_url,
        title: book.title,
        artist: book.author,
        artwork: book.cover_image_url,
      });

      if (startPosition > 0) {
        await this.trackPlayerModule.seekTo(startPosition);
      }

      return true;
    } catch (error) {
      // track-player load failed
      return false;
    }
  }

  /**
   * Play audio (safe)
   */
  async play() {
    try {
      if (!this.isInitialized) await this.init();

      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.playAsync();
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.play();
          break;
        
        case 'fallback':
        default:
          // Play requested - audio not available in current environment
          Alert.alert('Audio Not Available', 'Audio playback is not supported in Expo Go. Use a development build for audio features.');
          break;
      }
    } catch (error) {
      // Play failed
    }
  }

  /**
   * Pause audio (safe)
   */
  async pause() {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.pauseAsync();
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.pause();
          break;
        
        case 'fallback':
        default:
          // Pause requested - audio not available
          break;
      }
    } catch (error) {
      // Pause failed
    }
  }

  /**
   * Stop audio (safe)
   */
  async stop() {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.stopAsync();
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.stop();
          break;
        
        case 'fallback':
        default:
          // Stop requested - audio not available
          break;
      }
    } catch (error) {
      // Stop failed
    }
  }

  /**
   * Seek to position (safe)
   */
  async seekTo(positionSeconds) {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.setPositionAsync(positionSeconds * 1000);
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.seekTo(positionSeconds);
          break;
        
        case 'fallback':
        default:
          // Seek requested - audio not available
          break;
      }
    } catch (error) {
      // Seek failed
    }
  }

  /**
   * Get playback status (safe)
   */
  async getStatus() {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            return await this.currentSound.getStatusAsync();
          } else {
            return {
              isLoaded: false,
              isPlaying: false,
              positionMillis: 0,
              durationMillis: 0,
            };
          }
        
        case 'track-player':
          if (this.trackPlayerModule) {
            const state = await this.trackPlayerModule.getState();
            const position = await this.trackPlayerModule.getPosition();
            const duration = await this.trackPlayerModule.getDuration();
            
            return {
              isLoaded: true,
              isPlaying: state === 'playing',
              positionMillis: position * 1000,
              durationMillis: duration * 1000,
            };
          } else {
            return {
              isLoaded: false,
              isPlaying: false,
              positionMillis: 0,
              durationMillis: 0,
            };
          }
        
        case 'fallback':
        default:
          return {
            isLoaded: false,
            isPlaying: false,
            positionMillis: 0,
            durationMillis: 0,
          };
      }
    } catch (error) {
      // Error getting audio status
      return {
        isLoaded: false,
        isPlaying: false,
        positionMillis: 0,
        durationMillis: 0,
      };
    }
  }

  /**
   * Set playback rate (safe)
   */
  async setRate(rate) {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.setRateAsync(rate, true);
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.setRate(rate);
          break;
        
        case 'fallback':
        default:
          // Set rate requested - audio not available
          break;
      }
    } catch (error) {
      // Set rate failed
    }
  }

  /**
   * Check if audio is supported
   */
  isSupported() {
    return this.audioMode !== 'fallback' && this.audioMode !== 'none';
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      audioMode: this.audioMode,
      isSupported: this.isSupported(),
      isExpoGo: EnvironmentDetector.isExpoGo(),
      sdkVersion: EnvironmentDetector.getSDKVersion(),
      currentBook: this.currentBook?.title || null
    };
  }

  /**
   * Cleanup (safe)
   */
  async cleanup() {
    try {
      switch (this.audioMode) {
        case 'expo-av':
          if (this.currentSound) {
            await this.currentSound.unloadAsync();
            this.currentSound = null;
          }
          break;
        
        case 'track-player':
          await this.trackPlayerModule.reset();
          break;
        
        case 'fallback':
        default:
          // Nothing to cleanup
          break;
      }
    } catch (error) {
      // Audio cleanup failed
    }
  }
}

// Create singleton instance
const safeAudioService = new SafeAudioService();

export default safeAudioService;
