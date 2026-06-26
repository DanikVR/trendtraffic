import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Конфигурация Vite для фронтенда VibeVox.
 * - Алиас '@' → './src' для чистых импортов
 * - Прокси '/api' → бэкенд на порту 3001
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true, // слушаем 0.0.0.0, чтобы ngrok мог проксировать
    // Разрешаем приходящие запросы с публичных ngrok-хостов (любой поддомен).
    // Без этого Vite отвечает 403 "Invalid Host header" на туннелированные запросы.
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io', '.ngrok.app', '.ngrok.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // ENTERPRISE v0.10.0: статическая раздача загруженных медиа из enterprise_chat
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
