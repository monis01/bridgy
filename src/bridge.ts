// =============================================================================
// BRIDGY - Single Bridge Class
// =============================================================================

import type {
  BridgeMode,
  ConnectionState,
  BridgePacket,
  EventHandler,
  RequestHandler,
  BridgeAPI,
} from './types';
import { isBridgePacket } from './types';
import { createLogger, type Logger } from './logger';
import { makeId, isOriginAllowed } from './utils';
import { DEFAULTS } from './constants';

// =============================================================================
// CONFIG
// =============================================================================

export interface BridgyConfig {
  /** Role: 'parent' (has iframe) or 'child' (inside iframe) */
  role: 'parent' | 'child';
  /** Allowed origins (parent) or target origin (child) */
  origins: string[];
  /** Communication mode */
  mode?: BridgeMode;
  /** Enable debug logging */
  debug?: boolean;
  /** Handshake timeout in ms */
  timeout?: number;
}

// =============================================================================
// BRIDGY CLASS
// =============================================================================

export class Bridgy implements BridgeAPI {
  private readonly role: 'parent' | 'child';
  private readonly origins: string[];
  private readonly mode: BridgeMode;
  private readonly timeout: number;
  private readonly logger: Logger;

  private state: ConnectionState = 'disconnected';
  private targetWindow: Window | null = null;
  private targetOrigin: string | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly pendingRequests = new Map<string, { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }>();

  // Queue for messages sent before connection
  private readonly messageQueue: BridgePacket[] = [];

  // Ready promise
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;

  constructor(config: BridgyConfig) {
    this.role = config.role;
    this.origins = config.origins;
    this.mode = (config.mode ?? DEFAULTS.MODE) as BridgeMode;
    this.timeout = config.timeout ?? DEFAULTS.TIMEOUT;
    this.logger = createLogger(config.role, config.debug ?? DEFAULTS.DEBUG);

    this.readyPromise = new Promise((res, rej) => {
      this.readyResolve = res;
      this.readyReject = rej;
    });

    this.connect();
  }

  // ===========================================================================
  // CONNECTION
  // ===========================================================================

  private connect() {
    if (this.role === 'child') {
      const parent = window.parent;
      if (!parent || parent === window) {
        this.readyReject(new Error('No parent window - must run in iframe'));
        return;
      }
      this.targetWindow = parent;
      this.initiateHandshake();
    } else {
      this.waitForHandshake();
    }
  }

  // Child initiates: SYN → wait for SYN_ACK → send ACK
  private initiateHandshake() {
    this.state = 'connecting';
    const targetOrigin = this.origins[0] || '*';
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
      if (!isBridgePacket(event.data)) return;

      if (event.data.type === 'SYN_ACK') {
        this.logger.log('recv', 'SYN_ACK', {});

        // Send ACK
        this.targetOrigin = event.origin;
        this.sendRaw({ __bridgy: true, type: 'ACK', id: makeId('ack'), timestamp: Date.now() });
        this.logger.log('send', 'ACK', {});

        // Connected
        window.removeEventListener('message', handler);
        clearTimeout(timeoutId);
        this.onConnected();
      }
    };

    window.addEventListener('message', handler);

    // Send SYN
    this.logger.log('send', 'SYN', {});
    this.targetWindow!.postMessage(
      { __bridgy: true, type: 'SYN', id: makeId('syn'), timestamp: Date.now() },
      targetOrigin
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      this.state = 'disconnected';
      this.readyReject(new Error('Handshake timeout'));
    }, this.timeout);
  }

  // Parent waits: wait for SYN → send SYN_ACK → wait for ACK
  private waitForHandshake() {
    this.state = 'connecting';
    this.logger.info('Waiting for child...');
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (!isOriginAllowed(event.origin, this.origins)) return;
      if (!isBridgePacket(event.data)) return;

      const packet = event.data;

      if (packet.type === 'SYN') {
        this.logger.log('recv', 'SYN', { origin: event.origin });
        this.targetWindow = event.source as Window;
        this.targetOrigin = event.origin;

        // Send SYN_ACK
        this.sendRaw({ __bridgy: true, type: 'SYN_ACK', id: makeId('sack'), timestamp: Date.now() });
        this.logger.log('send', 'SYN_ACK', {});
      }

      if (packet.type === 'ACK' && this.targetWindow) {
        this.logger.log('recv', 'ACK', {});
        window.removeEventListener('message', handler);
        clearTimeout(timeoutId);
        this.onConnected();
      }
    };

    window.addEventListener('message', handler);

    timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      this.state = 'disconnected';
      this.readyReject(new Error('Handshake timeout'));
    }, this.timeout);
  }

  private onConnected() {
    this.state = 'connected';
    this.logger.info('Connected');
    this.listen();
    this.flushQueue();
    this.readyResolve();
  }

  private listen() {
    this.messageHandler = (event: MessageEvent) => {
      if (!this.isValidOrigin(event.origin)) return;
      if (!isBridgePacket(event.data)) return;
      this.handlePacket(event.data, event);
    };
    window.addEventListener('message', this.messageHandler);
  }

  private isValidOrigin(origin: string): boolean {
    if (this.role === 'parent') {
      return isOriginAllowed(origin, this.origins);
    }
    return this.origins[0] === '*' || this.origins.includes(origin);
  }

  // ===========================================================================
  // MESSAGE HANDLING
  // ===========================================================================

  private handlePacket(packet: BridgePacket, event: MessageEvent) {
    if (packet.type === 'DATA' && this.canReceive()) {
      this.logger.log('recv', 'DATA', { command: packet.command });
      this.eventHandlers.get(packet.command!)?.forEach(h => h(packet.payload, event));
    }

    if (packet.type === 'REQUEST' && this.canReceive()) {
      this.logger.log('recv', 'REQUEST', { command: packet.command });
      this.handleRequest(packet, event);
    }

    if (packet.type === 'RESPONSE') {
      this.logger.log('recv', 'RESPONSE', { replyTo: packet.replyTo });
      const pending = this.pendingRequests.get(packet.replyTo!);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(packet.replyTo!);
        packet.error ? pending.reject(new Error(packet.error)) : pending.resolve(packet.payload);
      }
    }
  }

  private async handleRequest(packet: BridgePacket, event: MessageEvent) {
    const handler = this.requestHandlers.get(packet.command!);
    const response: BridgePacket = {
      __bridgy: true, type: 'RESPONSE', id: makeId('res'), timestamp: Date.now(), replyTo: packet.id
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

  private sendRaw(packet: BridgePacket) {
    if (!this.targetWindow) return;
    this.targetWindow.postMessage(packet, this.targetOrigin || '*');
  }

  private sendPacket(packet: BridgePacket) {
    if (this.state !== 'connected') {
      this.messageQueue.push(packet);
      return;
    }
    this.logger.log('send', packet.type, { command: packet.command });
    this.sendRaw(packet);
  }

  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const packet = this.messageQueue.shift()!;
      this.logger.log('send', packet.type, { command: packet.command, queued: true });
      this.sendRaw(packet);
    }
  }

  private canSend() { return this.mode === 'duplex' || this.mode === 'push'; }
  private canReceive() { return this.mode === 'duplex' || this.mode === 'pull'; }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /** Promise that resolves when connected. Use .catch() for errors. */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  /** Callback style (non-blocking) */
  onReady(callback: () => void) {
    this.readyPromise.then(callback).catch(() => {});
  }

  isConnected() { return this.state === 'connected'; }
  getState() { return this.state; }

  /** Fire-and-forget. Queued if not connected yet. */
  send<T>(command: string, payload?: T) {
    if (!this.canSend()) return;
    this.sendPacket({ __bridgy: true, type: 'DATA', id: makeId('d'), timestamp: Date.now(), command, payload });
  }

  /** Subscribe to events */
  on<T>(command: string, handler: EventHandler<T>) {
    if (!this.canReceive()) return;
    const set = this.eventHandlers.get(command) ?? new Set();
    set.add(handler as EventHandler);
    this.eventHandlers.set(command, set);
  }

  /** Unsubscribe */
  off(command?: string, handler?: EventHandler) {
    if (!command) { this.eventHandlers.clear(); return; }
    if (!handler) { this.eventHandlers.delete(command); return; }
    this.eventHandlers.get(command)?.delete(handler);
  }

  /** Request-response. Returns promise. */
  request<TReq, TRes>(command: string, payload?: TReq, timeout?: number): Promise<TRes> {
    return new Promise((resolve, reject) => {
      if (!this.canSend()) { reject(new Error('Mode does not allow sending')); return; }

      const id = makeId('req');
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout: ${command}`));
      }, timeout ?? this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.sendPacket({ __bridgy: true, type: 'REQUEST', id, timestamp: Date.now(), command, payload });
    });
  }

  /** Register request handler */
  handle<TReq, TRes>(command: string, handler: RequestHandler<TReq, TRes>) {
    if (!this.canReceive()) return;
    this.requestHandlers.set(command, handler as RequestHandler);
  }

  removeHandler(command: string) { this.requestHandlers.delete(command); }

  enableDebug() { this.logger.enable(); }
  disableDebug() { this.logger.disable(); }

  destroy() {
    if (this.messageHandler) window.removeEventListener('message', this.messageHandler);
    this.eventHandlers.clear();
    this.requestHandlers.clear();
    this.pendingRequests.forEach(p => { clearTimeout(p.timer); p.reject(new Error('Destroyed')); });
    this.pendingRequests.clear();
    this.messageQueue.length = 0;
    this.targetWindow = null;
    this.state = 'disconnected';
    this.logger.info('Destroyed');
  }
}
