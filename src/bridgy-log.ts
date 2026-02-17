// =============================================================================
// BRIDGY LOG - Independent Debug Controller
// =============================================================================
// Completely separate from BridgyLite. If BridgyLog = null, BridgyLite works.
// If BridgyLite = null, BridgyLog still exists but has nothing to toggle.
// =============================================================================

const STORAGE_KEY = 'bridgy:debug';

interface LogEntry {
  label: string;
  line: string;
  detail?: unknown;
  ts: number;
}

interface BridgeLogHandle {
  enable(): void;
  disable(): void;
  getHistory(): LogEntry[];
}

/** Registry of bridge instances — stores only toggle callbacks, never the bridge itself */
const registry = new Map<string, BridgeLogHandle>();

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    if (raw === '*') return ['*'];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function writeStorage(labels: string[]): void {
  try {
    if (labels.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else if (labels.includes('*')) {
      localStorage.setItem(STORAGE_KEY, '*');
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    }
  } catch {
    // localStorage unavailable (e.g. sandboxed iframe) — silent fail
  }
}

export const BridgyLog = {
  /**
   * Enable debug logging. Replays history then enables live logging.
   * @param label - Specific instance label, or omit for all instances
   */
  enable(label?: string): void {
    if (!label) {
      // Enable all
      registry.forEach((handle, name) => {
        replayHistory(name, handle);
        handle.enable();
      });
      writeStorage(['*']);
      return;
    }

    const handle = registry.get(label);
    if (!handle) {
      console.warn(`[BridgyLog] No instance found with label "${label}". Available: ${Array.from(registry.keys()).join(', ') || '(none)'}`);
      return;
    }

    replayHistory(label, handle);
    handle.enable();

    const stored = readStorage();
    if (!stored.includes('*') && !stored.includes(label)) {
      stored.push(label);
      writeStorage(stored);
    }
  },

  /**
   * Disable debug logging.
   * @param label - Specific instance label, or omit for all instances
   */
  disable(label?: string): void {
    if (!label) {
      registry.forEach(handle => handle.disable());
      writeStorage([]);
      return;
    }

    registry.get(label)?.disable();
    const stored = readStorage().filter(l => l !== label && l !== '*');
    writeStorage(stored);
  },

  /** List all registered instances and their debug status */
  list(): void {
    if (registry.size === 0) {
      console.log('[BridgyLog] No instances registered');
      return;
    }

    console.log('[BridgyLog] Registered instances:');
    registry.forEach((_handle, name) => {
      console.log(`  - ${name}`);
    });
  },

  /** @internal - Called by BridgyLite constructor */
  _register(label: string, handle: BridgeLogHandle): void {
    registry.set(label, handle);
  },

  /** @internal - Called by BridgyLite.destroy() */
  _unregister(label: string): void {
    registry.delete(label);
  },

  /** @internal - Check if a label should auto-enable on init */
  _shouldAutoEnable(label: string): boolean {
    const stored = readStorage();
    return stored.includes('*') || stored.includes(label);
  },
};

function replayHistory(label: string, handle: BridgeLogHandle): void {
  const history = handle.getHistory();
  if (history.length === 0) return;

  console.log(`[${label}] ── History (${history.length} entries) ──`);
  for (const entry of history) {
    if (entry.detail !== undefined) {
      console.log(entry.line, entry.detail);
    } else {
      console.log(entry.line);
    }
  }
  console.log(`[${label}] ── Live ──`);
}

export type { LogEntry, BridgeLogHandle };
