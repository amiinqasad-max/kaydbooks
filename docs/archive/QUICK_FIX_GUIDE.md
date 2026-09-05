# 🔧 Quick Fix Guide

## Issue 1: Database Error (UUID MIN function)
**Error:** `function min(uuid) does not exist`

### Solution:
Run this SQL file in your Supabase SQL Editor:
```sql
-- Use this file instead of COMPLETE_SCHEMA.sql
database/SIMPLE_SCHEMA_FIX.sql
```

This file creates all the necessary tables without the problematic cleanup queries.

## Issue 2: BORDER_RADIUS Error
**Error:** `Property 'BORDER_RADIUS' doesn't exist`

### Solution:
The issue might be a caching problem. Try these steps:

1. **Clear Metro Cache:**
```bash
npx expo start -c
```

2. **If that doesn't work, restart with clean cache:**
```bash
rm -rf node_modules/.cache
npx expo start -c
```

3. **Check if all enhanced screens are properly imported in App.js**

## Database Setup Steps:

1. **Go to your Supabase Dashboard**
2. **Open SQL Editor**
3. **Run the `SIMPLE_SCHEMA_FIX.sql` file**
4. **Verify tables are created:**
   - profiles
   - reading_goals  
   - reading_sessions
   - downloads
   - progress
   - favorites

## App Testing Steps:

1. **Start the app:** `npx expo start -c`
2. **Test these features:**
   - ✅ Settings screen (sign out should work)
   - ✅ Library screen (should show real data)
   - ✅ Profile screen (should show statistics)
   - ✅ Download functionality (PGRST204 error should be fixed)
   - ✅ Reading progress tracking

## If Issues Persist:

1. **Check Supabase connection**
2. **Verify all tables exist in Supabase**
3. **Check console for specific error messages**
4. **Ensure all imports are correct in enhanced screens**

The app should now work with:
- ✅ Consistent dark theme (#021945 background)
- ✅ Working downloads with proper database structure
- ✅ Real reading progress tracking
- ✅ Functional library with real user data
- ✅ Working settings and sign out
