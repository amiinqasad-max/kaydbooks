#!/usr/bin/env node

/**
 * Expo SDK 53 Migration Script
 * Automatically updates remaining react-native-elements imports
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Files that need react-native-elements replacement
const filesToUpdate = [
  'screens/AboutScreen.js',
  'screens/BookDetailScreen.js',
  'screens/CategoryBooksScreen.js',
  'screens/EditProfileScreen.js',
  'screens/ExploreScreen.js',
  'screens/HomeScreen.js',
  'screens/LibraryScreen.js',
  'screens/ModernTopAudiobooksScreen.js',
  'screens/ModernTopReadsScreen.js',
  'screens/PDFViewerScreen.js',
  'screens/PageFlipPDFViewer.js',
  'screens/PricingScreen.js',
  'screens/ProfileScreen.js',
  'screens/ReadingGoalsScreen.js',
  'screens/ReadingStatsScreen.js',
  'screens/SettingsScreen.js',
  'screens/TopAudiobooksScreen.js',
  'screens/TopReadsScreen.js',
  'admin/AdminEditScreen.js'
];

// Common replacements
const replacements = [
  {
    from: /import\s*{\s*([^}]*Text[^}]*)\s*}\s*from\s*['"]react-native-elements['"];?/g,
    to: (match, imports) => {
      const cleanImports = imports
        .split(',')
        .map(imp => imp.trim())
        .filter(imp => imp && !imp.includes('Text'))
        .join(', ');
      
      if (cleanImports) {
        return `import { ${cleanImports} } from 'react-native-paper';`;
      }
      return '// Removed react-native-elements dependency';
    }
  },
  {
    from: /from\s*'react-native'\s*;/g,
    to: (match) => {
      if (!match.includes('Text,')) {
        return match.replace('} from', ', Text } from');
      }
      return match;
    }
  },
  {
    from: /SearchBar/g,
    to: 'Searchbar'
  },
  {
    from: /Input/g,
    to: 'TextInput'
  },
  {
    from: /ListItem/g,
    to: 'List.Item'
  },
  {
    from: /Header/g,
    to: '// Header removed - use custom header'
  }
];

function updateFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  // Apply replacements
  replacements.forEach(replacement => {
    const newContent = content.replace(replacement.from, replacement.to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🚀 Starting Expo SDK 53 Migration...\n');

  let updatedCount = 0;
  let totalCount = 0;

  filesToUpdate.forEach(filePath => {
    totalCount++;
    if (updateFile(filePath)) {
      updatedCount++;
    }
  });

  console.log(`\n📊 Migration Summary:`);
  console.log(`   Total files processed: ${totalCount}`);
  console.log(`   Files updated: ${updatedCount}`);
  console.log(`   Files unchanged: ${totalCount - updatedCount}`);
  
  console.log('\n🎉 Migration completed!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run: npm install');
  console.log('   2. Run: expo start --clear');
  console.log('   3. Test the app thoroughly');
}

if (require.main === module) {
  main();
}

module.exports = { updateFile, replacements };
