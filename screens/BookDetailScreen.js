import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, Alert, Text, Platform, ToastAndroid } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  getReadingProgressDetailed,
  addToFavorites,
  removeFromFavorites,
  getFavoriteStatus,
  addToUserDownloads,
  removeFromUserDownloads,
  checkIfDownloaded,
} from '../services/supabase';
import { downloadAudioBook, downloadBookPdf, deleteDownload as deleteLocalFile } from '../services/downloadManager';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { ScreenContainer, PrimaryButton, SecondaryButton, IconButton, ProgressBar, Badge } from '../components/ui';

// PHASE 2 update -- Book Details (#10). Fixed two "real data only" (#24)
// violations found during the pass:
//   - Every book showed the literal hardcoded string "Added November 7,
//     2025" regardless of when it was actually added. `books.created_at`
//     exists (database/schema.sql) and was simply never read here.
//   - The reading-progress row always showed the literal string
//     "Page 0 of ?" no matter how far the user had actually read --
//     `current_page`/`total_pages` came back from getReadingProgressDetailed
//     but only the percentage was ever used. `book.pages` (also real,
//     schema-defined) is used as the total when the progress row doesn't
//     have one yet.
// Also moved onto the design system: TYPOGRAPHY scale, shared
// PrimaryButton/SecondaryButton/ProgressBar/Badge/IconButton instead of
// bespoke TouchableOpacity buttons, ScreenContainer for safe-area
// handling. Download/favorite/reading-progress logic is unchanged from
// Phase 1/1.5 -- this is a visual/consistency pass, not a behavior change.
const BookDetailScreen = ({ route, navigation }) => {
  const { book } = route.params;
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);
  const [isPdfDownloaded, setIsPdfDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [progress, setProgress] = useState({ percentage: 0, currentPage: 0, totalPages: book.pages || 0 });

  // PHASE 1.7: moved above the useEffect that calls them -- see
  // components/PremiumGate.js for the full rationale.
  async function checkFavoriteStatus() {
    try {
      const status = await getFavoriteStatus(user.id, book.id);
      setIsFav(status);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  }

  async function checkDownloadStatus() {
    try {
      const [audio, pdf] = await Promise.all([
        checkIfDownloaded(user.id, book.id, 'audio'),
        checkIfDownloaded(user.id, book.id, 'pdf'),
      ]);
      setIsAudioDownloaded(audio);
      setIsPdfDownloaded(pdf);
    } catch (error) {
      console.error('Error checking download status:', error);
    }
  }

  async function loadReadingProgress() {
    try {
      const data = await getReadingProgressDetailed(user.id, book.id);
      const totalPages = data?.total_pages || book.pages || 0;
      const currentPage = data?.current_page || 0;
      const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      setProgress({ percentage, currentPage, totalPages });
    } catch (error) {
      console.error('Error loading reading progress:', error);
    }
  }

  useEffect(() => {
    if (user && book) {
      checkFavoriteStatus();
      checkDownloadStatus();
      loadReadingProgress();
    }
  }, [user, book]);

  const showToast = (message) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Info', message);
    }
  };

  // Real date, formatted, or nothing -- never a fabricated one (Phase 2 #24).
  const addedDateLabel = (() => {
    if (!book.created_at) return null;
    const date = new Date(book.created_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  // PHASE 1: these used to be stubbed to "Download Disabled" / "Delete
  // Disabled" alerts -- offline reading/listening did not actually work.
  // Now backed by services/downloadManager.js, which resolves an
  // authorized (signed, RLS-checked) URL before writing anything to disk.
  const handleDownloadAudio = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to download audiobooks.');
      return;
    }
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      const result = await downloadAudioBook(book, user.id, setDownloadProgress);
      await addToUserDownloads(user.id, book.id, {
        download_type: 'audio',
        file_path: result.localUri,
        file_size: result.fileSize,
      });
      setIsAudioDownloaded(true);
      showToast('Available offline');
    } catch (error) {
      Alert.alert('Download failed', error.message || 'Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDownloadPdf = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to download books.');
      return;
    }
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      const result = await downloadBookPdf(book, user.id, setDownloadProgress);
      await addToUserDownloads(user.id, book.id, {
        download_type: 'pdf',
        file_path: result.localUri,
        file_size: result.fileSize,
      });
      setIsPdfDownloaded(true);
      showToast('Available offline');
    } catch (error) {
      Alert.alert('Download failed', error.message || 'Please try again.');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const deleteDownload = async (kind = 'audio') => {
    if (!user) return;
    Alert.alert('Remove download?', 'This book will no longer be available offline.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLocalFile(book, kind);
            await removeFromUserDownloads(user.id, book.id, kind);
            if (kind === 'audio') setIsAudioDownloaded(false);
            else setIsPdfDownloaded(false);
          } catch (error) {
            Alert.alert('Could not remove download', error.message);
          }
        },
      },
    ]);
  };

  const toggleFavorite = async () => {
    if (!user) return;
    try {
      if (isFav) {
        await removeFromFavorites(user.id, book.id);
        setIsFav(false);
        showToast('Removed from favorites');
      } else {
        await addToFavorites(user.id, book.id);
        setIsFav(true);
        showToast('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToast('Error updating favorites');
    }
  };

  const hasAudio = Boolean(book.audio_url && book.audio_url.trim() !== '');

  return (
    <ScreenContainer edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.coverContainer}>
          <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
          <IconButton
            icon={<MaterialCommunityIcons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? COLORS.ERROR : COLORS.TEXT} />}
            onPress={toggleFavorite}
            backgroundColor="rgba(0, 0, 0, 0.5)"
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
            style={styles.favoriteButton}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>by {book.author}</Text>
          <View style={styles.metaRow}>
            {book.category ? <Badge label={book.category} variant="accent" /> : null}
            {hasAudio ? <Badge label="Audiobook" variant="neutral" /> : null}
          </View>
          {addedDateLabel ? <Text style={styles.addedDate}>Added {addedDateLabel}</Text> : null}
        </View>

        {book.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{book.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reading Progress</Text>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {progress.percentage > 0 ? `${progress.percentage}% complete` : 'Not started'}
            </Text>
            {progress.totalPages > 0 ? (
              <Text style={styles.progressPages}>Page {progress.currentPage} of {progress.totalPages}</Text>
            ) : null}
          </View>
          {progress.percentage > 0 ? (
            <ProgressBar progress={progress.percentage} style={styles.progressBar} accessibilityLabel="Reading progress" />
          ) : null}
        </View>

        <View style={styles.buttonsContainer}>
          {book.pdf_url && (
            <PrimaryButton
              label="Read Book"
              icon={<MaterialCommunityIcons name="book-open-variant" size={18} color={COLORS.BUTTON_TEXT} style={styles.buttonIcon} />}
              style={styles.actionButton}
              onPress={() => navigation.navigate('PDFViewScreen', {
                // Prefer the storage path so the reader resolves a fresh,
                // short-lived Signed URL at open time (protected by RLS)
                // instead of a permanent public link. Also pass the full
                // `book` so the reader can check for a local offline copy
                // and offer "Continue with Audio".
                pdfPath: book.pdf_path || null,
                bookId: book.id,
                pdfUrl: book.pdf_url, // legacy fallback for pre-migration rows
                book,
              })}
            />
          )}

          {book.pdf_url && (
            <SecondaryButton
              label={isPdfDownloaded ? 'Downloaded (tap to remove)' : isDownloading ? `Downloading... ${downloadProgress}%` : 'Download for Offline'}
              icon={<MaterialCommunityIcons name={isPdfDownloaded ? 'check-circle' : 'download'} size={16} color={COLORS.ACCENT} style={styles.buttonIcon} />}
              style={styles.actionButton}
              loading={isDownloading}
              onPress={isPdfDownloaded ? () => deleteDownload('pdf') : handleDownloadPdf}
            />
          )}

          {hasAudio ? (
            <PrimaryButton
              label="Listen Audio"
              icon={<MaterialCommunityIcons name="headphones" size={18} color={COLORS.BUTTON_TEXT} style={styles.buttonIcon} />}
              style={styles.actionButton}
              onPress={() => navigation.navigate('AudioPlayer', { book })}
            />
          ) : (
            <View style={[styles.actionButton, styles.disabledButton]}>
              <Text style={styles.disabledButtonText}>No Audio Available</Text>
            </View>
          )}

          {book.audio_url && (
            <SecondaryButton
              label={isAudioDownloaded ? 'Downloaded (tap to remove)' : isDownloading ? `Downloading... ${downloadProgress}%` : 'Download Audio'}
              icon={<MaterialCommunityIcons name={isAudioDownloaded ? 'check-circle' : 'download'} size={16} color={COLORS.ACCENT} style={styles.buttonIcon} />}
              style={styles.actionButton}
              loading={isDownloading}
              onPress={isAudioDownloaded ? () => deleteDownload('audio') : handleDownloadAudio}
            />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  coverContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.XL,
    position: 'relative',
  },
  coverImage: {
    width: 200,
    height: 300,
    borderRadius: BORDER_RADIUS.MD,
    resizeMode: 'cover',
    ...SHADOWS.MEDIUM,
  },
  favoriteButton: {
    position: 'absolute',
    top: SPACING.LG,
    right: SPACING.LG,
  },
  infoContainer: {
    paddingHorizontal: SPACING.LG,
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  author: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.SM_MD,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  addedDate: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_MUTED,
  },
  section: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.TEXT,
    marginBottom: SPACING.SM,
  },
  description: {
    ...TYPOGRAPHY.reading,
    color: COLORS.TEXT_SECONDARY,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  progressText: {
    ...TYPOGRAPHY.body,
    color: COLORS.TEXT,
  },
  progressPages: {
    ...TYPOGRAPHY.caption,
    color: COLORS.TEXT_MUTED,
  },
  progressBar: {
    marginTop: SPACING.XS,
  },
  buttonsContainer: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  actionButton: {
    marginBottom: SPACING.SM_MD,
  },
  buttonIcon: {
    marginRight: SPACING.XS,
  },
  disabledButton: {
    minHeight: 48,
    borderRadius: BORDER_RADIUS.MD,
    backgroundColor: COLORS.SURFACE_SECONDARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.SM_MD,
  },
  disabledButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.TEXT_MUTED,
  },
});

export default BookDetailScreen;
