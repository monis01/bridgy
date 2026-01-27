// =============================================================================
// BRIDGY TYPE SYSTEM
// =============================================================================
// Loosely coupled interfaces that define contracts for the bridge implementation.
// These types are framework-agnostic and can be consumed by any TypeScript project.
// =============================================================================

// =============================================================================
// BRIDGE MODES
// =============================================================================

/**
 * Communication mode for the bridge
 * - 'duplex': Can send and receive messages (default)
 * - 'push': Can only send messages, ignores incoming
 * - 'pull': Can only receive messages, cannot send
 */
export type BridgeMode = 'duplex' | 'push' | 'pull';

// =============================================================================
// CONNECTION STATE
// =============================================================================

/**
 * Current state of the bridge connection
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Base configuration shared by both Host and Guest
 */
export interface BaseBridgeConfig {
  /** Communication mode (default: 'duplex') */
  mode?: BridgeMode;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Handshake timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Configuration for Host (parent window)
 * Host waits for Guest to initiate connection
 */
export interface HostConfig extends BaseBridgeConfig {
  /** List of allowed origins for security. Use ['*'] only in development */
  allowedOrigins: string[];
}

/**
 * Configuration for Guest (child iframe)
 * Guest initiates the connection handshake
 */
export interface GuestConfig extends BaseBridgeConfig {
  /** Target origin of the parent window. Use '*' only in development */
  targetOrigin: string;
}

// =============================================================================
// PACKET TYPES (Internal Protocol)
// =============================================================================

/**
 * All possible packet types in the bridge protocol
 */
export type PacketType =
  | 'SYN'       // Guest initiates handshake
  | 'SYN_ACK'   // Host acknowledges
  | 'ACK'       // Guest confirms connection
  | 'DATA'      // Fire-and-forget message
  | 'REQUEST'   // Request expecting response
  | 'RESPONSE'  // Response to a request
  | 'ERROR';    // Error response

/**
 * Base structure for all packets
 */
export interface BasePacket {
  /** Marker to identify Bridgy messages */
  __bridgy: true;
  /** Packet type */
  type: PacketType;
  /** Unique packet ID */
  id: string;
  /** Timestamp when packet was created */
  timestamp: number;
}

/**
 * SYN packet - Guest initiates handshake
 */
export interface SynPacket extends BasePacket {
  type: 'SYN';
}

/**
 * SYN_ACK packet - Host acknowledges handshake
 */
export interface SynAckPacket extends BasePacket {
  type: 'SYN_ACK';
}

/**
 * ACK packet - Guest confirms connection established
 */
export interface AckPacket extends BasePacket {
  type: 'ACK';
}

/**
 * DATA packet - Fire-and-forget message
 */
export interface DataPacket extends BasePacket {
  type: 'DATA';
  /** Command name */
  command: string;
  /** Optional payload data */
  payload?: unknown;
}

/**
 * REQUEST packet - Message expecting a response
 */
export interface RequestPacket extends BasePacket {
  type: 'REQUEST';
  /** Command name */
  command: string;
  /** Optional payload data */
  payload?: unknown;
}

/**
 * RESPONSE packet - Response to a REQUEST
 */
export interface ResponsePacket extends BasePacket {
  type: 'RESPONSE';
  /** ID of the REQUEST this responds to */
  replyTo: string;
  /** Response payload (on success) */
  payload?: unknown;
  /** Error message (on failure) */
  error?: string;
}

/**
 * ERROR packet - Error notification
 */
export interface ErrorPacket extends BasePacket {
  type: 'ERROR';
  /** Error message */
  error: string;
  /** Related packet ID if applicable */
  relatedTo?: string;
}

/**
 * Union of all packet types
 */
export type BridgePacket =
  | SynPacket
  | SynAckPacket
  | AckPacket
  | DataPacket
  | RequestPacket
  | ResponsePacket
  | ErrorPacket;

/**
 * Type guard to check if data is a valid BridgePacket
 */
export function isBridgePacket(data: unknown): data is BridgePacket {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__bridgy' in data &&
    (data as BasePacket).__bridgy === true &&
    'type' in data &&
    'id' in data
  );
}

// =============================================================================
// HANDLER TYPES
// =============================================================================

/**
 * Handler for event subscription (fire-and-forget messages)
 * @template T - Type of the payload
 */
export type EventHandler<T = unknown> = (
  payload: T,
  event: MessageEvent
) => void;

/**
 * Handler for request-response pattern
 * Can return sync value or Promise
 * @template TReq - Type of request payload
 * @template TRes - Type of response payload
 */
export type RequestHandler<TReq = unknown, TRes = unknown> = (
  payload: TReq,
  event: MessageEvent
) => TRes | Promise<TRes>;

/**
 * Callback for ready state
 */
export type ReadyCallback = () => void;

// =============================================================================
// PUBLIC API INTERFACE
// =============================================================================

/**
 * Public API exposed to users after bridge creation
 * This is the main interface users interact with
 */
export interface BridgeAPI {
  // ---------------------------------------------------------------------------
  // Connection State
  // ---------------------------------------------------------------------------

  /**
   * Returns a Promise that resolves when connection is established
   * @throws Error if connection fails or times out
   */
  ready(): Promise<void>;

  /**
   * Register a callback to be called when connection is established
   * @param callback - Function to call on ready
   */
  onReady(callback: ReadyCallback): void;

  /**
   * Check if bridge is currently connected
   * @returns true if connected
   */
  isConnected(): boolean;

  /**
   * Get current connection state
   */
  getState(): ConnectionState;

  // ---------------------------------------------------------------------------
  // Fire-and-Forget Messaging
  // ---------------------------------------------------------------------------

  /**
   * Send a fire-and-forget message
   * @param command - Command name
   * @param payload - Optional payload data
   * @throws Error if bridge is not connected or mode doesn't allow sending
   */
  send<T = unknown>(command: string, payload?: T): void;

  // ---------------------------------------------------------------------------
  // Event Subscription
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a command
   * @param command - Command name to listen for
   * @param handler - Handler function
   * @throws Error if mode doesn't allow receiving
   */
  on<T = unknown>(command: string, handler: EventHandler<T>): void;

  /**
   * Unsubscribe from a command
   * @param command - Command name (if omitted, removes all handlers)
   * @param handler - Specific handler to remove (if omitted, removes all for command)
   */
  off(command?: string, handler?: EventHandler): void;

  // ---------------------------------------------------------------------------
  // Request-Response
  // ---------------------------------------------------------------------------

  /**
   * Send a request and wait for response
   * @param command - Command name
   * @param payload - Optional payload data
   * @param timeout - Optional timeout in ms (default: config timeout)
   * @returns Promise resolving to response payload
   * @throws Error on timeout or if response contains error
   */
  request<TReq = unknown, TRes = unknown>(
    command: string,
    payload?: TReq,
    timeout?: number
  ): Promise<TRes>;

  /**
   * Register a handler for incoming requests
   * Handler can return value directly or return Promise
   * @param command - Command name to handle
   * @param handler - Handler function
   */
  handle<TReq = unknown, TRes = unknown>(
    command: string,
    handler: RequestHandler<TReq, TRes>
  ): void;

  /**
   * Unregister a request handler
   * @param command - Command name
   */
  removeHandler(command: string): void;

  // ---------------------------------------------------------------------------
  // Debug
  // ---------------------------------------------------------------------------

  /**
   * Enable debug logging to console
   */
  enableDebug(): void;

  /**
   * Disable debug logging
   */
  disableDebug(): void;

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Destroy the bridge, cleanup all listeners and state
   * After calling destroy(), the bridge instance cannot be reused
   */
  destroy(): void;
}

// =============================================================================
// INTERNAL INTERFACES (for implementation)
// =============================================================================

/**
 * Logger interface - allows swapping logging implementation
 */
export interface Logger {
  /** Log a message send/receive event */
  log(direction: 'send' | 'recv', packetType: string, data?: unknown): void;
  /** Log an info message */
  info(message: string, data?: unknown): void;
  /** Log a warning */
  warn(message: string, data?: unknown): void;
  /** Log an error */
  error(message: string, data?: unknown): void;
  /** Enable logging */
  enable(): void;
  /** Disable logging */
  disable(): void;
  /** Check if enabled */
  isEnabled(): boolean;
}

/**
 * Pending request - tracks outgoing requests waiting for response
 */
export interface PendingRequest {
  /** Request ID */
  id: string;
  /** Command name */
  command: string;
  /** Resolve function */
  resolve: (value: unknown) => void;
  /** Reject function */
  reject: (error: Error) => void;
  /** Timeout timer ID */
  timeoutId: ReturnType<typeof setTimeout>;
  /** Timestamp when request was sent */
  timestamp: number;
}

/**
 * Internal bridge state
 */
export interface BridgeState {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Debug mode flag */
  debug: boolean;
  /** Bridge mode */
  mode: BridgeMode;
  /** Whether bridge has been destroyed */
  destroyed: boolean;
}

// =============================================================================
// FACTORY TYPES
// =============================================================================

/**
 * Result of Bridger.host() or Bridger.connect()
 * Returns the public API for the bridge
 */
export type BridgeInstance = BridgeAPI;
