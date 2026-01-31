// =============================================================================
// BRIDGY TYPES
// =============================================================================

/** Communication mode */
export type BridgeMode = 'duplex' | 'push' | 'pull';

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/** Packet types */
export type PacketType = 'SYN' | 'SYN_ACK' | 'ACK' | 'DATA' | 'REQUEST' | 'RESPONSE';

/** Universal packet structure */
export interface BridgePacket {
  __bridgy: true;
  type: PacketType;
  id: string;
  timestamp: number;
  command?: string;
  payload?: unknown;
  replyTo?: string;
  error?: string;
}

/** Parent (Host) configuration */
export interface ParentConfig {
  allowedOrigins: string[];
  mode?: BridgeMode;
  debug?: boolean;
  timeout?: number;
}

/** Child (Guest) configuration */
export interface ChildConfig {
  targetOrigin: string;
  mode?: BridgeMode;
  debug?: boolean;
  timeout?: number;
}

/** Event handler */
export type EventHandler<T = unknown> = (payload: T, event: MessageEvent) => void;

/** Request handler */
export type RequestHandler<TReq = unknown, TRes = unknown> = (
  payload: TReq,
  event: MessageEvent
) => TRes | Promise<TRes>;

/** Request options */
export interface RequestOptions {
  /** Override default timeout (in ms) */
  timeout?: number;
}

/** Public API interface */
export interface BridgeAPI {
  connect(): Promise<void>;
  ready(): Promise<void>;
  onReady(callback: () => void): void;
  isConnected(): boolean;
  getState(): ConnectionState;
  send<T = unknown>(command: string, payload?: T): void;
  on<T = unknown>(command: string, handler: EventHandler<T>): void;
  off(command?: string, handler?: EventHandler): void;
  request<TReq = unknown, TRes = unknown>(command: string, payload?: TReq, options?: RequestOptions): Promise<TRes>;
  handle<TReq = unknown, TRes = unknown>(command: string, handler: RequestHandler<TReq, TRes>): void;
  removeHandler(command: string): void;
  enableDebug(): void;
  disableDebug(): void;
  destroy(): void;
}

/** Type guard for packets */
export function isBridgePacket(data: unknown): data is BridgePacket {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__bridgy' in data &&
    (data as BridgePacket).__bridgy === true
  );
}
