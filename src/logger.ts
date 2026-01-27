// =============================================================================
// LOGGER MODULE
// =============================================================================
// Provides debug logging functionality for the bridge.
// Can be enabled/disabled at runtime.
// =============================================================================

import type { Logger } from './types';

const LOG_PREFIX = '[Bridgy]';

/**
 * Create a logger instance
 * @param context - Context label (e.g., 'Host', 'Guest')
 * @param enabled - Initial enabled state
 */
export function createLogger(context: string, enabled: boolean = false): Logger {
  let isEnabled = enabled;
  const prefix = `${LOG_PREFIX}:${context}`;

  const formatData = (data?: unknown): string => {
    if (data === undefined) return '';
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
  };

  return {
    log(direction: 'send' | 'recv', packetType: string, data?: unknown): void {
      if (!isEnabled) return;
      const arrow = direction === 'send' ? '→' : '←';
      console.log(`${prefix} ${arrow} ${packetType}`, data ?? '');
    },

    info(message: string, data?: unknown): void {
      if (!isEnabled) return;
      console.log(`${prefix} ℹ ${message}`, data !== undefined ? formatData(data) : '');
    },

    warn(message: string, data?: unknown): void {
      if (!isEnabled) return;
      console.warn(`${prefix} ⚠ ${message}`, data !== undefined ? formatData(data) : '');
    },

    error(message: string, data?: unknown): void {
      // Errors are always logged, regardless of debug state
      console.error(`${prefix} ✖ ${message}`, data !== undefined ? formatData(data) : '');
    },

    enable(): void {
      isEnabled = true;
    },

    disable(): void {
      isEnabled = false;
    },

    isEnabled(): boolean {
      return isEnabled;
    },
  };
}
