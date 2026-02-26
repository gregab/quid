module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Explicitly register the expo-router babel plugin because babel-preset-expo's
      // auto-detection (hasModule('expo-router')) fails in the monorepo — babel-preset-expo
      // is hoisted to root node_modules/ but expo-router is in mobile/node_modules/.
      require("babel-preset-expo/build/expo-router-plugin").expoRouterBabelPlugin,
      "react-native-reanimated/plugin",
    ],
  };
};
