import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// typescript-eslint and eslint-plugin-vue wired up directly rather than through
// @vue/eslint-config-typescript, which pulls in fast-glob and with it an unpatched braces advisory.
export default defineConfig(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  tseslint.configs.recommended,
  {
    // The core-rule adjustments typescript-eslint makes for .ts files apply to .vue files too.
    ...tseslint.configs.eslintRecommended,
    files: ['**/*.vue'],
  },

  // After typescript-eslint, whose parser would otherwise win for .vue files.
  ...pluginVue.configs['flat/essential'],
  {
    name: 'app/vue-typescript',
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
    },
  },

  {
    name: 'app/rules',
    rules: {
      // `const { class: _, ...rest } = attrs` is the idiomatic way to omit keys.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['tests/**/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
)
