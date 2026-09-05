# 🚀 Quick Setup Guide for Admin Web Panel

## ❌ **Current Error:**
```
Upload failed: Cannot read properties of undefined (reading 'uploadFile')
Failed to load books: Cannot read properties of undefined (reading 'getBooks')
```

**This means:** The Supabase service is not initialized because the configuration is missing.

## ✅ **Fix in 3 Steps:**

### **Step 1: Get Your Supabase Credentials**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these two values:
   - **Project URL** (looks like: `https://abcdefghijk.supabase.co`)
   - **anon public key** (starts with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### **Step 2: Update config.js**
Open `admin_web/config.js` and replace the placeholder values:

```javascript
const SUPABASE_CONFIG = {
    // Replace with YOUR actual URL
    url: 'https://your-project-id.supabase.co',
    
    // Replace with YOUR actual anon key
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-actual-key-here',
    
    bucketName: 'books'
};
```

### **Step 3: Create Storage Bucket**
1. In Supabase Dashboard, go to **Storage**
2. Click **Create Bucket**
3. Name it: `books`
4. Make it **Public**
5. Click **Create**

## 🧪 **Test Your Setup:**

1. Open `admin_web/index.html` in your browser
2. Open browser console (F12)
3. You should see: `✅ Supabase initialized successfully`
4. If you see errors, check the console for specific issues

## 🔍 **Troubleshooting:**

### **Still getting errors?**
Check browser console for these messages:

- `❌ Supabase URL not configured` → Update config.js with your URL
- `❌ Supabase anon key not configured` → Update config.js with your key
- `Supabase library not loaded` → Check internet connection
- `Database error` → Check if your `books` table exists

### **Database Schema Check:**
Your `books` table should have these columns:
- `id` (uuid, primary key)
- `title` (text)
- `author` (text)
- `description` (text)
- `category` (text)
- `cover_url` (text)
- `pdf_url` (text)
- `audio_url` (text)
- `created_at` (timestamp)

## 🎯 **Expected Result:**
After configuration, you should see:
```
✅ Supabase configuration looks good
✅ Supabase initialized successfully
```

Then the upload and manage features will work perfectly!

## 📞 **Need Help?**
If you're still having issues:
1. Check the browser console for error messages
2. Verify your Supabase credentials are correct
3. Make sure the `books` table exists in your database
4. Ensure the `books` storage bucket is created and public
