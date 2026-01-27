// =============================================================================
// BRIDGY LOGGER
// =============================================================================

const PREFIX = '[Bridgy]';

export function createLogger(context: string, enabled = false) {
  let isEnabled = enabled;

  return {
    log(direction: 'send' | 'recv', type: string, data?: unknown) {
      if (!isEnabled) return;
      const arrow = direction === 'send' ? '→' : '←';
      console.log(`${PREFIX}:${context} ${arrow} ${type}`, data ?? '');
    },

    info(msg: string) {
      if (!isEnabled) return;
      console.log(`${PREFIX}:${context}`, msg);
    },

    warn(msg: string) {
      if (!isEnabled) return;
      console.warn(`${PREFIX}:${context}`, msg);
    },

    error(msg: string) {
      console.error(`${PREFIX}:${context}`, msg);
    },

    enable() { isEnabled = true; },
    disable() { isEnabled = false; },
    isEnabled() { return isEnabled; },
  };
}

export type Logger = ReturnType<typeof createLogger>;
