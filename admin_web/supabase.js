/**
 * Supabase Service for Admin Web Panel
 *
 * SECURITY MODEL (fixed 2026-09):
 * This panel NO LONGER uses a service-role key. A service-role key bypasses
 * every Row Level Security policy in the database, so shipping one to a
 * browser is equivalent to publishing your database's root password.
 *
 * Instead, the admin panel signs the operator in as a normal Supabase Auth
 * user (using the public anon key, same as the mobile app) and relies on
 * server-side Row Level Security policies to allow book-management actions
 * ONLY for accounts whose `profiles.role` is 'admin' or 'super_admin'
 * (see supabase/migrations/003_authorization_and_schema_fixes.sql).
 *
 * If you get "row-level security policy" errors here, the fix is to grant
 * the signed-in account the admin role in the database -- NEVER to reach
 * for a service-role key in client code again.
 */

class SupabaseService {
    constructor() {
        this.supabase = null;
        this.bucketName = 'books';
        this.currentUser = null;
        this.init();
    }

    init() {
        try {
            if (!window.supabase) {
                throw new Error('Supabase library not loaded. Check your internet connection.');
            }

            if (!window.SUPABASE_CONFIG) {
                throw new Error('Supabase configuration not found. Please check config.js');
            }

            const { url, anonKey } = window.SUPABASE_CONFIG;

            if (!url || url === 'YOUR_SUPABASE_URL_HERE') {
                throw new Error('Please set your Supabase URL in config.js');
            }

            if (!anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
                throw new Error('Please set your Supabase anon key in config.js');
            }

            this.supabase = window.supabase.createClient(url, anonKey, {
                auth: { persistSession: true, autoRefreshToken: true },
            });
            this.bucketName = window.SUPABASE_CONFIG.bucketName || 'books';

            console.log('Supabase client initialized with the public anon key. Admin actions are authorized by your signed-in account role, enforced by database RLS policies.');
            return true;
        } catch (error) {
            console.error('Supabase initialization failed:', error.message);
            this.showInitError(error.message);
            return false;
        }
    }

    showInitError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0;
            background: #ef4444; color: white; padding: 1rem;
            text-align: center; z-index: 9999; font-weight: bold;
        `;
        errorDiv.innerHTML = `
            <strong>Configuration Error:</strong> ${message}
            <br><small>Please check the setup instructions in README.md</small>
        `;
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }

    // ---------------------------------------------------------------
    // Auth
    // ---------------------------------------------------------------

    async signIn(email, password) {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(`Sign-in failed: ${error.message}`);
        this.currentUser = data.user;
        return data.user;
    }

    async signOut() {
        await this.supabase.auth.signOut();
        this.currentUser = null;
    }

    async getSessionUser() {
        const { data } = await this.supabase.auth.getUser();
        this.currentUser = data?.user || null;
        return this.currentUser;
    }

    /**
     * Client-side role display ONLY -- this is UX convenience (e.g. hiding
     * the "Delete" button for a non-admin who signed in by mistake). It is
     * NOT a security boundary. The real boundary is the RLS policy that
     * runs on every insert/update/delete regardless of what this returns.
     */
    async getMyRole() {
        const user = this.currentUser || (await this.getSessionUser());
        if (!user) return null;
        const { data, error } = await this.supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (error) return null;
        return data?.role || 'user';
    }

    sanitizeBookRecord(book) {
        if (!book) return this.getEmptyBookRecord();
        return {
            id: book.id || '',
            title: book.title || '',
            author: book.author || '',
            description: book.description || '',
            category: book.category || 'General',
            cover_url: book.cover_url || '',
            pdf_url: book.pdf_url || '',
            audio_url: book.audio_url || '',
            created_at: book.created_at || new Date().toISOString()
        };
    }

    getEmptyBookRecord() {
        return {
            id: '', title: '', author: '', description: '', category: 'General',
            cover_url: '', pdf_url: '', audio_url: '',
            created_at: new Date().toISOString()
        };
    }

    detectMimeType(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        const mimeMap = {
            'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
            'pdf': 'application/pdf', 'mp3': 'audio/mpeg', 'wav': 'audio/wav'
        };
        return mimeMap[ext] || 'application/octet-stream';
    }

    async uploadFile(file, folder = '') {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const extension = file.name.split('.').pop();
        const filename = `${folder ? folder + '/' : ''}${timestamp}_${randomId}.${extension}`;
        const mimeType = this.detectMimeType(file);

        // NOTE: this upload is subject to Storage RLS policies (see the
        // migration file) which only allow admin accounts to write to the
        // 'books' bucket's pdfs/audio folders. A non-admin signed-in user
        // will get a permission error here -- that is the RLS working as
        // intended, not a bug.
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(filename, file, { contentType: mimeType });

        if (error) throw new Error(`Upload failed: ${error.message}`);
        return data.path;
    }

    /**
     * PDFs are premium/protected content and should not have permanent
     * public URLs. This returns a short-lived signed URL instead. Cover
     * images stay public (they're marketing material, not gated content).
     */
    async getSignedUrl(path, expiresInSeconds = 3600) {
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(path, expiresInSeconds);
        if (error) throw new Error(`Could not create signed URL: ${error.message}`);
        return data.signedUrl;
    }

    getPublicUrl(filePath) {
        const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(filePath);
        return data.publicUrl;
    }

    async createBook(bookData) {
        // Store the storage PATH for gated content (pdf/audio), not a
        // permanent public URL -- the mobile app resolves a fresh signed
        // URL at read/listen time. Covers remain public.
        const safeData = {
            title: bookData.title?.trim() || '',
            author: bookData.author?.trim() || '',
            description: bookData.description?.trim() || '',
            category: bookData.category || 'General',
            cover_url: bookData.cover_url || null,
            pdf_path: bookData.pdf_path || null,
            audio_path: bookData.audio_path || null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('books')
            .insert([safeData])
            .select();

        if (error) throw new Error(`Database error: ${error.message}`);
        return this.sanitizeBookRecord(data[0]);
    }

    async getBooks() {
        const { data, error } = await this.supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Database error: ${error.message}`);
        return (data || []).map(book => this.sanitizeBookRecord(book));
    }

    async updateBook(id, bookData) {
        const safeData = {
            title: bookData.title?.trim() || '',
            author: bookData.author?.trim() || '',
            description: bookData.description?.trim() || '',
            category: bookData.category || 'General'
        };
        if (bookData.cover_url) safeData.cover_url = bookData.cover_url;
        if (bookData.pdf_path) safeData.pdf_path = bookData.pdf_path;
        if (bookData.audio_path) safeData.audio_path = bookData.audio_path;

        const { data, error } = await this.supabase
            .from('books')
            .update(safeData)
            .eq('id', id)
            .select();

        if (error) throw new Error(`Database error: ${error.message}`);
        return this.sanitizeBookRecord(data[0]);
    }

    async deleteBook(id) {
        const { data: bookData, error: fetchError } = await this.supabase
            .from('books')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Failed to fetch book for deletion:', fetchError);
        }

        if (bookData) {
            const filesToDelete = [bookData.cover_url && this.extractPathFromUrl(bookData.cover_url), bookData.pdf_path, bookData.audio_path]
                .filter(Boolean);

            if (filesToDelete.length > 0) {
                const { error: storageError } = await this.supabase.storage
                    .from(this.bucketName)
                    .remove(filesToDelete);
                if (storageError) {
                    console.warn('Some files could not be deleted from storage:', storageError.message);
                }
            }
        }

        const { error: deleteError } = await this.supabase
            .from('books')
            .delete()
            .eq('id', id);

        if (deleteError) {
            throw new Error(`Failed to delete book from database: ${deleteError.message}`);
        }

        return true;
    }

    extractPathFromUrl(url) {
        if (!url) return null;
        try {
            const patterns = [
                `/storage/v1/object/public/${this.bucketName}/`,
                `/storage/v1/object/sign/${this.bucketName}/`,
                `/${this.bucketName}/`
            ];
            for (const pattern of patterns) {
                if (url.includes(pattern)) {
                    const parts = url.split(pattern);
                    if (parts.length > 1) return parts[1].split('?')[0];
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

window.supabaseService = new SupabaseService();
