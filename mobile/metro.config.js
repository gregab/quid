const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// NativeWind requires Tailwind CSS v3 but the root workspace has v4.
// Override Node's module resolution so NativeWind loads mobile's v3 copy.
const Module = require("module");
const originalResolve = Module._resolveFilename;
const mobileNodeModules = path.resolve(__dirname, "node_modules");
Module._resolveFilename = function (request, parent, ...args) {
  if (request === "tailwindcss" || request.startsWith("tailwindcss/")) {
    try {
      // Try resolving from mobile/node_modules first
      return originalResolve.call(this, request, { ...parent, paths: [mobileNodeModules] }, ...args);
    } catch {
      // Fall through to default resolution
    }
  }
  return originalResolve.call(this, request, parent, ...args);
};

const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Extend Expo's default watchFolders with the monorepo root
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Resolve modules from both mobile/node_modules and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];


module.exports = withNativeWind(config, { input: "./global.css" });
