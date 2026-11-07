// =============================================================================
// BRIDGY LITE - Lightweight Bridge for Simple Use Cases
// =============================================================================

import type { EventHandler, RequestHandler } from './types';
import { makeId, isOriginAllowed } from './utils';
import { BridgyLog } from './bridgy-log';
import type { LogEntry } from './bridgy-log';

// =============================================================================
// CONFIG
// =============================================================================

export interface BridgyLiteConfig {
  /** Role: 'parent' (has iframe) or 'child' (inside iframe) */
  role: 'parent' | 'child';
  /** Allowed origins */
  origins: string[];
  /** Label for identifying this instance in logs (default: 'Bridgy') */
  label?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Command names whose payloads should be redacted in logs */
  redact?: string[];
}

// =============================================================================
// LITE PACKET TYPES
// =============================================================================

interface LitePacket {
  __bridgy?: boolean;
  type?: 'DATA' | 'REQUEST' | 'RESPONSE';
  id?: string;
  timestamp?: number;
  command?: string;
  payload?: unknown;
  replyTo?: string;
  error?: string;
}

interface RequestOptions {
  timeout?: number;
}

// =============================================================================
// HELPERS
// =============================================================================

const MAX_HISTORY = 50;

function formatTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

// =============================================================================
// BRIDGY LITE CLASS
// =============================================================================

export class BridgyLite {
  private readonly role: 'parent' | 'child';
  private readonly origins: string[];
  private readonly label: string;
  private readonly timeout: number;
  private readonly redactCommands: Set<string>;

  private debugEnabled: boolean;
  private connected = false;
  private targetWindow: Window | null = null;
  private targetOrigin: string | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }
  >();

  // History buffer — always records, even when debug is off
  private readonly history: LogEntry[] = [];

  constructor(config: BridgyLiteConfig) {
    this.role = config.role;
    this.origins = config.origins;
    this.label = config.label ?? 'Bridgy';
    this.timeout = config.timeout ?? 30000;
    this.redactCommands = new Set(config.redact ?? []);

    // Debug: explicit config > localStorage seed
    this.debugEnabled = config.debug ?? BridgyLog._shouldAutoEnable(this.label);

    // Register with BridgyLog for runtime toggle
    BridgyLog._register(this.label, {
      enable: () => { this.debugEnabled = true; },
      disable: () => { this.debugEnabled = false; },
      getHistory: () => this.history,
    });

    this.record('✓', 'Initialized', { role: this.role });
  }

  // ===========================================================================
  // CONNECTION
  // ===========================================================================

  /** Connect to the other side (immediate, no handshake) */
  connect(): void {
    if (this.connected) {
      this.record('⚠', 'Already connected');
      return;
    }

    if (this.role === 'child') {
      const parent = window.parent;
      if (!parent || parent === window) {
        throw new Error('No parent window - must run in iframe');
      }
      this.targetWindow = parent;
      this.targetOrigin = this.origins[0] || '*';
    }
    // Parent: targetWindow set when iframe sends first message

    this.listen();
    this.connected = true;
    this.record('✓', 'Connected');
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.connected;
  }

  // ===========================================================================
  // MESSAGE LISTENING
  // ===========================================================================

  private listen(): void {
    this.messageHandler = (event: MessageEvent) => {
      // Validate origin
      if (!this.isValidOrigin(event.origin)) {
        this.record('✗', 'BLOCKED_ORIGIN', { origin: event.origin });
        return;
      }

      const data = event.data;

      // Handle Bridgy packets
      if (this.isBridgyPacket(data)) {
        this.handleBridgyPacket(data, event);
        return;
      }

      // Handle raw messages (extract command from data.command, data.type, or data.event)
      const command = data?.command || data?.type || data?.event;
      if (command && typeof command === 'string') {
        const handlers = this.eventHandlers.get(command);
        this.record('↓', `RAW ${command}`, this.safePayload(command, data));
        handlers?.forEach(h => h(data, event));
        return;
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  private isBridgyPacket(data: unknown): data is LitePacket {
    return (
      typeof data === 'object' &&
      data !== null &&
      '__bridgy' in data &&
      (data as LitePacket).__bridgy === true
    );
  }

  private isValidOrigin(origin: string): boolean {
    if (this.role === 'parent') {
      return isOriginAllowed(origin, this.origins);
    }
    return this.origins[0] === '*' || this.origins.includes(origin);
  }

  // ===========================================================================
  // PACKET HANDLING
  // ===========================================================================

  private handleBridgyPacket(packet: LitePacket, event: MessageEvent): void {
    // Set target window for parent (from first message)
    if (this.role === 'parent' && !this.targetWindow) {
      this.targetWindow = event.source as Window;
      this.targetOrigin = event.origin;
      this.record('✓', 'Target set', { origin: event.origin });
    }

    // Handle DATA packets (events)
    if (packet.type === 'DATA' && packet.command) {
      this.record('↓', `DATA ${packet.command}`, this.safePayload(packet.command, packet.payload), packet.id);
      this.eventHandlers.get(packet.command)?.forEach(h => h(packet.payload, event));
    }

    // Handle REQUEST packets
    if (packet.type === 'REQUEST' && packet.command) {
      this.record('↓', `REQUEST ${packet.command}`, this.safePayload(packet.command, packet.payload), packet.id);
      this.handleRequest(packet, event);
    }

    // Handle RESPONSE packets
    if (packet.type === 'RESPONSE' && packet.replyTo) {
      this.record('↓', `RESPONSE`, this.safePayload(undefined, packet.payload), packet.replyTo);
      const pending = this.pendingRequests.get(packet.replyTo);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(packet.replyTo);
        packet.error ? pending.reject(new Error(packet.error)) : pending.resolve(packet.payload);
      }
    }
  }

  private async handleRequest(packet: LitePacket, event: MessageEvent): Promise<void> {
    const handler = this.requestHandlers.get(packet.command!);

    if (!packet.id) {
      this.record('✗', 'Request missing ID');
      return;
    }

    const response: LitePacket = {
      __bridgy: true,
      type: 'RESPONSE',
      id: makeId('res'),
      timestamp: Date.now(),
      replyTo: packet.id,
    };

    if (!handler) {
      response.error = `No handler for: ${packet.command}`;
    } else {
      try {
        response.payload = await handler(packet.payload, event);
      } catch (err) {
        response.error = err instanceof Error ? err.message : 'Handler error';
      }
    }

    this.sendPacket(response);
  }

  // ===========================================================================
  // SENDING
  // ===========================================================================

  private sendPacket(packet: LitePacket): void {
    if (!this.targetWindow) {
      this.record('✗', 'No target window');
      return;
    }

    this.targetWindow.postMessage(packet, this.targetOrigin || '*');
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Send fire-and-forget event */
  send<T>(command: string, payload?: T): void {
    const id = makeId('data');
    this.record('↑', `DATA ${command}`, this.safePayload(command, payload), id);
    this.sendPacket({
      __bridgy: true,
      type: 'DATA',
      id,
      timestamp: Date.now(),
      command,
      payload,
    });
  }

  /** Subscribe to events */
  on<T>(command: string, handler: EventHandler<T>): void {
    const set = this.eventHandlers.get(command) ?? new Set();
    set.add(handler as EventHandler);
    this.eventHandlers.set(command, set);
  }

  /** Unsubscribe from events */
  off(command?: string, handler?: EventHandler): void {
    if (!command) {
      this.eventHandlers.clear();
      return;
    }
    if (!handler) {
      this.eventHandlers.delete(command);
      return;
    }
    this.eventHandlers.get(command)?.delete(handler);
  }

  /** Request-response pattern (returns Promise) */
  request<TReq, TRes>(command: string, payload?: TReq, options?: RequestOptions): Promise<TRes> {
    return new Promise((resolve, reject) => {
      const id = makeId('req');
      const timeout = options?.timeout ?? this.timeout;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.record('✗', `TIMEOUT ${command}`, { timeout }, id);
        reject(new Error(`Timeout: ${command} (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.record('↑', `REQUEST ${command}`, this.safePayload(command, payload), id);
      this.sendPacket({
        __bridgy: true,
        type: 'REQUEST',
        id,
        timestamp: Date.now(),
        command,
        payload,
      });
    });
  }

  /** Register request handler */
  handle<TReq, TRes>(command: string, handler: RequestHandler<TReq, TRes>): void {
    this.requestHandlers.set(command, handler as RequestHandler);
  }

  /** Cleanup and destroy */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    this.eventHandlers.clear();
    this.requestHandlers.clear();

    this.pendingRequests.forEach(p => {
      clearTimeout(p.timer);
      p.reject(new Error('Destroyed'));
    });
    this.pendingRequests.clear();

    this.connected = false;
    this.targetWindow = null;

    BridgyLog._unregister(this.label);
    this.record('✓', 'Destroyed');
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  /** Redact payload for sensitive commands */
  private safePayload(command: string | undefined, payload: unknown): unknown {
    if (command && this.redactCommands.has(command)) {
      return '[REDACTED]';
    }
    return payload;
  }

  /**
   * Record a log entry. Always buffers to history.
   * Only prints to console when debug is enabled.
   */
  private record(icon: string, message: string, detail?: unknown, id?: string): void {
    const time = formatTime();
    const idPart = id ? ` (${id})` : '';
    const line = `[${this.label} ${icon}] ${message}${idPart} ${time}`;

    // Always buffer to history (circular, max 50)
    const entry: LogEntry = { label: this.label, line, detail, ts: Date.now() };
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    // Only print when debug is on
    if (!this.debugEnabled) return;

    if (detail !== undefined && detail !== null) {
      console.log(line, detail);
    } else {
      console.log(line);
    }
  }
}
