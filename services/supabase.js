import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { sanitizeBookRecord, sanitizeBookArray, sanitizeNestedBookRecord } from '../utils/bookSanitizer';
import { detectMimeType, correctFileMimeType, validateFileForUpload } from '../utils/mimeDetector';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SECURITY: no hardcoded fallback. A hardcoded anon key/URL means every
// fork, every environment (dev/staging/prod), and anyone who reads this
// source shares one Supabase project unless they know to override it, and
// it defeats the point of having an env var at all. Fail loudly instead.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in your Supabase project values ' +
    '(Supabase Dashboard > Settings > API). Use the "anon public" key only ' +
    '-- never the service_role key -- in this file or anywhere else that ' +
    'ships to a device.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth functions
export const signUp = async (email, password, name) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;

  if (data.user) {
    // Wait a moment for the auth session to be established
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create profile with proper error handling
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          name: name || 'User',
          email: email,
          created_at: new Date().toISOString(),
        }
      ]);

    if (profileError) {
      // Profile creation failed, but user was created
      console.warn('Profile creation failed:', profileError.message);
    }
  }

  return data;
};

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Book reading functions (read-only) - WITH SANITIZATION
export const getBooks = async () => {
  try {
    console.log('Fetching books from database...');
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Successfully fetched', data?.length || 0, 'books');
    
    // CRITICAL: Sanitize ALL books BEFORE returning to prevent level3 undefined errors
    const sanitizedBooks = sanitizeBookArray(data || []);
    console.log('Books sanitized with safe defaults');
    
    return sanitizedBooks;
  } catch (error) {
    console.error('Error in getBooks:', error);
    throw error;
  }
};

export const getBook = async (id) => {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  
  // CRITICAL: Sanitize single book BEFORE returning
  return sanitizeBookRecord(data);
};

// Reading progress functions
export const updateReadingProgress = async (userId, bookId, lastPage, totalPages) => {
  const progressPercentage = totalPages ? (lastPage / totalPages) * 100 : 0;
  
  const { data, error } = await supabase
    .from('reading_progress')
    .upsert([{
      user_id: userId,
      book_id: bookId,
      last_page: lastPage,
      total_pages: totalPages,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    }]);

  if (error) throw error;
  return data;
};

export const getReadingProgress = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Audio Download Functions
export const addDownloadRecord = async (userId, bookId, filePath, fileSize = null) => {
  try {
    const { data, error } = await supabase
      .from('downloads')
      .insert([{
        user_id: userId,
        book_id: bookId,
        file_path: filePath,
        file_size: fileSize,
        download_date: new Date().toISOString(),
      }]);

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// downloadType is optional for backward compatibility with older rows that
// predate the download_type column, but PHASE 1 FIX: a book can now be
// downloaded as audio AND pdf independently, so callers that care which
// one (BookDetailScreen showing two separate download buttons) must pass
// it -- otherwise "downloaded" for one format incorrectly flips both
// buttons to "downloaded".
export const getDownloadRecord = async (userId, bookId, downloadType = null) => {
  let query = supabase
    .from('downloads')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId);

  if (downloadType) query = query.eq('download_type', downloadType);

  // .limit(1) rather than .single()/.maybeSingle(): with no downloadType
  // filter, a book downloaded as BOTH audio and pdf legitimately has two
  // rows for this (user, book) pair, which .single() would reject as an
  // error instead of just returning one of them.
  const { data, error } = await query.order('download_date', { ascending: false }).limit(1);

  if (error) throw error;
  return data?.[0] || null;
};

export const removeDownloadRecord = async (userId, bookId) => {
  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId);

  if (error) throw error;
};

export const getUserDownloads = async (userId) => {
  const { data, error } = await supabase
    .from('downloads')
    .select(`
      *,
      books (
        id,
        title,
        author,
        cover_url
      )
    `)
    .eq('user_id', userId)
    .order('download_date', { ascending: false });

  if (error) throw error;
  return data || [];
};

// User Profile Functions
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .upsert([{
      id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    }]);

  if (error) throw error;
  return data;
};

// Audio Progress Functions
export const updateAudioProgress = async (userId, bookId, progressData) => {
  try {
    const { data, error } = await supabase
      .from('audio_progress')
      .upsert([{
        user_id: userId,
        book_id: bookId,
        current_time: progressData.currentTime || 0,
        duration: progressData.duration || 0,
        progress_percentage: progressData.progressPercentage || 0,
        playback_rate: progressData.playbackRate || 1.0,
        updated_at: new Date().toISOString(),
      }]);

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const getAudioProgress = async (userId, bookId) => {
  try {
    const { data, error } = await supabase
      .from('audio_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Reading Goals Functions
export const updateReadingGoals = async (userId, dailyMinutes, monthlyBooks) => {
  const { data, error } = await supabase
    .from('reading_goals')
    .upsert([{
      user_id: userId,
      daily_minutes: dailyMinutes,
      monthly_books: monthlyBooks,
      updated_at: new Date().toISOString(),
    }]);

  if (error) throw error;
  return data;
};

export const getReadingGoals = async (userId) => {
  const { data, error } = await supabase
    .from('reading_goals')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Continue Reading (ebooks) - reads reading_progress, NOT audio_progress.
// Reading and listening are tracked in separate tables (see
// supabase/migrations/003_authorization_and_schema_fixes.sql) so a user's
// page position and their audio position for the same book can no longer
// silently overwrite each other.
export const getContinueReadingBooks = async (userId) => {
  const { data, error } = await supabase
    .from('reading_progress')
    .select(`
      *,
      books (
        id,
        title,
        author,
        cover_url,
        pdf_url,
        audio_url,
        category,
        description,
        created_at
      )
    `)
    .eq('user_id', userId)
    .gt('progress_percentage', 0)
    .lt('progress_percentage', 100)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    // Table not existing yet (pre-migration) is a real, actionable error --
    // surface it instead of hiding it as "no continue-reading books".
    console.error('getContinueReadingBooks failed:', error.message);
    throw error;
  }

  return (data || []).map(sanitizeNestedBookRecord);
};

// Continue Listening (audiobooks) - reads audio_progress. This is the
// function that used to be conflated with the ebook one above.
export const getContinueListeningBooks = async (userId) => {
  const { data, error } = await supabase
    .from('audio_progress')
    .select(`
      *,
      books (
        id,
        title,
        author,
        cover_url,
        pdf_url,
        audio_url,
        category,
        description,
        created_at
      )
    `)
    .eq('user_id', userId)
    .gt('progress_percentage', 0)
    .lt('progress_percentage', 100)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('getContinueListeningBooks failed:', error.message);
    throw error;
  }

  return (data || []).map(sanitizeNestedBookRecord);
};

// Favorites Functions
export const addToFavorites = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('favorites')
    .insert([{
      user_id: userId,
      book_id: bookId,
      created_at: new Date().toISOString(),
    }]);

  if (error) throw error;
  return data;
};

export const removeFromFavorites = async (userId, bookId) => {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId);

  if (error) throw error;
};

export const isFavorite = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const getFavoriteStatus = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const getFavorites = async (userId) => {
  const { data, error } = await supabase
    .from('favorites')
    .select(`
      *,
      books (
        id,
        title,
        author,
        cover_url,
        category,
        description,
        pdf_url,
        audio_url,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  // CRITICAL: Sanitize nested book records in favorites
  const sanitizedFavorites = (data || []).map(sanitizeNestedBookRecord);
  return sanitizedFavorites;
};

// Reading Progress Functions (Enhanced) - Using reading_progress table
export const updateReadingProgressDetailed = async (userId, bookId, currentPage, totalPages, chapterId = null) => {
  const progressPercentage = totalPages ? Math.min((currentPage / totalPages) * 100, 100) : 0;

  const { data, error } = await supabase
    .from('reading_progress')
    .upsert([{
      user_id: userId,
      book_id: bookId,
      last_page: currentPage,
      total_pages: totalPages,
      progress_percentage: progressPercentage,
      chapter_id: chapterId,
      last_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id,book_id' });

  if (error) {
    // A failed progress save is a real problem for the user (they'll lose
    // their place) -- surface it so the UI can retry or tell them, instead
    // of pretending it succeeded.
    console.error('updateReadingProgressDetailed failed:', error.message);
    throw error;
  }
  return data;
};

export const getReadingProgressDetailed = async (userId, bookId) => {
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('book_id', bookId)
      .single();

    if (error) {
      // PGRST116 = no row found, which is a legitimate "never opened this
      // book" state, not a failure. Anything else is a real error.
      if (error.code === 'PGRST116') {
        return { progress_percentage: 0, current_page: 0, total_pages: 0, last_read: null };
      }
      throw error;
    }

    return data || {
      progress_percentage: 0,
      current_page: 0,
      total_pages: 0,
      last_read: null
    };
  } catch (error) {
    // A genuinely unexpected error (network down, etc) -- log it and
    // re-throw so the caller can show a real error state instead of
    // silently pretending the user has never opened this book.
    console.error('getReadingProgressDetailed failed:', error.message || error);
    throw error;
  }
};

export const addReadingSession = async (userId, bookId, sessionData) => {
  const { data, error } = await supabase
    .from('reading_sessions')
    .insert([{
      user_id: userId,
      book_id: bookId,
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      pages_read: sessionData.pagesRead || 0,
      session_duration: sessionData.duration || 0,
      created_at: new Date().toISOString(),
    }]);

  if (error) {
    console.error('addReadingSession failed:', error.message);
    throw error;
  }
  return data;
};

// User Downloads Functions
//
// PHASE 1 CHANGE: this used to hard-block download_type === 'pdf' with a
// thrown error, and BookDetailScreen's download buttons were stubbed to
// show "Download Disabled" / "Delete Disabled" alerts -- offline reading
// did not actually work for either format. Offline ebook reading is an
// explicit Phase 1 requirement, and the original restriction's rationale
// (a book's PDF was a permanent, unauthenticated public URL, so "download"
// vs "just open the link" was a meaningless distinction) no longer applies
// now that PDF/audio are served via short-lived, RLS-checked signed URLs
// (see services/downloadManager.js and migration 003's storage policies) --
// a user who isn't authorized for a premium book can't obtain the signed
// URL needed to download it in the first place, same as for reading it.
export const addToUserDownloads = async (userId, bookId, downloadData) => {

  const { data, error } = await supabase
    .from('downloads')
    .insert([{
      user_id: userId,
      book_id: bookId,
      download_type: downloadData.download_type || 'audio',
      file_path: downloadData.file_path,
      file_size: downloadData.file_size || 0,
      download_date: new Date().toISOString()
    }]);

  if (error) throw error;
  return data;
};

export const removeFromUserDownloads = async (userId, bookId, downloadType) => {
  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .eq('download_type', downloadType);

  if (error) throw error;
};

export const checkIfDownloaded = async (userId, bookId, downloadType = null) => {
  const record = await getDownloadRecord(userId, bookId, downloadType);
  return !!record;
};

// Combines ebook and audiobook progress for a user (e.g. for a "my
// activity" screen). Queries both tables explicitly rather than assuming
// one stands in for the other.
export const getUserProgressWithBooks = async (userId) => {
  const bookFields = `id, title, author, cover_url, category`;

  const [readingResult, audioResult] = await Promise.all([
    supabase.from('reading_progress').select(`*, books (${bookFields})`).eq('user_id', userId).order('updated_at', { ascending: false }),
    supabase.from('audio_progress').select(`*, books (${bookFields})`).eq('user_id', userId).order('updated_at', { ascending: false }),
  ]);

  if (readingResult.error) {
    console.error('getUserProgressWithBooks (reading) failed:', readingResult.error.message);
    throw readingResult.error;
  }
  if (audioResult.error) {
    console.error('getUserProgressWithBooks (audio) failed:', audioResult.error.message);
    throw audioResult.error;
  }

  return {
    reading: (readingResult.data || []).map(sanitizeNestedBookRecord),
    listening: (audioResult.data || []).map(sanitizeNestedBookRecord),
  };
};

// Reading Stats Functions - counts ebook completion from reading_progress
// and audiobook completion from audio_progress separately, then combines.
export const getReadingStats = async (userId) => {
  const [readingResult, audioResult] = await Promise.all([
    supabase.from('reading_progress').select('book_id, progress_percentage').eq('user_id', userId),
    supabase.from('audio_progress').select('book_id, progress_percentage').eq('user_id', userId),
  ]);

  if (readingResult.error) throw readingResult.error;
  if (audioResult.error) throw audioResult.error;

  const reading = readingResult.data || [];
  const audio = audioResult.data || [];
  const completed = (rows) => rows.filter(r => r.progress_percentage >= 100).length;
  const inProgress = (rows) => rows.filter(r => r.progress_percentage > 0 && r.progress_percentage < 100).length;

  return {
    booksCompleted: completed(reading) + completed(audio),
    booksInProgress: inProgress(reading) + inProgress(audio),
    // Real total, computed from logged sessions -- see getTodayReadingTime.
    totalReadingTime: 0,
  };
};

export const getTodayReadingTime = async (userId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('session_duration')
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    console.error('getTodayReadingTime failed:', error.message);
    throw error;
  }

  return (data || []).reduce((total, row) => total + (row.session_duration || 0), 0);
};

// ========================================
// ADMIN FUNCTIONS - CLEAN & ERROR-FREE
// ========================================

// File Upload Function - WITH PROPER MIME TYPE DETECTION
export const uploadFile = async (file, bucket = 'books', folder = '') => {
  try {
    console.log('uploadFile called with:', { file: file?.name, bucket, folder });
    
    if (!file || !file.uri) {
      throw new Error('Invalid file provided');
    }

    // CRITICAL: Validate and correct MIME type BEFORE upload
    const validation = validateFileForUpload(file);
    if (!validation.success) {
      throw new Error(validation.error);
    }

    // Correct the file object with proper MIME type
    const correctedFile = correctFileMimeType(file);
    const properMimeType = detectMimeType(correctedFile);
    
    console.log(`MIME type corrected: ${file.type} → ${properMimeType}`);

    // Generate safe filename
    const timestamp = new Date().getTime();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = correctedFile.name ? correctedFile.name.split('.').pop() : 'jpg';
    const safeFilename = `${folder ? folder + '/' : ''}${timestamp}_${randomId}.${extension}`;
    
    console.log('Generated filename:', safeFilename);

    // Read file as ArrayBuffer for React Native compatibility
    console.log('Fetching file from URI:', correctedFile.uri);
    const response = await fetch(correctedFile.uri);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('File is empty or corrupted');
    }
    
    console.log('File size:', arrayBuffer.byteLength, 'bytes');

    // Upload to Supabase storage with CORRECT MIME TYPE
    console.log('Uploading to Supabase storage with MIME type:', properMimeType);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeFilename, arrayBuffer, {
        cacheControl: '3600',
        upsert: true, // Allow overwriting files
        contentType: properMimeType, // Use detected MIME type, NOT generic "image"
      });

    if (error) {
      console.error('Supabase storage error:', error);
      
      // If bucket doesn't exist, try to create it
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        console.log('Bucket not found, attempting to create...');
        try {
          const { error: createError } = await supabase.storage.createBucket(bucket, {
            public: true,
            allowedMimeTypes: ['image/*', 'application/pdf', 'audio/*'],
            fileSizeLimit: 52428800, // 50MB
          });
          
          if (createError) {
            console.error('Failed to create bucket:', createError);
            throw new Error(`Bucket creation failed: ${createError.message}`);
          }
          
          console.log('Bucket created successfully, retrying upload...');
          
          // Retry upload after creating bucket with CORRECT MIME TYPE
          const { data: retryData, error: retryError } = await supabase.storage
            .from(bucket)
            .upload(safeFilename, arrayBuffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: properMimeType, // Use detected MIME type in retry too
            });
            
          if (retryError) {
            throw new Error(`Retry upload failed: ${retryError.message}`);
          }
          
          return retryData.path;
        } catch (createError) {
          throw new Error(`Storage setup failed: ${createError.message}`);
        }
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data || !data.path) {
      throw new Error('Upload succeeded but no file path returned');
    }

    return data.path;
  } catch (error) {
    throw new Error(`File upload error: ${error.message}`);
  }
};

// Get Public URL for uploaded files -- use ONLY for genuinely public assets
// (cover art). Never use this for a book's PDF/audio file: it never
// expires and requires no authorization, which is exactly what let
// PDFViewScreen leak a "protected" PDF straight to Google's viewer.
export const getPublicUrl = (bucket, path) => {
  try {
    if (!bucket || !path) {
      throw new Error('Bucket and path are required');
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    if (!data || !data.publicUrl) {
      throw new Error('Failed to generate public URL');
    }

    return data.publicUrl;
  } catch (error) {
    throw new Error(`Public URL generation error: ${error.message}`);
  }
};

// Get a short-lived Signed URL for gated content (a book's PDF or audio
// file). This is the function reader/player screens should call right
// before opening a file, instead of storing/reusing a permanent URL.
//
// This ONLY succeeds if the calling user is allowed to read that storage
// object under the RLS policies in
// supabase/migrations/003_authorization_and_schema_fixes.sql (free content:
// any signed-in user; premium content: an active subscription) -- so the
// access check happens in the database, not just in this function.
export const getSignedFileUrl = async (bucket, path, expiresInSeconds = 3600) => {
  if (!bucket || !path) {
    throw new Error('Bucket and path are required');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw new Error(`Could not create a signed URL (you may not have access to this content): ${error.message}`);
  }

  return data.signedUrl;
};

// Create Book Function - DEFENSIVE SCHEMA APPROACH
export const createBook = async (bookData) => {
  try {
    // CRITICAL: Only use core columns that are guaranteed to exist
    const coreBookData = {
      title: bookData.title?.trim() || '',
      author: bookData.author?.trim() || '',
      description: bookData.description?.trim() || '',
      category: bookData.category || 'General',
      cover_url: bookData.cover_url || null,
      // pdf_url/audio_url are kept for backward compatibility with rows
      // uploaded before this fix. New uploads should prefer pdf_path /
      // audio_path (storage paths behind Signed URLs, not permanent public
      // links) -- see getSignedFileUrl above.
      pdf_url: bookData.pdf_url || null,
      audio_url: bookData.audio_url || null,
      pdf_path: bookData.pdf_path || null,
      audio_path: bookData.audio_path || null,
      is_premium: Boolean(bookData.is_premium),
      is_featured: Boolean(bookData.is_featured),
      created_at: new Date().toISOString(),
    };

    // OPTIONAL: Add columns only if they might exist (with error handling)
    const optionalFields = {
      isbn: bookData.isbn?.trim() || null,
      publication_year: bookData.publication_year ? parseInt(bookData.publication_year) : null,
      page_count: bookData.page_count ? parseInt(bookData.page_count) : null,
    };

    // Combine core and optional fields
    const cleanBookData = { ...coreBookData, ...optionalFields };

    // Validate required fields
    if (!cleanBookData.title || !cleanBookData.author) {
      throw new Error('Title and author are required');
    }

    console.log('Creating book with data:', cleanBookData);

    const { data, error } = await supabase
      .from('books')
      .insert([cleanBookData])
      .select();

    if (error) {
      throw new Error(`Failed to create book: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Book creation failed - no data returned');
    }

    // CRITICAL: Sanitize created book before returning
    return sanitizeBookRecord(data[0]);
  } catch (error) {
    throw new Error(`Book creation error: ${error.message}`);
  }
};

// Update Book Function
export const updateBook = async (id, bookData) => {
  try {
    if (!id) {
      throw new Error('Book ID is required');
    }

    // Clean update data
    const updateData = {
      title: bookData.title?.trim() || undefined,
      author: bookData.author?.trim() || undefined,
      description: bookData.description?.trim() || undefined,
      category: bookData.category || undefined,
      cover_url: bookData.cover_url || undefined,
      pdf_url: bookData.pdf_url || undefined,
      audio_url: bookData.audio_url || undefined,
      pdf_path: bookData.pdf_path || undefined,
      audio_path: bookData.audio_path || undefined,
      isbn: bookData.isbn?.trim() || undefined,
      publication_year: bookData.publication_year ? parseInt(bookData.publication_year) : undefined,
      page_count: bookData.page_count ? parseInt(bookData.page_count) : undefined,
      is_premium: bookData.is_premium !== undefined ? Boolean(bookData.is_premium) : undefined,
      is_featured: bookData.is_featured !== undefined ? Boolean(bookData.is_featured) : undefined,
      updated_at: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Failed to update book: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Book not found or update failed');
    }

    // CRITICAL: Sanitize updated book before returning
    return sanitizeBookRecord(data[0]);
  } catch (error) {
    throw new Error(`Book update error: ${error.message}`);
  }
};

// Delete Book Function
export const deleteBook = async (id) => {
  try {
    if (!id) {
      throw new Error('Book ID is required');
    }

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete book: ${error.message}`);
    }

    return true;
  } catch (error) {
    throw new Error(`Book deletion error: ${error.message}`);
  }
};

// ========================================
// PHASE 1: CHAPTERS, BOOKMARKS & NOTES
// (supabase/migrations/003_authorization_and_schema_fixes.sql +
//  004_bookmarks_notes_and_read_listen_sync.sql)
// ========================================

export const getChaptersForBook = async (bookId) => {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('chapter_index', { ascending: true });

  if (error) {
    console.error('getChaptersForBook failed:', error.message);
    throw error;
  }
  return data || [];
};

// --- Ebook bookmarks (page-anchored -- see 004's comment on why PDF
// bookmarks/notes are page-anchored rather than text-anchored) ---

export const addBookBookmark = async (userId, bookId, page, { chapterId = null, label = null } = {}) => {
  const { data, error } = await supabase
    .from('book_bookmarks')
    .insert([{ user_id: userId, book_id: bookId, page, chapter_id: chapterId, label }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getBookBookmarks = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('book_bookmarks')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('page', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const deleteBookBookmark = async (userId, bookmarkId) => {
  const { error } = await supabase
    .from('book_bookmarks')
    .delete()
    .eq('id', bookmarkId)
    .eq('user_id', userId);

  if (error) throw error;
};

export const addBookNote = async (userId, bookId, page, body, bookmarkId = null) => {
  if (!body || !body.trim()) throw new Error('A note cannot be empty.');

  const { data, error } = await supabase
    .from('book_notes')
    .insert([{ user_id: userId, book_id: bookId, page, body: body.trim(), bookmark_id: bookmarkId }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getBookNotes = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('book_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('page', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const updateBookNote = async (userId, noteId, body) => {
  if (!body || !body.trim()) throw new Error('A note cannot be empty.');

  const { data, error } = await supabase
    .from('book_notes')
    .update({ body: body.trim() })
    .eq('id', noteId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteBookNote = async (userId, noteId) => {
  const { error } = await supabase
    .from('book_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId);

  if (error) throw error;
};

// --- Audiobook bookmarks ---

export const addAudioBookmark = async (userId, bookId, positionSeconds, { chapterId = null, label = null } = {}) => {
  const { data, error } = await supabase
    .from('audio_bookmarks')
    .insert([{ user_id: userId, book_id: bookId, position_seconds: positionSeconds, chapter_id: chapterId, label }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAudioBookmarks = async (userId, bookId) => {
  const { data, error } = await supabase
    .from('audio_bookmarks')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('position_seconds', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const deleteAudioBookmark = async (userId, bookmarkId) => {
  const { error } = await supabase
    .from('audio_bookmarks')
    .delete()
    .eq('id', bookmarkId)
    .eq('user_id', userId);

  if (error) throw error;
};

// ========================================
// PHASE 1.5: AUTHORITATIVE SUBSCRIPTION READ
// ========================================
//
// This is the ONLY function that should decide "does this user have a paid
// subscription" -- it reads the `subscriptions` table created by
// supabase/migrations/003_authorization_and_schema_fixes.sql, which is
// writable exclusively by the verify-receipt / verify-local-payment Edge
// Functions (service_role). See services/premiumSubscriptionService.js's
// Phase 1.5 fix notes for why this replaced a client-side check against
// `users.premium_access` -- that column could be, and was, set directly by
// client code with no server verification at all.
export const getActiveSubscription = async (userId) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'in_grace_period'])
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('getActiveSubscription failed:', error.message);
    throw error;
  }
  return data?.[0] || null;
};

// Calls the server-side receipt verification Edge Function. This is the
// ONLY correct way to grant paid premium access -- it runs on Supabase's
// servers with the service_role key (never exposed to the client) and
// actually contacts Apple/Google to confirm the purchase is real before
// writing to `subscriptions`. See supabase/functions/verify-receipt.
//
// NOT VERIFIED — requires a real App Store/Play Store sandbox purchase to
// exercise end-to-end; not exercised by this repo's Jest suite.
export const verifyPurchaseWithServer = async ({ receipt, platform, plan }) => {
  const { data, error } = await supabase.functions.invoke('verify-receipt', {
    body: { receipt, platform, plan },
  });

  if (error) throw new Error(error.message || 'Receipt verification failed');
  if (data?.error) throw new Error(data.error);
  return data;
};

export const verifyLocalPaymentWithServer = async ({ transactionCode, plan }) => {
  const { data, error } = await supabase.functions.invoke('verify-local-payment', {
    body: { transactionCode, plan },
  });

  if (error) throw new Error(error.message || 'Payment verification failed');
  if (data?.error) throw new Error(data.error);
  return data;
};
