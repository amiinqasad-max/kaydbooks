/**
 * Regression test for the Phase 1.5 fix: a fast double-tap on "Download"
 * (or two screens independently triggering a download for the same book)
 * must not start two concurrent downloads to the same file.
 */

jest.mock('expo-file-system', () => {
  const files = new Map();
  return {
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(async (uri) => {
      const entry = files.get(uri);
      return entry ? { exists: true, size: entry.size } : { exists: false };
    }),
    makeDirectoryAsync: jest.fn(async () => {}),
    deleteAsync: jest.fn(async (uri) => { files.delete(uri); }),
    createDownloadResumable: jest.fn((url, fileUri, options, onProgress) => ({
      downloadAsync: jest.fn(async () => {
        // Simulate a slow network write so overlapping calls actually race.
        await new Promise((resolve) => setTimeout(resolve, 20));
        files.set(fileUri, { size: 1234 });
        return { uri: fileUri };
      }),
    })),
    __files: files,
  };
});

jest.mock('../supabase', () => ({
  getSignedFileUrl: jest.fn(async () => 'https://example.com/signed-audio-url'),
}));

const FileSystem = require('expo-file-system');
const { downloadAudioBook } = require('../downloadManager');

describe('downloadManager de-duplication', () => {
  beforeEach(() => {
    FileSystem.__files.clear();
    FileSystem.createDownloadResumable.mockClear();
  });

  test('two concurrent calls for the same book only trigger one real download', async () => {
    const book = { id: 42, title: 'Dune', audio_path: 'audio/dune.mp3' };

    const [resultA, resultB] = await Promise.all([
      downloadAudioBook(book, 'user-1', () => {}),
      downloadAudioBook(book, 'user-1', () => {}),
    ]);

    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(1);
    expect(resultA.localUri).toBe(resultB.localUri);
  });

  test('a second call after the first genuinely finishes reuses the file instead of re-downloading', async () => {
    const book = { id: 7, title: 'Foundation', audio_path: 'audio/foundation.mp3' };

    const first = await downloadAudioBook(book, 'user-1', () => {});
    const second = await downloadAudioBook(book, 'user-1', () => {});

    expect(FileSystem.createDownloadResumable).toHaveBeenCalledTimes(1);
    expect(second.alreadyDownloaded).toBe(true);
    expect(second.localUri).toBe(first.localUri);
  });
});
