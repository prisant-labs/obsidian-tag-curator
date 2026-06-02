module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022,
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
  ignorePatterns: [
    'main.js',
    'node_modules/',
    'docs/',
    // Legacy UI files queued for rewrite in Phase C (Tasks 10, 11, 13).
    // Remove these entries when the rewrites land so the new code is lint-clean.
    'src/ui/settingsTab.ts',
    'src/ui/tagListView.ts',
    'src/ui/ruleEditor.ts',
  ],
};
