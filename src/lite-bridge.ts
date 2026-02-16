// =============================================================================
// BRIDGY LITE - Lightweight Bridge for Simple Use Cases
// =============================================================================

import type { EventHandler, RequestHandler } from './types';
import { makeId, isOriginAllowed } from './utils';

// =============================================================================
// CONFIG
// =============================================================================

export interface BridgyLiteConfig {
  /** Role: 'parent' (has iframe) or 'child' (inside iframe) */
  role: 'parent' | 'child';
  /** Allowed origins */
  origins: string[];
  /** Enable debug logging */
  debug?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
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
// BRIDGY LITE CLASS
// =============================================================================

export class BridgyLite {
  private readonly role: 'parent' | 'child';
  private readonly origins: string[];
  private readonly debug: boolean;
  private readonly timeout: number;

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

  constructor(config: BridgyLiteConfig) {
    this.role = config.role;
    this.origins = config.origins;
    this.debug = config.debug ?? false;
    this.timeout = config.timeout ?? 30000;

    this.log('info', 'BridgyLite initialized', { role: this.role });
  }

  // ===========================================================================
  // CONNECTION
  // ===========================================================================

  /** Connect to the other side (immediate, no handshake) */
  connect(): void {
    if (this.connected) {
      this.log('warn', 'Already connected');
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
    this.log('info', 'Connected');
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
      // Log all messages in debug mode
      if (this.debug) {
        this.log('recv', 'MESSAGE', {
          origin: event.origin,
          hasCommand: !!(event.data?.command || event.data?.type || event.data?.event),
          isBridgy: event.data?.__bridgy === true,
        });
      }

      // Validate origin
      if (!this.isValidOrigin(event.origin)) {
        this.log('recv', 'BLOCKED_ORIGIN', { origin: event.origin, allowed: this.origins });
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
        this.log('recv', 'RAW', { command, hasHandler: !!handlers, handlerCount: handlers?.size || 0 });
        handlers?.forEach(h => h(data, event));
        return;
      }

      // No command found - ignore message
      this.log('recv', 'NO_COMMAND', { data });
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
      this.log('info', 'Parent target window set', { origin: event.origin });
    }

    // Handle DATA packets (events)
    if (packet.type === 'DATA' && packet.command) {
      const handlers = this.eventHandlers.get(packet.command);
      this.log('recv', 'DATA', { command: packet.command, hasHandler: !!handlers, handlerCount: handlers?.size || 0 });
      handlers?.forEach(h => h(packet.payload, event));
    }

    // Handle REQUEST packets
    if (packet.type === 'REQUEST' && packet.command) {
      this.log('recv', 'REQUEST', { command: packet.command });
      this.handleRequest(packet, event);
    }

    // Handle RESPONSE packets
    if (packet.type === 'RESPONSE' && packet.replyTo) {
      this.log('recv', 'RESPONSE', { replyTo: packet.replyTo });
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
      this.log('error', 'Request packet missing ID');
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
      this.log('error', 'No target window');
      return;
    }

    this.log('send', packet.type || 'PACKET', { command: packet.command });
    this.targetWindow.postMessage(packet, this.targetOrigin || '*');
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Send fire-and-forget event */
  send<T>(command: string, payload?: T): void {
    this.sendPacket({
      __bridgy: true,
      type: 'DATA',
      id: makeId('data'),
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
    this.log('info', 'Handler registered', { command, type: 'event' });
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
        this.log('error', 'REQUEST_TIMEOUT', { command, timeout, id });
        reject(new Error(`Timeout: ${command} (${timeout}ms)`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.log('send', 'REQUEST', { command, id, timeout });
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
    this.log('info', 'Handler registered', { command, type: 'request' });
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
    this.log('info', 'Destroyed');
  }

  // ===========================================================================
  // LOGGING
  // ===========================================================================

  private log(direction: string, type: string, data?: Record<string, unknown>): void {
    if (!this.debug && direction !== 'error' && direction !== 'warn' && direction !== 'info') {
      return;
    }

    const arrow = direction === 'send' ? '→' : direction === 'recv' ? '←' : '';
    const prefix = `[BridgyLite]:${this.role}`;
    const message = arrow ? `${prefix} ${arrow} ${type}` : `${prefix} ${type}`;

    if (data && Object.keys(data).length > 0) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}
