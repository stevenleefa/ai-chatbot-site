// Jest config via Next.js (next/jest): SWC transform, tsconfig
// path aliases (@/*) and the jsdom environment are handled for us.
// React 18.3.1 — no React 19-only APIs anywhere in the tests.
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Path to the Next.js app, used to load next.config.js and .env.
  dir: "./",
});

// Any custom config goes here.
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
};

module.exports = createJestConfig(customJestConfig);
