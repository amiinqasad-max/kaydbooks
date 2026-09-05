# Book Reader & Audiobook App

A complete React Native (Expo SDK 51) mobile application for reading books and listening to audiobooks, powered by Supabase backend.

## Features

- **Authentication**: Email/password signup, login, logout with Supabase Auth
- **Admin Dashboard**: Upload books with cover images, PDF files, and audio files
- **Book Library**: Browse all uploaded books with search functionality
- **PDF Reader**: Read books using react-native-pdf viewer
- **Audio Player**: Listen to audiobooks with expo-av player
- **Real Data**: All content comes from Supabase database and storage (no demo data)

## Prerequisites

- Node.js (v16 or higher)
- Expo CLI (`npm install -g @expo/cli`)
- Supabase account and project

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Update the `.env` file with your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Never** put real credentials anywhere but `.env` -- `services/supabase.js`
> reads them from environment variables only and will refuse to start
> without them. Do not hardcode a fallback URL/key in that file again (see
> the Phase 0 security fixes below for why).

### 3. Database Schema

Run, in order, in your Supabase SQL editor:

1. `database/schema.sql` -- base tables (profiles, books, favorites, etc.)
2. `supabase/migrations/003_authorization_and_schema_fixes.sql` -- **required**.
   This adds the admin role model, locks `books` writes to admins only,
   creates the `subscriptions`/`chapters`/`reading_sessions` tables, and
   fixes the RLS gaps described in `database/SCHEMA_DRIFT_REPORT.md`. Do
   not skip this file -- without it, any signed-up user can write to the
   book catalog.

Do not copy older policy snippets from anywhere else in this repo's history
(`database/archive/`, old commits) -- they predate the fixes in migration
`003` and reintroduce the exact vulnerability it closes.

After applying `003`, promote your own account to `super_admin` -- see the
runbook at the bottom of `database/SCHEMA_DRIFT_REPORT.md`.

### 4. Storage Setup

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `books`
3. **Set the bucket to private** (not public -- migration `003` already
   creates the storage RLS policies that decide who can read what:
   `covers/` stays public, `pdfs/`/`audio/` require either free-content
   access or an active subscription, and only admins can write). Do not
   apply the old "anyone authenticated can upload" / "public read"
   policies that used to live here -- they made every book's file
   permanently and publicly downloadable regardless of subscription status.

### 5. Admin Access

There is no hardcoded admin email. After signing up normally, promote your
own account by running, once, in the Supabase SQL editor:

```sql
update profiles set role = 'super_admin' where id = '<your-auth-uid>';
```

(Find your UUID under Authentication > Users.) See
`database/SCHEMA_DRIFT_REPORT.md` for the full runbook, including how a
super admin promotes others afterward.

## Running the App

```bash
# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

## Project Structure

```
├── screens/              # App screens
│   ├── LoginScreen.js
│   ├── SignUpScreen.js
│   ├── HomeScreen.js
│   ├── BookDetailScreen.js
│   ├── PDFViewerScreen.js
│   └── AudioPlayerScreen.js
├── admin/                # Admin screens
│   └── AdminUploadScreen.js
├── contexts/             # React contexts
│   └── AuthContext.js
├── services/             # API services
│   └── supabase.js
├── App.js               # Main app component
└── package.json         # Dependencies
```

## Usage

### For Users
1. Sign up or login with your credentials
2. Browse the book library on the home screen
3. Search for books by title or author
4. Tap on a book to view details
5. Read the PDF or listen to the audiobook

### For Admins
1. Login with admin credentials (`admin@bookapp.com`)
2. Tap "Admin: Upload Book" on the home screen
3. Fill in book details and select files:
   - Cover image (JPG/PNG)
   - PDF file
   - Audio file (MP3/M4A)
4. Upload the book

## Dependencies

- **expo**: ~54.0.0
- **react-native**: 0.76.3
- **@supabase/supabase-js**: ^2.39.0
- **react-native-pdf**: ^6.7.3
- **expo-av**: ~15.0.1
- **react-native-elements**: ^3.4.3
- **@react-navigation/native**: ^6.1.9

## Testing

1. Upload a real book using the admin interface
2. Verify the book appears in the home screen
3. Test PDF reading functionality
4. Test audio playback functionality
5. Test search and filtering

## Troubleshooting

### PDF not loading
- Ensure the PDF file is properly uploaded to Supabase Storage
- Check that the storage bucket is public
- Verify the PDF URL is accessible

### Audio not playing
- Ensure audio file format is supported (MP3, M4A, WAV)
- Check Supabase Storage permissions
- Verify audio URL is accessible

### Upload failing
- Check Supabase Storage policies
- Ensure file sizes are within limits
- Verify internet connection

## License

MIT License
# kayd
# kayd
# kaydbooks
