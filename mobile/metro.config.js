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

// Vite and vitest are server-only build tools hoisted to the monorepo root.
// They use Node.js-specific syntax (import.meta.resolve) that Hermes can't
// handle. Resolve them as empty modules so they're never bundled.
const SERVER_ONLY_MODULES = /^(vite|vitest)(\/|$)/;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SERVER_ONLY_MODULES.test(moduleName)) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
