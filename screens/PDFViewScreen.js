import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import debounce from 'lodash.debounce';
import { COLORS, SPACING } from '../constants/theme';
import {
  getSignedFileUrl,
  getChaptersForBook,
  updateReadingProgressDetailed,
  getReadingProgressDetailed,
  addBookBookmark,
  getBookBookmarks,
  deleteBookBookmark,
  addBookNote,
  getBookNotes,
} from '../services/supabase';
import { getLocalFileUri, downloadBookPdf } from '../services/downloadManager';
import { useAuth } from '../contexts/AuthContext';
import { suggestListenPosition } from '../utils/readListenSync';

const NIGHT_MODE_KEY = 'reader:nightMode';
const PROGRESS_DEBOUNCE_MS = 4000;

/**
 * The ebook reader.
 *
 * PHASE 1 REBUILD: this used to be a WebView loading Google's public Docs
 * Viewer -- no offline support, no real progress tracking (no callback
 * exists from that viewer into React Native), no chapter navigation. This
 * now uses react-native-pdf, a mature, actively maintained native PDF
 * renderer (chosen over hand-building a renderer, per the product spec),
 * which gives real page-level progress, real offline reading from a
 * locally downloaded file, and a page-change callback to persist position.
 *
 * HONESTY LIMITS, stated plainly rather than faked (per the product spec):
 * react-native-pdf rasterizes each page as an image -- there is no text
 * layer available to this app. That means, for a PDF specifically:
 *   - No real text highlighting or text-anchored notes: this app does not
 *     claim to support them for PDF. Bookmarks and notes here are
 *     PAGE-anchored, which is the honest, real capability available.
 *   - No font size / line-height / margin controls: those require
 *     reflowable text, which a rasterized page cannot provide. These
 *     controls are simply not shown for PDF content.
 *   - "Dark mode" is a screen-dimming overlay, not a true re-themed page
 *     (the page image itself doesn't change) -- labeled "Night mode" in
 *     the UI rather than "Dark theme" so it isn't mistaken for one.
 * True highlights, notes-on-text, and font/theme control all require a
 * reflowable format (EPUB) and are the natural next step, tracked as a
 * follow-up rather than implemented here.
 */
const PDFViewScreen = ({ route, navigation }) => {
  const { pdfPath, pdfUrl: legacyPdfUrl, bookId, book } = route.params || {};
  const { user } = useAuth();

  const [source, setSource] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState(null);
  const [numberOfPages, setNumberOfPages] = useState(0);
  const [page, setPage] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [showChapters, setShowChapters] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');

  const pdfRef = useRef(null);
  const initialPageRef = useRef(1);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NIGHT_MODE_KEY);
        if (stored != null) setNightMode(stored === 'true');
      } catch (err) {
        // Non-fatal -- reader still works with the default (off).
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        // Offline-first: a book downloaded for offline reading is served
        // from disk and needs no network or signed URL at all.
        if (book) {
          const localUri = await getLocalFileUri(book, 'pdf');
          if (localUri && !cancelled) {
            setSource({ uri: localUri, cache: false });
            setIsOffline(true);
            return;
          }
        }

        if (pdfPath) {
          const signed = await getSignedFileUrl('books', pdfPath, 600);
          if (!cancelled) setSource({ uri: signed, cache: true });
        } else if (legacyPdfUrl) {
          if (!cancelled) setSource({ uri: legacyPdfUrl, cache: true });
        } else {
          if (!cancelled) setError('This book has no readable file.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message?.toLowerCase().includes('access')
              ? 'You need an active subscription to read this book.'
              : 'Could not open this book right now. Please try again.'
          );
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [pdfPath, legacyPdfUrl, book]);

  useEffect(() => {
    (async () => {
      if (!bookId) return;
      try {
        const [chapterList, progress] = await Promise.all([
          getChaptersForBook(bookId),
          user ? getReadingProgressDetailed(user.id, bookId) : null,
        ]);
        setChapters(chapterList);
        if (progress?.current_page) {
          initialPageRef.current = progress.current_page;
          setPage(progress.current_page);
        }
        if (user) {
          setBookmarks(await getBookBookmarks(user.id, bookId));
          setNotes(await getBookNotes(user.id, bookId));
        }
      } catch (err) {
        console.error('Failed to load reader metadata:', err.message);
      }
    })();
  }, [bookId, user]);

  const persistProgress = useRef(
    debounce((currentPage, totalPages) => {
      if (!user || !bookId) return;
      updateReadingProgressDetailed(user.id, bookId, currentPage, totalPages).catch((err) =>
        console.error('Failed to save reading progress:', err.message)
      );
    }, PROGRESS_DEBOUNCE_MS)
  ).current;

  const onPageChanged = useCallback(
    (currentPage, totalPages) => {
      setPage(currentPage);
      setNumberOfPages(totalPages);
      persistProgress(currentPage, totalPages);
    },
    [persistProgress]
  );

  const toggleNightMode = async () => {
    const next = !nightMode;
    setNightMode(next);
    try {
      await AsyncStorage.setItem(NIGHT_MODE_KEY, String(next));
    } catch (err) {
      // Non-fatal.
    }
  };

  const jumpToPage = (targetPage) => {
    pdfRef.current?.setPage(targetPage);
    setShowChapters(false);
    setShowBookmarks(false);
  };

  const addBookmarkHere = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Sign in to save bookmarks.');
      return;
    }
    try {
      const chapter = chapters.find((c) => c.start_page != null && page >= c.start_page && (c.end_page == null || page <= c.end_page));
      await addBookBookmark(user.id, bookId, page, { chapterId: chapter?.id, label: `Page ${page}` });
      setBookmarks(await getBookBookmarks(user.id, bookId));
      Alert.alert('Bookmark saved', `Page ${page}`);
    } catch (err) {
      Alert.alert('Could not save bookmark', err.message);
    }
  };

  const saveNote = async () => {
    if (!user || !noteDraft.trim()) return;
    try {
      await addBookNote(user.id, bookId, page, noteDraft);
      setNoteDraft('');
      setNotes(await getBookNotes(user.id, bookId));
    } catch (err) {
      Alert.alert('Could not save note', err.message);
    }
  };

  const continueWithAudio = () => {
    const result = suggestListenPosition({ chapters, currentPage: page, totalPages: numberOfPages });

    if (result.strategy === 'none') {
      Alert.alert(
        'Audio not mapped yet',
        'This book’s audio edition doesn’t have chapter timing set up, so we can’t line up your exact spot. Start the audiobook from the beginning instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start from beginning', onPress: () => navigation.navigate('AudioPlayer', { book: { ...book, id: bookId }, startPosition: 0 }) },
        ]
      );
      return;
    }

    if (result.strategy === 'book-percentage') {
      Alert.alert(
        'Approximate position',
        `We don’t have exact chapter markers for this book, so we’ll start the audio at roughly the same overall progress (${Math.round((page / (numberOfPages || page)) * 100)}%).`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => navigation.navigate('AudioPlayer', { book: { ...book, id: bookId }, startPosition: result.suggestedSeconds }) },
        ]
      );
      return;
    }

    navigation.navigate('AudioPlayer', { book: { ...book, id: bookId }, startPosition: result.suggestedSeconds });
  };

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={COLORS.TEXT} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!source) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={COLORS.BUTTON} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={() => setControlsVisible((v) => !v)}>
        <View style={StyleSheet.absoluteFill}>
          <Pdf
            ref={pdfRef}
            source={source}
            page={initialPageRef.current}
            style={styles.pdf}
            enablePaging
            onLoadComplete={(totalPages) => setNumberOfPages(totalPages)}
            onPageChanged={onPageChanged}
            onError={(err) => {
              console.error('PDF render error:', err);
              setError('This file could not be displayed. It may be corrupted.');
            }}
          />
          {nightMode && <View pointerEvents="none" style={styles.nightOverlay} />}
        </View>
      </TouchableWithoutFeedback>

      {controlsVisible && (
        <>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityLabel="Back">
              <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.TEXT} />
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>{numberOfPages ? `${page} / ${numberOfPages}` : ''}</Text>
            <View style={{ flexDirection: 'row' }}>
              {chapters.length > 0 && (
                <TouchableOpacity style={styles.iconButton} onPress={() => setShowChapters(true)} accessibilityLabel="Chapters">
                  <MaterialCommunityIcons name="format-list-bulleted" size={22} color={COLORS.TEXT} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconButton} onPress={() => setShowBookmarks(true)} accessibilityLabel="Bookmarks">
                <MaterialCommunityIcons name="bookmark-outline" size={22} color={COLORS.TEXT} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => setShowNotes(true)} accessibilityLabel="Notes">
                <MaterialCommunityIcons name="note-text-outline" size={22} color={COLORS.TEXT} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleNightMode} accessibilityLabel="Toggle night mode">
                <MaterialCommunityIcons name={nightMode ? 'weather-night' : 'white-balance-sunny'} size={22} color={COLORS.TEXT} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bookmarkFab} onPress={addBookmarkHere} accessibilityLabel="Bookmark this page">
              <MaterialCommunityIcons name="bookmark-plus-outline" size={20} color={COLORS.BUTTON_TEXT} />
              <Text style={styles.bookmarkFabText}>Bookmark this page</Text>
            </TouchableOpacity>
            {book?.audio_url || book?.audio_path ? (
              <TouchableOpacity style={styles.audioFab} onPress={continueWithAudio} accessibilityLabel="Continue with audio">
                <MaterialCommunityIcons name="headphones" size={20} color={COLORS.BUTTON_TEXT} />
                <Text style={styles.bookmarkFabText}>Continue with Audio</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}
      {isOffline && controlsVisible && (
        <View style={styles.offlineBadge}>
          <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.SUCCESS} />
          <Text style={styles.offlineBadgeText}>Reading offline</Text>
        </View>
      )}

      <Modal visible={showChapters} transparent animationType="slide" onRequestClose={() => setShowChapters(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chapters</Text>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.listRow} onPress={() => jumpToPage(item.start_page || 1)}>
                  <Text style={styles.listRowText}>{item.title || `Chapter ${item.chapter_index + 1}`}</Text>
                  {item.start_page ? <Text style={styles.listRowMeta}>p.{item.start_page}</Text> : null}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowChapters(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBookmarks} transparent animationType="slide" onRequestClose={() => setShowBookmarks(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bookmarks</Text>
            {bookmarks.length === 0 ? (
              <Text style={styles.emptyText}>No bookmarks yet.</Text>
            ) : (
              <FlatList
                data={bookmarks}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.listRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => jumpToPage(item.page)}>
                      <Text style={styles.listRowText}>{item.label || `Page ${item.page}`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        await deleteBookBookmark(user.id, item.id);
                        setBookmarks(await getBookBookmarks(user.id, bookId));
                      }}
                      accessibilityLabel="Delete bookmark"
                    >
                      <MaterialCommunityIcons name="delete-outline" size={18} color={COLORS.ERROR} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowBookmarks(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showNotes} transparent animationType="slide" onRequestClose={() => setShowNotes(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notes</Text>
            <Text style={styles.noteHint}>Notes are attached to the page you&apos;re on ({page}), since this PDF has no selectable text to highlight.</Text>
            <TextInput
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder={`Add a note for page ${page}...`}
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              style={styles.noteInput}
              multiline
            />
            <TouchableOpacity style={styles.modalClose} onPress={saveNote}>
              <Text style={styles.modalCloseText}>Save note</Text>
            </TouchableOpacity>
            {notes.length === 0 ? (
              <Text style={styles.emptyText}>No notes yet.</Text>
            ) : (
              <FlatList
                data={notes}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.listRow} onPress={() => jumpToPage(item.page)}>
                    <View>
                      <Text style={styles.listRowMeta}>Page {item.page}</Text>
                      <Text style={styles.listRowText} numberOfLines={2}>{item.body}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowNotes(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  pdf: { flex: 1, width: '100%', height: '100%', backgroundColor: COLORS.BACKGROUND },
  nightOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  errorText: { color: COLORS.TEXT, textAlign: 'center', fontSize: 15, marginTop: 12 },
  backLink: { marginTop: 16 },
  backLinkText: { color: COLORS.BUTTON, fontWeight: '600' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 44, paddingHorizontal: SPACING.SM, paddingBottom: SPACING.SM,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pageIndicator: { color: COLORS.TEXT, fontSize: 13, fontWeight: '600' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.MD,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bookmarkFab: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.BUTTON, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  audioFab: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.BUTTON, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  bookmarkFabText: { color: COLORS.BUTTON_TEXT, fontSize: 12, fontWeight: '600' },
  offlineBadge: { position: 'absolute', top: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  offlineBadgeText: { color: COLORS.TEXT, fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.BACKGROUND, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: SPACING.LG, maxHeight: '70%' },
  modalTitle: { color: COLORS.TEXT, fontSize: 18, fontWeight: 'bold', marginBottom: SPACING.MD },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  listRowText: { color: COLORS.TEXT, fontSize: 14 },
  listRowMeta: { color: COLORS.TEXT_SECONDARY, fontSize: 12 },
  emptyText: { color: COLORS.TEXT_SECONDARY, textAlign: 'center', marginVertical: 12 },
  noteHint: { color: COLORS.TEXT_SECONDARY, fontSize: 12, marginBottom: 8 },
  noteInput: { color: COLORS.TEXT, borderWidth: 1, borderColor: COLORS.BORDER, borderRadius: 8, padding: 10, minHeight: 60, marginBottom: 8, textAlignVertical: 'top' },
  modalClose: { alignSelf: 'center', paddingVertical: 10 },
  modalCloseText: { color: COLORS.BUTTON, fontWeight: '600' },
});

export default PDFViewScreen;
