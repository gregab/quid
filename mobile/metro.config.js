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

// NativeWind's Tailwind CLI subprocess (child.js) is forked as a separate
// Node.js process and does NOT inherit the Module._resolveFilename patch above.
// Inject our resolver hook via NODE_OPTIONS so the child process loads it at
// startup before requiring "tailwindcss/lib/cli/build".
const resolverHook = path.resolve(__dirname, "tailwind-v3-resolver.js");
const nodeOptionsFlag = `--require ${resolverHook}`;
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS
  ? `${process.env.NODE_OPTIONS} ${nodeOptionsFlag}`
  : nodeOptionsFlag;

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

// Test files must never be bundled by Metro — they use vitest/happy-dom APIs
// that don't exist in Hermes, and Expo Router picks them up as routes. Vitest
// runs independently and is unaffected by this block.
config.resolver.blockList = [/.*\.test\.(ts|tsx|js|jsx)$/];

// Vite and vitest are server-only build tools hoisted to the monorepo root.
// They use Node.js-specific syntax (import.meta.resolve) that Hermes can't
// handle. Resolve them as empty modules so they're never bundled.
const SERVER_ONLY_MODULES = /^(vite|vitest)(\/|$)/;

// Some packages must resolve to a single instance across the whole bundle to
// avoid duplicate-context bugs (e.g. "Invalid hook call", NativeWind styles
// not applied). We use require.resolve() to get the absolute path and return
// it directly, bypassing Metro's standard parent-directory walk entirely.
//
// Modifying `nodeModulesPaths` alone is NOT sufficient: Metro walks parent
// directories first, so root/node_modules wins for packages installed there.
//
// "react" — must be one instance or hooks break.
//   Pinned to mobile/node_modules (matches react-native-renderer version).
//
// "react-native-css-interop" — NativeWind bundles its own nested copy AND
//   mobile/package.json has another. Two instances = different React Contexts
//   = NativeWind StyleSheets never reach the components. Pin to mobile copy.
const PINNED_TO_MOBILE = /^(react(\/|$)|react-native-css-interop(\/|$))/;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SERVER_ONLY_MODULES.test(moduleName)) {
    return { type: "empty" };
  }
  if (PINNED_TO_MOBILE.test(moduleName)) {
    try {
      const filePath = require.resolve(moduleName, {
        paths: [mobileNodeModules],
      });
      return { type: "sourceFile", filePath };
    } catch {
      // Fall through to default resolution if not found in mobile/node_modules
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
