// ESLint flat config (ESLint 9).
//
// Цель — проверять то, чего НЕ делает tsc: правила React-хуков
// (rules-of-hooks + exhaustive-deps). Конфиг намеренно минимальный, чтобы не
// «утопить» зрелый код в шуме базовых правил. Расширять по мере необходимости
// (например, добавить ...tseslint.configs.recommended для строгих TS-проверок).
//
// Запуск:  npm run lint        (из apps/frontend)
//          npm run lint:fix    (безопасный автофикс; хуки НЕ автофиксятся)

import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['dist/**', 'public/**', 'scripts/**', 'node_modules/**', 'eslint.config.js', '**/*.config.js'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',     // реальные баги — ошибка
      'react-hooks/exhaustive-deps': 'warn',     // подсказка по зависимостям — предупреждение
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Раскомментируй, чтобы единым списком увидеть весь any-долг (≈625 мест):
      // '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
