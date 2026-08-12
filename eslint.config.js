import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'apps/app/android/**', 'pnpm-lock.yaml'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      // Nama halaman/komponen kadang memang satu kata (Browse, Updates) — itu
      // sudah jelas dari foldernya, jadi aturan multi-word cuma bikin bising.
      'vue/multi-word-component-names': 'off',
      // Prop opsional bertipe TS memang sengaja `undefined` waktu tidak diisi;
      // nilai default-nya ditentukan `cva()`, bukan deklarasi prop. Memaksa
      // default di sini justru menggandakan sumber kebenaran varian.
      'vue/require-default-prop': 'off',
    },
  },

  {
    languageOptions: {
      globals: {
        // Ditanam Vite lewat `define`; dideklarasikan tipenya di apps/app/env.d.ts.
        __APP_VERSION__: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` dilarang keras: seluruh nilai yang masuk app berasal dari kode
      // extension pihak ketiga, jadi batas tipenya harus dijaga di kompilasi.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },

  {
    // Skrip perkakas jalan di Node, bukan di browser. Globals-nya ditulis
    // manual supaya root tidak perlu menarik paket `globals`.
    files: ['scripts/**/*.mjs', '**/*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
      },
    },
  },

  prettier,
)
