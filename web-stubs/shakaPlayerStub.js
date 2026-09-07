// Stub for the optional `shaka-player` dependency that
// react-native-track-player's web implementation lazy-loads (via a
// dynamic `import('shaka-player/dist/shaka-player.ui')`) to support
// adaptive HLS/DASH streaming. KaydBooks only ever plays plain,
// direct-URL audio files (see services/downloadManager.js /
// contexts/AudioPlayerContext.js) -- it never needs adaptive streaming,
// so shaka-player is not (and should not become) a real dependency of
// this app.
//
// Metro still statically resolves the target of every `import()`
// expression at bundle time, even one only reached behind a runtime
// condition this app never satisfies, so without this stub the web
// bundle fails to build at all with "Unable to resolve module
// shaka-player/dist/shaka-player.ui". metro.config.js redirects that
// specific import to this file (web platform only) instead of pulling
// in the real, much larger shaka-player package for a code path that
// never actually runs here.
//
// If react-native-track-player's web player code ever reaches this
// (it shouldn't, given the app's usage), `polyfill`/`Player` are the
// two members its own source touches -- both safe, inert no-ops.
const shaka = {
  polyfill: { installAll: () => {} },
  Player: class {
    static isBrowserSupported() {
      return false;
    }
  },
};

export default shaka;
