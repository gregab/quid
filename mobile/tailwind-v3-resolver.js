/**
 * Tailwind v3 module resolver hook.
 *
 * Injected into child processes via NODE_OPTIONS so that NativeWind's
 * Tailwind CLI subprocess (nativewind/dist/metro/tailwind/v3/child.js)
 * resolves "tailwindcss" from mobile/node_modules (v3) instead of the
 * monorepo root (v4), which NativeWind does not support.
 */
const Module = require("module");
const path = require("path");
const mobileNodeModules = path.resolve(__dirname, "node_modules");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  if (request === "tailwindcss" || request.startsWith("tailwindcss/")) {
    try {
      return originalResolve.call(
        this,
        request,
        { ...parent, paths: [mobileNodeModules] },
        ...args
      );
    } catch {
      // Fall through to default resolution
    }
  }
  return originalResolve.call(this, request, parent, ...args);
};
