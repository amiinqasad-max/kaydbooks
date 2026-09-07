const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration for better error handling
config.resolver = {
  ...config.resolver,
  resolverMainFields: ['react-native', 'browser', 'main'],
  platforms: ['ios', 'android', 'native', 'web'],
  // Add asset extensions for PDF handling
  assetExts: [...config.resolver.assetExts, 'pdf'],
  // react-native-track-player's web player lazy-loads `shaka-player`
  // (an optional dependency, for adaptive HLS/DASH streaming this app
  // never uses -- see web-stubs/shakaPlayerStub.js) via a dynamic
  // `import(...)`. Metro still resolves the target of every `import()`
  // statically at bundle time, so without an actual `shaka-player`
  // package installed the web bundle fails to build at all. Redirect
  // that one specifier to a local stub instead of adding the real,
  // much larger package as a dependency for a code path this app never
  // exercises (KaydBooks only ever plays plain, direct-URL audio
  // files). Native platforms are untouched -- they never import this
  // module in the first place.
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && moduleName.startsWith('shaka-player')) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'web-stubs/shakaPlayerStub.js'),
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
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
