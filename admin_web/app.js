/**
 * Admin Web Panel Main Application
 */

class AdminApp {
    constructor() {
        this.books = [];
        this.filteredBooks = [];
        this.role = null;
        this.init();
    }

    async init() {
        this.setupLoginForm();
        // If a session already exists (page refresh), skip straight to the
        // dashboard -- but the role check still runs, and every write is
        // still enforced server-side by RLS regardless of what this shows.
        const user = await window.supabaseService.getSessionUser();
        if (user) {
            await this.enterDashboard();
        }
    }

    setupLoginForm() {
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errorBox = document.getElementById('login-error');
            errorBox.style.display = 'none';
            try {
                await window.supabaseService.signIn(email, password);
                await this.enterDashboard();
            } catch (err) {
                errorBox.textContent = err.message;
                errorBox.style.display = 'block';
            }
        });
    }

    async enterDashboard() {
        this.role = await window.supabaseService.getMyRole();
        if (this.role !== 'admin' && this.role !== 'super_admin') {
            document.getElementById('login-error').textContent =
                'This account does not have admin access. Ask a super admin to grant the "admin" role, or sign in with an admin account.';
            document.getElementById('login-error').style.display = 'block';
            await window.supabaseService.signOut();
            return;
        }
        document.getElementById('login-gate').style.display = 'none';
        document.getElementById('admin-container').style.display = '';
        this.setupEventListeners();
        this.showPage('upload');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.showPage(e.currentTarget.dataset.page);
            });
        });

        // Upload form
        document.getElementById('upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpload();
        });

        // File previews
        document.getElementById('cover-file').addEventListener('change', (e) => {
            this.previewFile(e.target.files[0], 'cover-preview', 'image');
        });

        // Manage page
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadBooks();
        });

        // Search functionality
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterBooks(e.target.value);
        });

        // Edit modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEdit();
        });
    }

    showPage(pageId) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
        
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(`${pageId}-page`).classList.add('active');

        if (pageId === 'manage') this.loadBooks();
    }

    previewFile(file, previewId, type) {
        const preview = document.getElementById(previewId);
        if (!file) return;

        if (type === 'image') {
            preview.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-width:100%;max-height:150px;border-radius:8px;">`;
        } else {
            preview.innerHTML = `<div class="file-info"><i class="fas fa-file"></i><div>${file.name}</div></div>`;
        }
    }

    async handleUpload() {
        try {
            // Check if Supabase service is available
            if (!window.supabaseService || !window.supabaseService.supabase) {
                throw new Error('Supabase service not initialized. Please check your configuration.');
            }

            const coverFile = document.getElementById('cover-file').files[0];
            const pdfFile = document.getElementById('pdf-file').files[0];
            const audioFile = document.getElementById('audio-file').files[0];

            if (!coverFile || !pdfFile) throw new Error('Cover and PDF required');

            document.getElementById('progress-section').style.display = 'block';
            document.getElementById('progress-text').textContent = 'Uploading...';

            const coverPath = await window.supabaseService.uploadFile(coverFile, 'covers');
            const pdfPath = await window.supabaseService.uploadFile(pdfFile, 'pdfs');
            let audioPath = null;
            if (audioFile) audioPath = await window.supabaseService.uploadFile(audioFile, 'audio');

            const formData = new FormData(document.getElementById('upload-form'));
            const bookData = {
                title: formData.get('title'),
                author: formData.get('author'),
                description: formData.get('description'),
                category: formData.get('category'),
                // Cover stays public (it's marketing art). PDF/audio are
                // gated content: only the storage PATH is stored, and the
                // app resolves a short-lived signed URL at read/listen time.
                cover_url: window.supabaseService.getPublicUrl(coverPath),
                pdf_path: pdfPath,
                audio_path: audioPath
            };

            await window.supabaseService.createBook(bookData);
            this.showNotification('Book uploaded successfully!', 'success');
            document.getElementById('upload-form').reset();

        } catch (error) {
            this.showNotification(`Upload failed: ${error.message}`, 'error');
        } finally {
            document.getElementById('progress-section').style.display = 'none';
        }
    }

    async loadBooks() {
        try {
            // Check if Supabase service is available
            if (!window.supabaseService || !window.supabaseService.supabase) {
                throw new Error('Supabase service not initialized. Please check your configuration.');
            }

            document.getElementById('loading').style.display = 'block';
            this.books = await window.supabaseService.getBooks();
            
            // Ensure books is always an array
            if (!Array.isArray(this.books)) {
                this.books = [];
            }
            
            // Initialize filteredBooks with all books
            this.filteredBooks = [...this.books];
            
            this.renderBooksTable();
        } catch (error) {
            console.error('Load books error:', error);
            this.books = [];
            this.filteredBooks = [];
            this.showNotification(`Failed to load books: ${error.message}`, 'error');
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    renderBooksTable() {
        const tbody = document.getElementById('books-tbody');
        
        // Use filteredBooks for rendering, fallback to books, then empty array
        const booksToRender = this.filteredBooks || this.books || [];
        
        tbody.innerHTML = booksToRender.map(book => `
            <tr>
                <td><img src="${book.cover_url}" class="book-cover" /></td>
                <td><div class="book-title">${book.title}</div></td>
                <td><div class="book-author">${book.author}</div></td>
                <td><span class="book-category">${book.category}</span></td>
                <td><div class="book-date">${new Date(book.created_at).toLocaleDateString()}</div></td>
                <td>
                    <button class="btn-edit" onclick="app.editBook('${book.id}')">Edit</button>
                    <button class="btn-danger" onclick="app.deleteBook('${book.id}', '${book.title}')">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    filterBooks(query) {
        if (!Array.isArray(this.books)) {
            this.books = [];
        }
        
        if (!query || query.trim() === '') {
            // Show all books if no search query
            this.filteredBooks = [...this.books];
        } else {
            // Filter books based on search query
            const searchTerm = query.toLowerCase().trim();
            this.filteredBooks = this.books.filter(book => 
                (book.title && book.title.toLowerCase().includes(searchTerm)) ||
                (book.author && book.author.toLowerCase().includes(searchTerm)) ||
                (book.category && book.category.toLowerCase().includes(searchTerm))
            );
        }
        
        this.renderBooksTable();
    }

    editBook(id) {
        console.log('🔍 Editing book with ID:', id);
        console.log('📚 Available books:', this.books?.length || 0);
        
        if (!Array.isArray(this.books)) {
            this.showNotification('No books loaded', 'error');
            return;
        }
        
        // Try both string and exact comparison
        let book = this.books.find(b => b.id === id);
        if (!book) {
            book = this.books.find(b => String(b.id) === String(id));
        }
        
        if (!book) {
            console.error('❌ Book not found. Available IDs:', this.books.map(b => b.id));
            this.showNotification(`Book not found. ID: ${id}`, 'error');
            return;
        }
        
        console.log('✅ Found book:', book.title);
        
        document.getElementById('edit-id').value = book.id || '';
        document.getElementById('edit-title').value = book.title || '';
        document.getElementById('edit-author').value = book.author || '';
        document.getElementById('edit-description').value = book.description || '';
        document.getElementById('edit-category').value = book.category || '';
        
        // Update current file information
        document.getElementById('current-cover').textContent = book.cover_url ? 'Has cover image' : 'No cover';
        document.getElementById('current-pdf').textContent = book.pdf_url ? 'Has PDF file' : 'No PDF';
        document.getElementById('current-audio').textContent = book.audio_url ? 'Has audio file' : 'No audio';
        
        // Clear file inputs
        document.getElementById('edit-cover').value = '';
        document.getElementById('edit-pdf').value = '';
        document.getElementById('edit-audio').value = '';
        
        document.getElementById('edit-modal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
    }

    async handleEdit() {
        try {
            const id = document.getElementById('edit-id').value;
            
            // Show loading state
            const submitBtn = document.querySelector('#edit-form button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;
            
            const bookData = {
                title: document.getElementById('edit-title').value,
                author: document.getElementById('edit-author').value,
                description: document.getElementById('edit-description').value,
                category: document.getElementById('edit-category').value
            };
            
            // Check for file uploads
            const coverFile = document.getElementById('edit-cover').files[0];
            const pdfFile = document.getElementById('edit-pdf').files[0];
            const audioFile = document.getElementById('edit-audio').files[0];
            
            console.log('🔄 Updating book with files:', {
                cover: !!coverFile,
                pdf: !!pdfFile,
                audio: !!audioFile
            });
            
            // Upload new files if provided
            if (coverFile) {
                console.log('📷 Uploading new cover...');
                bookData.cover_url = await window.supabaseService.uploadFile(coverFile, 'covers');
            }
            
            if (pdfFile) {
                console.log('📄 Uploading new PDF...');
                bookData.pdf_path = await window.supabaseService.uploadFile(pdfFile, 'pdfs');
            }

            if (audioFile) {
                console.log('🎵 Uploading new audio...');
                bookData.audio_path = await window.supabaseService.uploadFile(audioFile, 'audio');
            }
            
            await window.supabaseService.updateBook(id, bookData);
            this.showNotification('Book updated successfully!', 'success');
            this.closeEditModal();
            this.loadBooks();
            
        } catch (error) {
            console.error('❌ Update failed:', error);
            this.showNotification(`Update failed: ${error.message}`, 'error');
        } finally {
            // Restore button state
            const submitBtn = document.querySelector('#edit-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
                submitBtn.disabled = false;
            }
        }
    }

    async deleteBook(id, title) {
        if (!confirm(`Are you sure you want to permanently delete "${title}"?\n\nThis will remove:\n- The book record from database\n- Cover image from storage\n- PDF file from storage\n- Audio file from storage (if any)\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            // Show loading state
            const deleteBtn = document.querySelector(`button[onclick="app.deleteBook('${id}', '${title}')"]`);
            if (deleteBtn) {
                deleteBtn.disabled = true;
                deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            }

            // Delete the book
            await window.supabaseService.deleteBook(id);
            
            // Remove from local arrays immediately for instant UI update
            if (Array.isArray(this.books)) {
                this.books = this.books.filter(book => book.id !== id);
            }
            if (Array.isArray(this.filteredBooks)) {
                this.filteredBooks = this.filteredBooks.filter(book => book.id !== id);
            }
            
            // Re-render table immediately
            this.renderBooksTable();
            
            // Show success message
            this.showNotification(`"${title}" has been permanently deleted!`, 'success');
            
            // Reload from server to ensure consistency
            setTimeout(() => {
                this.loadBooks();
            }, 1000);

        } catch (error) {
            console.error('Delete error:', error);
            this.showNotification(`Failed to delete "${title}": ${error.message}`, 'error');
            
            // Re-enable button on error
            const deleteBtn = document.querySelector(`button[onclick="app.deleteBook('${id}', '${title}')"]`);
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
            }
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.querySelector('.notification-message').textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AdminApp();
});
