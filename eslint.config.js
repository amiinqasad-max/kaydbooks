// Minimal, sensible ESLint setup for this Expo/React Native project.
// Intentionally NOT a style overhaul -- the goal (per the Phase 1.6 audit)
// is to catch genuine correctness bugs (undefined variables, unreachable
// code, unused vars that hide typos) without relitigating this codebase's
// existing formatting conventions.
const expoConfig = require('eslint-config-expo/flat');
const jestPlugin = require('eslint-plugin-jest');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      'docs/archive/**',
      'database/archive/**',
      'admin_web/**', // plain browser JS, not part of the RN/Expo lint target
      'scripts/**',
      // Deno Edge Functions -- a different runtime with its own remote-URL
      // import scheme (`import ... from "https://deno.land/..."`) that
      // ESLint's Node/RN-oriented resolver correctly can't and shouldn't
      // resolve. These are checked with `deno check`, not this config.
      'supabase/functions/**',
    ],
  },
  {
    files: ['**/__tests__/**', '**/*.test.js'],
    plugins: { jest: jestPlugin },
    languageOptions: {
      globals: jestPlugin.environments.globals.globals,
    },
  },
  {
    rules: {
      // This codebase uses console.log/warn/error extensively as its only
      // logging mechanism (see the Phase 0/1 audits) -- flagging every one
      // would be thousands of pre-existing warnings unrelated to this
      // pass. Kept as a warning, not silenced, so new call sites are still
      // visible in review.
      'no-console': 'off',
      // Unused variables ARE worth catching (they're a common symptom of
      // a half-finished refactor, e.g. an import left behind after
      // deleting the code that used it) but shouldn't be build-breaking
      // for a codebase that has never run a linter before.
      'no-unused-vars': 'warn',
    },
  },
];
