// Configuración de ESLint para React. Se ejecuta con: npm run lint
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Hace que ESLint entienda que un componente usado en JSX (<Boton />) sí está usado,
      // y así detecta de verdad los imports que sobran.
      'react/jsx-uses-vars': 'error',
      // Avisa si se usa en JSX un componente que no existe o no se importó.
      'react/jsx-no-undef': 'error',
      'react/jsx-key': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];
