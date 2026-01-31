import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',  // Enables window, postMessage, MessageEvent
    globals: true,         // No need to import describe, it, expect
  },
});
