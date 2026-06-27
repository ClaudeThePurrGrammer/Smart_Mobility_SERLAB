const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Risolve "Must Specify Expo Platform" su Android:
// Metro deve conoscere esplicitamente le piattaforme target prima che NativeWind
// trasformi il CSS — altrimenti il transformer non sa se siamo su iOS/Android/web.
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

module.exports = withNativeWind(config, {
  input: './global.css',
  // inlineRem: evita discrepanze di font-size tra iOS e Android con NativeWind v4
  inlineRem: 14,
});
