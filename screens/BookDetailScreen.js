import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Text,
  Platform,
  ToastAndroid,
} from 'react-native';
import { Button } from 'react-native-paper';
import { ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import safeNotificationService from '../services/safeNotificationService';
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
import { COLORS, FONTS, SPACING, BORDER_RADIUS, COMMON_STYLES, SHADOWS } from '../constants/theme';

const BookDetailScreen = ({ route, navigation }) => {
  const { book } = route.params;
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isFav, setIsFav] = useState(false);
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);
  const [isPdfDownloaded, setIsPdfDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [readingProgress, setReadingProgress] = useState(0);

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

  const checkFavoriteStatus = async () => {
    try {
      const status = await getFavoriteStatus(user.id, book.id);
      setIsFav(status);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const checkDownloadStatus = async () => {
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
  };

  const loadReadingProgress = async () => {
    try {
      const progress = await getReadingProgressDetailed(user.id, book.id);
      if (progress) {
        const percentage = (progress.current_page / progress.total_pages) * 100;
        setReadingProgress(Math.round(percentage));
      }
    } catch (error) {
      console.error('Error loading reading progress:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: book.cover_url }} style={styles.coverImage} />
          
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={toggleFavorite}
          >
            <MaterialCommunityIcons
              name={isFav ? "heart" : "heart-outline"}
              size={24}
              color={isFav ? COLORS.ERROR : COLORS.TEXT}
            />
          </TouchableOpacity>
        </View>

        {/* Book Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title}>{book.title}</Text>
          <Text style={styles.author}>by {book.author}</Text>
          <Text style={styles.category}>📚 {book.category}</Text>
          <Text style={styles.addedDate}>📅 Added November 7, 2025</Text>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{book.description}</Text>
        </View>

        {/* Reading Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.sectionTitle}>Reading Progress</Text>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {readingProgress > 0 ? `${readingProgress}% complete` : 'Not started'}
            </Text>
            <Text style={styles.progressPages}>Page 0 of ?</Text>
          </View>
          {readingProgress > 0 && (
            <View style={styles.progressBarContainer}>
              <ProgressBar
                progress={readingProgress / 100}
                color={COLORS.BUTTON}
                style={styles.progressBar}
              />
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          {book.pdf_url && (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => {
                navigation.navigate('PDFViewScreen', {
                  // Prefer the storage path so the reader resolves a
                  // fresh, short-lived Signed URL at open time (protected
                  // by RLS) instead of a permanent public link. Also pass
                  // the full `book` so the reader can check for/read from
                  // a local offline copy and offer "Continue with Audio".
                  pdfPath: book.pdf_path || null,
                  bookId: book.id,
                  pdfUrl: book.pdf_url, // legacy fallback for pre-migration rows
                  book,
                });
              }}
            >
              <Text style={styles.buttonText}>📖 Read Book</Text>
            </TouchableOpacity>
          )}

          {book.pdf_url && (
            <TouchableOpacity
              style={[styles.actionButton, isPdfDownloaded ? styles.offlineButton : styles.downloadButton]}
              disabled={isDownloading}
              onPress={isPdfDownloaded ? () => deleteDownload('pdf') : handleDownloadPdf}
            >
              <Text style={styles.buttonText}>
                {isPdfDownloaded ? '✓ Downloaded (tap to remove)' : isDownloading ? `Downloading... ${downloadProgress}%` : '⬇️ Download for Offline'}
              </Text>
            </TouchableOpacity>
          )}

          {book.audio_url && book.audio_url.trim() !== '' ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={() => navigation.navigate('AudioPlayer', { book })}
            >
              <Text style={styles.buttonText}>🎧 Listen Audio</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#666666' }]}
              disabled={true}
            >
              <Text style={[styles.buttonText, { opacity: 0.6 }]}>🔇 No Audio Available</Text>
            </TouchableOpacity>
          )}

          {book.audio_url && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                isAudioDownloaded ? styles.offlineButton : styles.downloadButton
              ]}
              disabled={isDownloading}
              onPress={isAudioDownloaded ? () => deleteDownload('audio') : handleDownloadAudio}
            >
              <Text style={styles.buttonText}>
                {isAudioDownloaded
                  ? "✓ Downloaded (tap to remove)"
                  : isDownloading
                    ? `Downloading... ${downloadProgress}%`
                    : "⬇️ Download Audio"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: COMMON_STYLES.container,
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
  },
  favoriteButton: {
    position: 'absolute',
    top: SPACING.LG,
    right: SPACING.LG,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: BORDER_RADIUS.ROUND,
    padding: SPACING.SM,
  },
  infoContainer: {
    paddingHorizontal: SPACING.LG,
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  title: {
    fontSize: FONTS.SIZES.TITLE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  author: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.SM,
  },
  category: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.BUTTON,
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  addedDate: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  descriptionContainer: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.BUTTON,
    marginBottom: SPACING.SM,
  },
  description: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT,
    lineHeight: 22,
  },
  progressContainer: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  progressText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT,
  },
  progressPages: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  progressBarContainer: {
    marginTop: SPACING.SM,
  },
  progressBar: {
    height: 8,
    borderRadius: BORDER_RADIUS.SM,
    backgroundColor: COLORS.PROGRESS_BACKGROUND,
  },
  buttonsContainer: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  actionButton: {
    borderRadius: BORDER_RADIUS.LG,
    paddingVertical: SPACING.LG,
    paddingHorizontal: SPACING.XL,
    marginBottom: SPACING.MD,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...SHADOWS.LIGHT,
  },
  primaryButton: {
    backgroundColor: COLORS.BUTTON,
  },
  downloadButton: {
    backgroundColor: COLORS.BUTTON,
  },
  offlineButton: {
    backgroundColor: COLORS.SUCCESS,
  },
  buttonText: {
    color: COLORS.BUTTON_TEXT,
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: 'bold',
  },
});

export default BookDetailScreen;
