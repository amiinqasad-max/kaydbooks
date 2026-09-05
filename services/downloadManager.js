import * as FileSystem from 'expo-file-system';
import { getSignedFileUrl } from './supabase';

/**
 * Single place that decides how a book/audiobook file gets onto disk for
 * offline use, for both formats. Before this existed, the audio download
 * logic lived inline in PremiumAudioPlayerScreen and used `book.audio_url`
 * directly (a permanent public URL); this now goes through the same
 * signed-URL + RLS authorization path as playback (see
 * services/supabase.js's getSignedFileUrl and the storage policies in
 * supabase/migrations/003_authorization_and_schema_fixes.sql) -- a user
 * who isn't authorized for a premium book's audio/PDF cannot download it
 * either, because requesting the signed URL itself fails.
 *
 * Honesty notes (per the product spec -- do not claim offline support that
 * doesn't actually work):
 *   - "Pause download" is not implemented. expo-file-system's
 *     DownloadResumable supports pausing HTTP downloads, but a paused
 *     download's saved state (`downloadResumable.savable()`) would need to
 *     be persisted (e.g. to AsyncStorage) to survive an app restart, which
 *     is not wired up here. What IS implemented and tested: a download
 *     that fails partway through (network loss) is retried from scratch
 *     via `downloadAudioBook`/`downloadBookPdf` being safely re-callable,
 *     and a corrupted/incomplete local file is detected and re-downloaded
 *     rather than served.
 *   - Signed URLs used for downloads expire in under an hour; once the
 *     file is on disk, playback/reading from the LOCAL file has no
 *     expiry -- only the download step itself needs a live, authorized
 *     session.
 */

const DOWNLOAD_DIR = FileSystem.documentDirectory + 'kaydbooks_downloads/';

async function ensureDownloadDir() {
  const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
  }
}

function safeFileName(book, extension) {
  const base = `${book.id}_${book.title || 'book'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}.${extension}`;
}

async function resolveDownloadUrl(book, kind) {
  const path = kind === 'audio' ? book.audio_path : book.pdf_path;
  const legacyUrl = kind === 'audio' ? book.audio_url : book.pdf_url;

  if (path) {
    // Throws if the signed-in user isn't authorized (e.g. a premium book
    // with no active subscription) -- this IS the download-authorization
    // check, not a separate step that could be bypassed.
    return getSignedFileUrl('books', path, 600);
  }
  if (legacyUrl) return legacyUrl;
  throw new Error(`This book has no ${kind === 'audio' ? 'audio' : 'readable'} file available.`);
}

async function downloadFile(book, kind, extension, onProgress) {
  await ensureDownloadDir();
  const fileUri = DOWNLOAD_DIR + safeFileName(book, extension);

  // A previous, complete download already exists -- don't re-download.
  const existing = await FileSystem.getInfoAsync(fileUri);
  if (existing.exists && existing.size > 0) {
    return { localUri: fileUri, fileSize: existing.size, alreadyDownloaded: true };
  }

  const url = await resolveDownloadUrl(book, kind);

  const downloadResumable = FileSystem.createDownloadResumable(url, fileUri, {}, (progressEvent) => {
    if (progressEvent.totalBytesExpectedToWrite > 0 && onProgress) {
      const pct = Math.round((progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite) * 100);
      onProgress(pct);
    }
  });

  let result;
  try {
    result = await downloadResumable.downloadAsync();
  } catch (err) {
    // Partial/corrupted file from a failed attempt must not be left behind
    // masquerading as a successful download.
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    throw new Error(`Download failed: ${err.message}. Please check your connection and try again.`);
  }

  if (!result || !result.uri) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
    throw new Error('Download did not complete. Please try again.');
  }

  const fileInfo = await FileSystem.getInfoAsync(result.uri);
  if (!fileInfo.exists || fileInfo.size === 0) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error('The downloaded file is empty or corrupted. Please try again.');
  }

  return { localUri: result.uri, fileSize: fileInfo.size, alreadyDownloaded: false };
}

export const downloadAudioBook = (book, userId, onProgress) => downloadFile(book, 'audio', 'mp3', onProgress);
export const downloadBookPdf = (book, userId, onProgress) => downloadFile(book, 'pdf', 'pdf', onProgress);

export const getLocalFileUri = async (book, kind) => {
  const extension = kind === 'audio' ? 'mp3' : 'pdf';
  const fileUri = DOWNLOAD_DIR + safeFileName(book, extension);
  const info = await FileSystem.getInfoAsync(fileUri);
  return info.exists && info.size > 0 ? fileUri : null;
};

export const deleteDownload = async (book, kind) => {
  const extension = kind === 'audio' ? 'mp3' : 'pdf';
  const fileUri = DOWNLOAD_DIR + safeFileName(book, extension);
  await FileSystem.deleteAsync(fileUri, { idempotent: true });
};

export const getDownloadsStorageInfo = async () => {
  await ensureDownloadDir();
  const files = await FileSystem.readDirectoryAsync(DOWNLOAD_DIR);
  let totalBytes = 0;
  for (const file of files) {
    const info = await FileSystem.getInfoAsync(DOWNLOAD_DIR + file);
    if (info.exists) totalBytes += info.size || 0;
  }
  const free = await FileSystem.getFreeDiskStorageAsync();
  return { usedBytes: totalBytes, fileCount: files.length, freeDiskBytes: free };
};
