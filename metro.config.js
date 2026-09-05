const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for better error handling
config.resolver = {
  ...config.resolver,
  resolverMainFields: ['react-native', 'browser', 'main'],
  platforms: ['ios', 'android', 'native', 'web'],
  // Add asset extensions for PDF handling
  assetExts: [...config.resolver.assetExts, 'pdf'],
};

// Add transformer configuration for better polyfill handling
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
  // Add getTransformOptions for better native module handling
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Add watchFolders for better module resolution
config.watchFolders = [
  ...config.watchFolders || [],
];

module.exports = config;
