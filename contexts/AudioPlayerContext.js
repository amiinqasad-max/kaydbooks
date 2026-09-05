import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import debounce from 'lodash.debounce';
import safeAudioService from '../services/safeAudioService';
import { getSignedFileUrl, updateAudioProgress, getChaptersForBook } from '../services/supabase';
import { getLocalFileUri } from '../services/downloadManager';
import { useAuth } from './AuthContext';

const AudioPlayerContext = createContext(null);

export const useAudioPlayer = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  return ctx;
};

// How often we actually write to Supabase while playing. Position is
// updated in local state every second (for a smooth UI), but that alone
// would be 1 write/second/listener -- this is the fix for that.
const PROGRESS_WRITE_INTERVAL_MS = 15000;

/**
 * Single source of truth for "what is playing right now", mounted ONCE at
 * the app root (see App.js) so it survives navigating away from the full
 * player screen -- that is what makes a persistent mini-player and real
 * background playback possible. Before this context existed,
 * PremiumAudioPlayerScreen owned the playback engine itself and tore it
 * down (`safeAudioService.cleanup()`) on unmount, which is why playback
 * used to stop the instant you navigated back.
 */
export const AudioPlayerProvider = ({ children }) => {
  const { user } = useAuth();

  const [currentBook, setCurrentBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const [sleepMinutes, setSleepMinutesState] = useState(null);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);
  const sleepTimeoutRef = useRef(null);
  const lastPersistedAtRef = useRef(0);
  const positionRef = useRef(0); // avoids stale closures inside the interval

  const currentChapter = chapters.find(
    (c) => c.start_time_seconds != null && position >= c.start_time_seconds && (c.end_time_seconds == null || position < c.end_time_seconds)
  ) || null;

  const persistProgress = useCallback(
    async (pos, dur) => {
      if (!user || !currentBook || !dur) return;
      try {
        await updateAudioProgress(user.id, currentBook.id, {
          currentTime: pos,
          duration: dur,
          progressPercentage: Math.min((pos / dur) * 100, 100),
          playbackRate,
        });
      } catch (err) {
        // A failed progress write is real and worth knowing about, but
        // must never crash playback -- log it, don't throw into the poll
        // loop or the AppState handler.
        console.error('Failed to save listening progress:', err.message);
      }
    },
    [user, currentBook, playbackRate]
  );

  // Debounced wrapper used by frequent callers (seek, rate change); the
  // interval-driven poll below uses the throttled inline check instead so
  // we get one guaranteed write per PROGRESS_WRITE_INTERVAL_MS even during
  // continuous playback, not just on the trailing edge of activity.
  const debouncedPersist = useRef(debounce((pos, dur) => persistProgress(pos, dur), 2000)).current;

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = useCallback(() => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      const status = await safeAudioService.getStatus();
      if (!status.isLoaded) return;

      const pos = status.positionMillis / 1000;
      const dur = status.durationMillis / 1000;
      positionRef.current = pos;
      setPosition(pos);
      setDuration(dur);
      setIsPlaying(Boolean(status.isPlaying));

      const now = Date.now();
      if (status.isPlaying && now - lastPersistedAtRef.current >= PROGRESS_WRITE_INTERVAL_MS) {
        lastPersistedAtRef.current = now;
        persistProgress(pos, dur);
      }
    }, 1000);
  }, [persistProgress]);

  // Flush progress immediately when the app is backgrounded/killed, rather
  // than relying on the 15s interval (which pauses along with JS timers
  // once the app is backgrounded on iOS -- so without this, up to 15s of
  // listening could go unrecorded every time the app is backgrounded).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if ((state === 'background' || state === 'inactive') && currentBook) {
        persistProgress(positionRef.current, duration);
      }
    });
    return () => sub.remove();
  }, [currentBook, duration, persistProgress]);

  useEffect(() => () => {
    clearPoll();
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
  }, []);

  const resolveAudioUrl = async (book) => {
    // Offline-first: a book downloaded via services/downloadManager.js is
    // served straight from disk -- no network, no signed URL, actually
    // works with the device in airplane mode (verify this by inspection,
    // not by claim: getLocalFileUri only returns a path when a complete,
    // non-empty file exists at it).
    const localUri = await getLocalFileUri(book, 'audio');
    if (localUri) return localUri;

    if (book.audio_path) {
      // Short-lived, RLS-checked -- see supabase/migrations/003 storage
      // policies. Throws (rather than silently falling back to a public
      // URL) if the user isn't authorized for this book's audio.
      return getSignedFileUrl('books', book.audio_path, 3600);
    }
    if (book.audio_url) {
      // Legacy rows uploaded before Phase 0's signed-URL fix.
      return book.audio_url;
    }
    return null;
  };

  const loadBook = useCallback(
    async (book, { startPositionSeconds } = {}) => {
      setError(null);
      setIsLoading(true);
      try {
        const audioUrl = await resolveAudioUrl(book);
        if (!audioUrl) {
          // NEVER substitute placeholder/test audio here -- a book with no
          // audio simply has no audio. Surfacing that honestly is the fix
          // for the previous implementation injecting a sample sound file.
          setError('This book does not have an audio edition available.');
          setIsLoading(false);
          return false;
        }

        const [savedProgress, bookChapters] = await Promise.all([
          user ? getAudioProgressSafe(user.id, book.id) : null,
          getChaptersForBookSafe(book.id),
        ]);

        const resumeAt = startPositionSeconds ?? savedProgress?.current_position ?? 0;

        const success = await safeAudioService.loadBook({ ...book, audio_url: audioUrl }, user?.id, resumeAt);
        if (!success) {
          setError('Could not load this audiobook. Please check your connection and try again.');
          setIsLoading(false);
          return false;
        }

        setCurrentBook(book);
        setChapters(bookChapters);
        setPosition(resumeAt);
        positionRef.current = resumeAt;
        lastPersistedAtRef.current = Date.now();

        const status = await safeAudioService.getStatus();
        setDuration(status?.durationMillis ? status.durationMillis / 1000 : book.audio_duration || 0);

        startPoll();
        return true;
      } catch (err) {
        setError(
          err.message?.toLowerCase().includes('access')
            ? 'You need an active subscription to listen to this book.'
            : 'Could not load this audiobook. Please try again.'
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [user, startPoll]
  );

  const play = useCallback(async () => {
    await safeAudioService.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(async () => {
    await safeAudioService.pause();
    setIsPlaying(false);
    persistProgress(positionRef.current, duration);
  }, [persistProgress, duration]);

  const toggle = useCallback(async () => {
    if (isPlaying) await pause();
    else await play();
  }, [isPlaying, play, pause]);

  const seekTo = useCallback(
    async (seconds) => {
      const clamped = Math.max(0, Math.min(seconds, duration || seconds));
      await safeAudioService.seekTo(clamped);
      setPosition(clamped);
      positionRef.current = clamped;
      debouncedPersist(clamped, duration);
    },
    [duration, debouncedPersist]
  );

  const skipForward = useCallback((seconds = 30) => seekTo(positionRef.current + seconds), [seekTo]);
  const skipBackward = useCallback((seconds = 15) => seekTo(Math.max(0, positionRef.current - seconds)), [seekTo]);

  const goToChapter = useCallback((chapter) => {
    if (chapter?.start_time_seconds != null) seekTo(chapter.start_time_seconds);
  }, [seekTo]);

  const nextChapter = useCallback(() => {
    if (!currentChapter) return;
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    if (idx >= 0 && idx < chapters.length - 1) goToChapter(chapters[idx + 1]);
  }, [chapters, currentChapter, goToChapter]);

  const previousChapter = useCallback(() => {
    if (!currentChapter) return;
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    if (idx > 0) goToChapter(chapters[idx - 1]);
  }, [chapters, currentChapter, goToChapter]);

  const setPlaybackRate = useCallback(async (rate) => {
    await safeAudioService.setRate(rate);
    setPlaybackRateState(rate);
  }, []);

  const setSleepTimer = useCallback((minutes) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepMinutesState(minutes);
    sleepTimeoutRef.current = setTimeout(async () => {
      await pause();
      setSleepMinutesState(null);
      sleepTimeoutRef.current = null;
    }, minutes * 60 * 1000);
  }, [pause]);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) {
      clearTimeout(sleepTimeoutRef.current);
      sleepTimeoutRef.current = null;
    }
    setSleepMinutesState(null);
  }, []);

  // Full teardown -- only for an explicit user action (closing the player
  // entirely, or logout), never called automatically on screen unmount.
  const stop = useCallback(async () => {
    if (currentBook) await persistProgress(positionRef.current, duration);
    clearPoll();
    clearSleepTimer();
    await safeAudioService.stop();
    await safeAudioService.cleanup();
    setCurrentBook(null);
    setChapters([]);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setError(null);
  }, [currentBook, duration, persistProgress, clearSleepTimer]);

  const value = {
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
    play,
    pause,
    toggle,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    previousChapter,
    setPlaybackRate,
    setSleepTimer,
    clearSleepTimer,
    stop,
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
};

// Small local helpers so a missing table/row never throws inside loadBook
// (a genuinely new book with no saved progress/chapters yet is a normal
// state, not an error).
async function getAudioProgressSafe(userId, bookId) {
  try {
    const { getAudioProgress } = require('../services/supabase');
    return await getAudioProgress(userId, bookId);
  } catch (err) {
    return null;
  }
}

async function getChaptersForBookSafe(bookId) {
  try {
    return await getChaptersForBook(bookId);
  } catch (err) {
    return [];
  }
}
