import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Flat config (ESLint 9+). Ported 1:1 from the legacy .eslintrc.cjs:
// same parser, same recommended presets, same three custom rules, same ignores.
export default tseslint.config(
  // A config with only `ignores` is the flat-config replacement for ignorePatterns.
  // node_modules is ignored by default, so it no longer needs listing.
  {
    ignores: [
      'main.js',
      'docs/',
      // Legacy UI files queued for rewrite; remove when the rewrites land.
      'src/ui/settingsTab.ts',
      'src/ui/tagListView.ts',
      'src/ui/ruleEditor.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
