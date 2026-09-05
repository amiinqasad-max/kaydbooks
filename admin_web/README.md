# 📚 Kayd Books Admin Web Panel

A complete admin interface for managing your Kayd Books library with file uploads and book management.

## 🚀 Features

### Upload Books
- ✅ Upload cover images (JPG, PNG, WebP)
- ✅ Upload PDF files
- ✅ Upload audio files (MP3, WAV, OGG)
- ✅ Add book metadata (title, author, description, category)
- ✅ Real-time upload progress
- ✅ Automatic file validation and MIME type detection
- ✅ Success notifications and form clearing

### Manage Books
- ✅ View all books in responsive table
- ✅ Search and filter books
- ✅ Edit book metadata
- ✅ Delete books (with confirmation)
- ✅ Real-time data loading from Supabase

## 🛠️ Setup Instructions

### 1. Configure Supabase
Edit `config.js` and replace the placeholder values:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key-here',
    bucketName: 'books'
};
```

### 2. Database Schema
Ensure your Supabase `books` table has these columns:
- `id` (uuid, primary key)
- `title` (text, required)
- `author` (text, required)
- `description` (text)
- `category` (text)
- `cover_url` (text)
- `pdf_url` (text)
- `audio_url` (text)
- `isbn` (text)
- `publication_year` (integer)
- `page_count` (integer)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 3. Storage Setup
Create a storage bucket named `books` in your Supabase dashboard with public access.

### 4. Run the Application
Simply open `index.html` in your web browser. No build process required!

## 📱 Responsive Design

- ✅ Mobile-friendly interface
- ✅ Tablet and desktop optimized
- ✅ Touch-friendly buttons and forms
- ✅ Responsive navigation

## 🔒 Error Handling

- ✅ Comprehensive error catching
- ✅ User-friendly error messages
- ✅ Automatic retry for failed uploads
- ✅ Form validation
- ✅ Network error handling

## 🎨 Design Features

- ✅ Dark theme matching Kayd Books brand
- ✅ Kayd Books colors (Dark Blue #021945, Yellow #FAB500)
- ✅ Modern UI with smooth animations
- ✅ Font Awesome icons
- ✅ Clean, professional layout

## 📁 File Structure

```
admin_web/
├── index.html      # Main HTML file
├── styles.css      # Complete CSS styling
├── config.js       # Supabase configuration
├── supabase.js     # Database service layer
├── app.js          # Main application logic
└── README.md       # This file
```

## 🚨 Security Notes

- Never commit your actual Supabase credentials
- Use environment variables in production
- Enable RLS (Row Level Security) on your tables
- Restrict file upload sizes and types

## 🐛 Troubleshooting

### Upload Fails
- Check Supabase credentials in `config.js`
- Verify storage bucket exists and is public
- Check file size limits (default 50MB)

### Books Don't Load
- Verify database connection
- Check table name and column names
- Review browser console for errors

### MIME Type Errors
- The app automatically detects MIME types
- Supported formats: JPG, PNG, PDF, MP3, WAV

## 🎯 Production Ready

This admin panel is production-ready with:
- ✅ Error boundaries and handling
- ✅ Input validation and sanitization
- ✅ Responsive design for all devices
- ✅ Clean, maintainable code
- ✅ No external dependencies (except Supabase)
- ✅ Fast loading and performance optimized
