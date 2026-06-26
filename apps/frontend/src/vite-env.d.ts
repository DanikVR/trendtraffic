/// <reference types="vite/client" />

/**
 * Типы переменных окружения Vite для фронтенда VibeVox.
 * Переменные с префиксом VITE_ доступны в клиентском коде.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_LIVEKIT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
