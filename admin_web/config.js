/**
 * Supabase Configuration for Admin Web Panel
 * 
 * IMPORTANT: Replace these with your actual Supabase credentials
 * You can find these in your Supabase Dashboard > Settings > API
 */

// SECURITY: do not commit a real project's values here. This file is
// listed in .gitignore going forward (as admin_web/config.local.js is the
// suggested untracked override) -- if your project's real anon key was
// ever committed to this file in git history, rotate it in the Supabase
// dashboard along with the service_role key (see RLS_BYPASS_SOLUTION.md).
const SUPABASE_CONFIG = {
    // Your Supabase URL
    url: 'YOUR_SUPABASE_URL_HERE',

    // Your Supabase Anon (public) Key -- never the service_role key.
    anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE',

    // Storage bucket name for books
    bucketName: 'books'
};

// Export configuration
window.SUPABASE_CONFIG = SUPABASE_CONFIG;

// Configuration checker
window.checkSupabaseConfig = function() {
    const issues = [];
    
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL_HERE') {
        issues.push('❌ Supabase URL not configured');
    } else if (!SUPABASE_CONFIG.url.includes('supabase.co')) {
        issues.push('⚠️ Supabase URL format looks incorrect');
    }
    
    if (!SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        issues.push('❌ Supabase anon key not configured');
    } else if (!SUPABASE_CONFIG.anonKey.startsWith('eyJ')) {
        issues.push('⚠️ Supabase anon key format looks incorrect');
    }
    
    if (issues.length > 0) {
        console.error('🔧 Configuration Issues:');
        issues.forEach(issue => console.error(issue));
        console.log('📖 Please check README.md for setup instructions');
        return false;
    }
    
    console.log('✅ Supabase configuration looks good');
    return true;
};

/**
 * SETUP INSTRUCTIONS:
 * 
 * 1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
 * 2. Select your project
 * 3. Go to Settings > API
 * 4. Copy your Project URL and replace 'YOUR_SUPABASE_URL_HERE'
 * 5. Copy your anon/public key and replace 'YOUR_SUPABASE_ANON_KEY_HERE'
 * 
 * Example:
 * url: 'https://abcdefghijklmnop.supabase.co',
 * anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
 */
