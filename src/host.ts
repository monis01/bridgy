// =============================================================================
// HOST (Parent Window)
// =============================================================================
// The Host is the parent window that contains the iframe.
// It waits for a Guest (child) to initiate the handshake.
// =============================================================================

import type {
  HostConfig,
  BridgeAPI,
  BridgeMode,
  ConnectionState,
  EventHandler,
  RequestHandler,
  ReadyCallback,
  Logger,
  PendingRequest,
  DataPacket,
  RequestPacket,
  ResponsePacket,
  BridgePacket,
} from './types';
import { isBridgePacket } from './types';
import { createHostHandshake, type HostHandshakeController } from './handshake';
import { createLogger } from './logger';
import { makeId, isOriginAllowed } from './utils';

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_MODE: BridgeMode = 'duplex';

// =============================================================================
// HOST CLASS
// =============================================================================

export class Host implements BridgeAPI {
  // Configuration
  private readonly allowedOrigins: string[];
  private readonly mode: BridgeMode;
  private readonly timeout: number;

  // State
  private connectionState: ConnectionState = 'disconnected';
  private destroyed = false;

  // Communication
  private guestWindow: Window | null = null;
  private guestOrigin: string | null = null;

  // Handlers
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly pendingRequests = new Map<string, PendingRequest>();

  // Ready callbacks
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private readonly readyCallbacks: ReadyCallback[] = [];

  // Handshake
  private handshakeController: HostHandshakeController | null = null;

  // Logging
  private readonly logger: Logger;

  // Message listener reference (for cleanup)
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(config: HostConfig) {
    this.allowedOrigins = config.allowedOrigins;
    this.mode = config.mode ?? DEFAULT_MODE;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.logger = createLogger('Host', config.debug ?? false);

    // Setup ready promise
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    // Start handshake
    this.startHandshake();
  }

  // ===========================================================================
  // HANDSHAKE
  // ===========================================================================

  private startHandshake(): void {
    this.connectionState = 'connecting';

    this.handshakeController = createHostHandshake({
      allowedOrigins: this.allowedOrigins,
      timeout: this.timeout,
      logger: this.logger,
      callbacks: {
        onConnected: () => this.onHandshakeComplete(),
        onError: (error) => this.onHandshakeError(error),
      },
    });

    this.handshakeController.start();
  }

  private onHandshakeComplete(): void {
    this.connectionState = 'connected';
    this.guestOrigin = this.handshakeController?.getGuestOrigin() ?? null;
    this.guestWindow = this.handshakeController?.getGuestWindow() ?? null;

    // Start listening for messages
    this.startMessageListener();

    // Resolve ready promise
    this.readyResolve();

    // Call ready callbacks
    this.readyCallbacks.forEach((cb) => cb());
  }

  private onHandshakeError(error: Error): void {
    this.connectionState = 'disconnected';
    this.logger.error('Handshake failed', { message: error.message });
    this.readyReject(error);
  }

  // ===========================================================================
  // MESSAGE LISTENER
  // ===========================================================================

  private startMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      this.handleIncomingMessage(event);
    };
    window.addEventListener('message', this.messageListener);
  }

  private handleIncomingMessage(event: MessageEvent): void {
    // Validate origin
    if (!isOriginAllowed(event.origin, this.allowedOrigins)) {
      return;
    }

    // Validate packet
    if (!isBridgePacket(event.data)) {
      return;
    }

    const packet = event.data as BridgePacket;

    // Store guest window reference if not set
    if (!this.guestWindow && event.source) {
      this.guestWindow = event.source as Window;
    }

    // Route based on packet type
    switch (packet.type) {
      case 'DATA':
        this.handleDataPacket(packet as DataPacket, event);
        break;
      case 'REQUEST':
        this.handleRequestPacket(packet as RequestPacket, event);
        break;
      case 'RESPONSE':
        this.handleResponsePacket(packet as ResponsePacket);
        break;
    }
  }

  private handleDataPacket(packet: DataPacket, event: MessageEvent): void {
    if (!this.canReceive()) return;

    this.logger.log('recv', 'DATA', { command: packet.command, payload: packet.payload });

    const handlers = this.eventHandlers.get(packet.command);
    if (handlers) {
      handlers.forEach((handler) => handler(packet.payload, event));
    }
  }

  private async handleRequestPacket(packet: RequestPacket, event: MessageEvent): Promise<void> {
    if (!this.canReceive()) return;

    this.logger.log('recv', 'REQUEST', { command: packet.command, payload: packet.payload });

    const handler = this.requestHandlers.get(packet.command);

    let response: ResponsePacket;

    if (!handler) {
      response = this.createResponsePacket(packet.id, undefined, `No handler for command: ${packet.command}`);
    } else {
      try {
        const result = await handler(packet.payload, event);
        response = this.createResponsePacket(packet.id, result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        response = this.createResponsePacket(packet.id, undefined, errorMsg);
      }
    }

    this.sendPacket(response);
  }

  private handleResponsePacket(packet: ResponsePacket): void {
    const pending = this.pendingRequests.get(packet.replyTo);
    if (!pending) return;

    this.logger.log('recv', 'RESPONSE', { replyTo: packet.replyTo, payload: packet.payload, error: packet.error });

    // Cleanup
    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(packet.replyTo);

    // Resolve or reject
    if (packet.error) {
      pending.reject(new Error(packet.error));
    } else {
      pending.resolve(packet.payload);
    }
  }

  // ===========================================================================
  // PACKET CREATION & SENDING
  // ===========================================================================

  private createDataPacket(command: string, payload?: unknown): DataPacket {
    return {
      __bridgy: true,
      type: 'DATA',
      id: makeId('d'),
      timestamp: Date.now(),
      command,
      payload,
    };
  }

  private createRequestPacket(command: string, payload?: unknown): RequestPacket {
    return {
      __bridgy: true,
      type: 'REQUEST',
      id: makeId('req'),
      timestamp: Date.now(),
      command,
      payload,
    };
  }

  private createResponsePacket(replyTo: string, payload?: unknown, error?: string): ResponsePacket {
    const packet: ResponsePacket = {
      __bridgy: true,
      type: 'RESPONSE',
      id: makeId('res'),
      timestamp: Date.now(),
      replyTo,
      payload,
    };
    if (error) {
      packet.error = error;
    }
    return packet;
  }

  private sendPacket(packet: BridgePacket): void {
    if (!this.guestWindow || !this.guestOrigin) {
      this.logger.warn('Cannot send: no guest connected');
      return;
    }

    this.logger.log('send', packet.type, packet);
    this.guestWindow.postMessage(packet, this.guestOrigin);
  }

  // ===========================================================================
  // MODE CHECKS
  // ===========================================================================

  private canSend(): boolean {
    return this.mode === 'duplex' || this.mode === 'push';
  }

  private canReceive(): boolean {
    return this.mode === 'duplex' || this.mode === 'pull';
  }

  private assertConnected(): void {
    if (this.destroyed) {
      throw new Error('Bridge has been destroyed');
    }
    if (this.connectionState !== 'connected') {
      throw new Error('Bridge is not connected');
    }
  }

  private assertCanSend(): void {
    this.assertConnected();
    if (!this.canSend()) {
      throw new Error('Cannot send: bridge mode does not allow sending');
    }
  }

  private assertCanReceive(): void {
    if (this.destroyed) {
      throw new Error('Bridge has been destroyed');
    }
    if (!this.canReceive()) {
      throw new Error('Cannot receive: bridge mode does not allow receiving');
    }
  }

  // ===========================================================================
  // PUBLIC API: Connection State
  // ===========================================================================

  ready(): Promise<void> {
    return this.readyPromise;
  }

  onReady(callback: ReadyCallback): void {
    if (this.connectionState === 'connected') {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  // ===========================================================================
  // PUBLIC API: Fire-and-Forget
  // ===========================================================================

  send<T = unknown>(command: string, payload?: T): void {
    this.assertCanSend();

    const packet = this.createDataPacket(command, payload);
    this.sendPacket(packet);
  }

  // ===========================================================================
  // PUBLIC API: Event Subscription
  // ===========================================================================

  on<T = unknown>(command: string, handler: EventHandler<T>): void {
    this.assertCanReceive();

    const handlers = this.eventHandlers.get(command) ?? new Set();
    handlers.add(handler as EventHandler);
    this.eventHandlers.set(command, handlers);
  }

  off(command?: string, handler?: EventHandler): void {
    if (!command) {
      this.eventHandlers.clear();
      return;
    }

    if (!handler) {
      this.eventHandlers.delete(command);
      return;
    }

    const handlers = this.eventHandlers.get(command);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(command);
      }
    }
  }

  // ===========================================================================
  // PUBLIC API: Request-Response
  // ===========================================================================

  request<TReq = unknown, TRes = unknown>(
    command: string,
    payload?: TReq,
    timeout?: number
  ): Promise<TRes> {
    this.assertCanSend();

    return new Promise((resolve, reject) => {
      const packet = this.createRequestPacket(command, payload);
      const requestTimeout = timeout ?? this.timeout;

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(packet.id);
        reject(new Error(`Request timeout: ${command}`));
      }, requestTimeout);

      this.pendingRequests.set(packet.id, {
        id: packet.id,
        command,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
        timestamp: Date.now(),
      });

      this.sendPacket(packet);
    });
  }

  handle<TReq = unknown, TRes = unknown>(
    command: string,
    handler: RequestHandler<TReq, TRes>
  ): void {
    this.assertCanReceive();
    this.requestHandlers.set(command, handler as RequestHandler);
  }

  removeHandler(command: string): void {
    this.requestHandlers.delete(command);
  }

  // ===========================================================================
  // PUBLIC API: Debug
  // ===========================================================================

  enableDebug(): void {
    this.logger.enable();
  }

  disableDebug(): void {
    this.logger.disable();
  }

  isDebugEnabled(): boolean {
    return this.logger.isEnabled();
  }

  // ===========================================================================
  // PUBLIC API: Lifecycle
  // ===========================================================================

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.connectionState = 'disconnected';

    // Stop handshake if in progress
    this.handshakeController?.stop();

    // Remove message listener
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    // Clear all handlers
    this.eventHandlers.clear();
    this.requestHandlers.clear();

    // Reject pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Bridge destroyed'));
    });
    this.pendingRequests.clear();

    // Clear references
    this.guestWindow = null;
    this.guestOrigin = null;

    this.logger.info('Bridge destroyed');
  }
}
