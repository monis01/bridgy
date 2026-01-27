// =============================================================================
// BRIDGY CHILD
// =============================================================================

import type {
  ChildConfig,
  BridgeAPI,
  BridgeMode,
  ConnectionState,
  BridgePacket,
  EventHandler,
  RequestHandler,
} from './types';
import { isBridgePacket } from './types';
import { childHandshake } from './handshake';
import { createLogger, type Logger } from './logger';
import { makeId } from './utils';
import { DEFAULTS } from './constants';

export class Child implements BridgeAPI {
  private state: ConnectionState = 'disconnected';
  private readonly mode: BridgeMode;
  private readonly timeout: number;
  private readonly targetOrigin: string;
  private readonly logger: Logger;

  private parentWindow: Window | null = null;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly pendingRequests = new Map<string, { resolve: Function; reject: Function; timer: ReturnType<typeof setTimeout> }>();

  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;
  private readyCallbacks: (() => void)[] = [];

  constructor(config: ChildConfig) {
    this.targetOrigin = config.targetOrigin;
    this.mode = (config.mode ?? DEFAULTS.MODE) as BridgeMode;
    this.timeout = config.timeout ?? DEFAULTS.TIMEOUT;
    this.logger = createLogger('Child', config.debug ?? DEFAULTS.DEBUG);

    this.parentWindow = window.parent !== window ? window.parent : null;

    this.readyPromise = new Promise((res, rej) => {
      this.readyResolve = res;
      this.readyReject = rej;
    });

    this.connect();
  }

  private async connect() {
    if (!this.parentWindow) {
      this.readyReject(new Error('No parent window - must run in iframe'));
      return;
    }

    this.state = 'connecting';
    try {
      await childHandshake(this.targetOrigin, this.timeout, this.logger);
      this.state = 'connected';
      this.listen();
      this.readyResolve();
      this.readyCallbacks.forEach(cb => cb());
    } catch (err) {
      this.state = 'disconnected';
      this.readyReject(err as Error);
    }
  }

  private listen() {
    this.messageHandler = (event: MessageEvent) => {
      if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
      if (!isBridgePacket(event.data)) return;
      this.handlePacket(event.data, event);
    };
    window.addEventListener('message', this.messageHandler);
  }

  private handlePacket(packet: BridgePacket, event: MessageEvent) {
    if (packet.type === 'DATA' && this.canReceive()) {
      this.logger.log('recv', 'DATA', { command: packet.command });
      const handlers = this.eventHandlers.get(packet.command!);
      handlers?.forEach(h => h(packet.payload, event));
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

  private sendPacket(packet: BridgePacket) {
    if (!this.parentWindow) return;
    this.logger.log('send', packet.type, { command: packet.command });
    this.parentWindow.postMessage(packet, this.targetOrigin);
  }

  private canSend() { return this.mode === 'duplex' || this.mode === 'push'; }
  private canReceive() { return this.mode === 'duplex' || this.mode === 'pull'; }

  // === Public API ===

  ready() { return this.readyPromise; }
  onReady(cb: () => void) { this.state === 'connected' ? cb() : this.readyCallbacks.push(cb); }
  isConnected() { return this.state === 'connected'; }
  getState() { return this.state; }

  send<T>(command: string, payload?: T) {
    if (this.state !== 'connected' || !this.canSend()) return;
    this.sendPacket({ __bridgy: true, type: 'DATA', id: makeId('d'), timestamp: Date.now(), command, payload });
  }

  on<T>(command: string, handler: EventHandler<T>) {
    if (!this.canReceive()) return;
    const set = this.eventHandlers.get(command) ?? new Set();
    set.add(handler as EventHandler);
    this.eventHandlers.set(command, set);
  }

  off(command?: string, handler?: EventHandler) {
    if (!command) { this.eventHandlers.clear(); return; }
    if (!handler) { this.eventHandlers.delete(command); return; }
    this.eventHandlers.get(command)?.delete(handler);
  }

  request<TReq, TRes>(command: string, payload?: TReq, timeout?: number): Promise<TRes> {
    return new Promise((resolve, reject) => {
      if (this.state !== 'connected' || !this.canSend()) {
        reject(new Error('Not connected')); return;
      }
      const id = makeId('req');
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout: ${command}`));
      }, timeout ?? this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.sendPacket({ __bridgy: true, type: 'REQUEST', id, timestamp: Date.now(), command, payload });
    });
  }

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
    this.parentWindow = null;
    this.state = 'disconnected';
    this.logger.info('Destroyed');
  }
}
