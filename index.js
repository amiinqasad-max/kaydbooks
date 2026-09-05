import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// PHASE 1 FIX: this was never called, meaning services/trackPlayerService.js
// (lock-screen / headset / Bluetooth remote-control handling) was dead code
// -- react-native-track-player requires its background service registered
// exactly once, here, at the true JS entry point, separate from the React
// component tree. Only takes effect in a real dev/production build, since
// react-native-track-player's native module isn't available in Expo Go.
try {
  const TrackPlayer = require('react-native-track-player').default;
  TrackPlayer.registerPlaybackService(() => require('./services/trackPlayerService'));
} catch (error) {
  // Expected in Expo Go, where the native module isn't linked --
  // safeAudioService already falls back to expo-av in that environment.
}
