# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Setup Script (Optional)
```bash
npm run setup
```
This will prompt you for your Supabase credentials and automatically configure the app.

### 3. Manual Setup (Alternative)
If you prefer manual setup:

1. **Update `.env` file:**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

2. **Update `services/supabase.js`:**
   Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual credentials.

### 4. Database Setup
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/schema.sql`
4. Run the SQL commands

### 5. Storage Setup
1. Go to Storage in Supabase dashboard
2. Create a bucket named `books`
3. Set it to public
4. Add the storage policies mentioned in `database/schema.sql`

### 6. Start the App
```bash
npm start
```

## 📱 Testing the App

### Create Admin Account
1. Sign up with email: `admin@bookapp.com`
2. Use any password (remember it for login)

### Upload Your First Book
1. Login as admin
2. Tap "Admin: Upload Book"
3. Fill in details and select files:
   - Cover image (JPG/PNG)
   - PDF file
   - Audio file (MP3/M4A)
4. Upload

### Test User Features
1. View books on home screen
2. Search for books
3. Read PDF
4. Play audio

## 🔧 Troubleshooting

**App won't start?**
- Check that all dependencies are installed: `npm install`
- Ensure you're using Node.js v16+

**Can't upload files?**
- Verify Supabase Storage bucket is created and public
- Check storage policies are applied
- Ensure you're logged in as admin

**PDF/Audio won't load?**
- Check file URLs in Supabase Storage
- Verify files are publicly accessible
- Try smaller file sizes

## 📁 Project Structure

```
├── screens/          # All app screens
├── admin/           # Admin upload screen
├── contexts/        # React contexts (Auth)
├── services/        # Supabase client
├── components/      # Reusable components
├── database/        # SQL schema
├── scripts/         # Setup scripts
└── assets/          # App icons/images
```

## 🎯 Key Features Implemented

✅ **Authentication**
- Email/password signup & login
- Secure session management
- User profiles

✅ **Admin Dashboard**
- File upload (images, PDFs, audio)
- Book metadata management
- Supabase Storage integration

✅ **User Experience**
- Book browsing & search
- PDF reading with react-native-pdf
- Audio playback with expo-av
- Modern UI with react-native-elements

✅ **Real Data**
- No demo/fake content
- All data from Supabase
- Real file uploads and downloads

## 🔐 Security Features

- Row Level Security (RLS) enabled
- User authentication required
- Secure file storage
- Admin-only upload permissions

Ready to start reading! 📚🎧
