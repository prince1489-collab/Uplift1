import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, __BUILD_ID__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Everything above assumes a browser, which is wrong for a third of the repo: the Vercel
    // functions in api/, the build config and the check scripts all run on Node. Without this
    // every `process.env` read was a `no-undef` error — 26 of them, all false, which is enough
    // noise to hide a real one. Not a rule relaxation: these globals genuinely exist here.
    files: ['api/**/*.js', 'scripts/**/*.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
])
