module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 usa il plugin di react-native-worklets (deve restare ULTIMO).
      'react-native-worklets/plugin',
    ],
  };
};
