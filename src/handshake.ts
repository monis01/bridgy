// =============================================================================
// HANDSHAKE MODULE
// =============================================================================
// Implements the 3-way handshake: SYN → SYN_ACK → ACK
// Guest initiates, Host responds
// =============================================================================

import type {
  SynPacket,
  SynAckPacket,
  AckPacket,
  BridgePacket,
  Logger,
} from './types';
import { isBridgePacket } from './types';
import { makeId, isOriginAllowed } from './utils';

// =============================================================================
// PACKET FACTORIES
// =============================================================================

/**
 * Create a SYN packet (Guest → Host)
 */
export function createSynPacket(): SynPacket {
  return {
    __bridgy: true,
    type: 'SYN',
    id: makeId('syn'),
    timestamp: Date.now(),
  };
}

/**
 * Create a SYN_ACK packet (Host → Guest)
 */
export function createSynAckPacket(): SynAckPacket {
  return {
    __bridgy: true,
    type: 'SYN_ACK',
    id: makeId('sack'),
    timestamp: Date.now(),
  };
}

/**
 * Create an ACK packet (Guest → Host)
 */
export function createAckPacket(): AckPacket {
  return {
    __bridgy: true,
    type: 'ACK',
    id: makeId('ack'),
    timestamp: Date.now(),
  };
}

// =============================================================================
// HANDSHAKE HANDLERS
// =============================================================================

export interface HandshakeCallbacks {
  onConnected: () => void;
  onError: (error: Error) => void;
}

export interface HostHandshakeConfig {
  allowedOrigins: string[];
  timeout: number;
  logger?: Logger;
  callbacks: HandshakeCallbacks;
}

export interface GuestHandshakeConfig {
  targetOrigin: string;
  timeout: number;
  logger?: Logger;
  callbacks: HandshakeCallbacks;
}

// =============================================================================
// HOST HANDSHAKE (Parent window - waits for Guest)
// =============================================================================

export interface HostHandshakeController {
  /** Start listening for SYN from Guest */
  start(): void;
  /** Stop listening and cleanup */
  stop(): void;
  /** Check if handshake is complete */
  isComplete(): boolean;
  /** Get the connected guest's origin */
  getGuestOrigin(): string | null;
  /** Get the connected guest's window reference */
  getGuestWindow(): Window | null;
}

/**
 * Create a handshake controller for the Host (parent window)
 * Host waits for Guest to send SYN, then responds with SYN_ACK
 */
export function createHostHandshake(config: HostHandshakeConfig): HostHandshakeController {
  const { allowedOrigins, timeout, logger, callbacks } = config;

  let messageHandler: ((event: MessageEvent) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let complete = false;
  let guestOrigin: string | null = null;
  let guestWindow: Window | null = null;

  function cleanup() {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function handleMessage(event: MessageEvent) {
    // Validate origin
    if (!isOriginAllowed(event.origin, allowedOrigins)) {
      logger?.warn('Rejected message from disallowed origin', { origin: event.origin });
      return;
    }

    // Validate packet
    if (!isBridgePacket(event.data)) {
      return;
    }

    const packet = event.data as BridgePacket;

    // Handle SYN from Guest
    if (packet.type === 'SYN' && !complete) {
      logger?.log('recv', 'SYN', { id: packet.id, origin: event.origin });

      guestOrigin = event.origin;
      guestWindow = event.source as Window;

      // Send SYN_ACK
      const synAck = createSynAckPacket();
      logger?.log('send', 'SYN_ACK', { id: synAck.id });

      guestWindow.postMessage(synAck, guestOrigin);
    }

    // Handle ACK from Guest (handshake complete)
    if (packet.type === 'ACK' && !complete && guestOrigin) {
      logger?.log('recv', 'ACK', { id: packet.id });
      logger?.info('Handshake complete');

      complete = true;
      cleanup();
      callbacks.onConnected();
    }
  }

  return {
    start() {
      if (messageHandler) return; // Already started

      logger?.info('Host waiting for connection...');

      messageHandler = handleMessage;
      window.addEventListener('message', messageHandler);

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!complete) {
          cleanup();
          callbacks.onError(new Error('Handshake timeout: No guest connected'));
        }
      }, timeout);
    },

    stop() {
      cleanup();
    },

    isComplete() {
      return complete;
    },

    getGuestOrigin() {
      return guestOrigin;
    },

    getGuestWindow() {
      return guestWindow;
    },
  };
}

// =============================================================================
// GUEST HANDSHAKE (Child iframe - initiates connection)
// =============================================================================

export interface GuestHandshakeController {
  /** Initiate handshake by sending SYN */
  start(): void;
  /** Stop and cleanup */
  stop(): void;
  /** Check if handshake is complete */
  isComplete(): boolean;
}

/**
 * Create a handshake controller for the Guest (child iframe)
 * Guest sends SYN to Host, waits for SYN_ACK, then sends ACK
 */
export function createGuestHandshake(config: GuestHandshakeConfig): GuestHandshakeController {
  const { targetOrigin, timeout, logger, callbacks } = config;

  let messageHandler: ((event: MessageEvent) => void) | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let complete = false;
  let synSent = false;

  function cleanup() {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler);
      messageHandler = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function getParentWindow(): Window | null {
    if (window.parent && window.parent !== window) {
      return window.parent;
    }
    return null;
  }

  function handleMessage(event: MessageEvent) {
    // Validate origin (if not wildcard)
    if (targetOrigin !== '*' && event.origin !== targetOrigin) {
      return;
    }

    // Validate packet
    if (!isBridgePacket(event.data)) {
      return;
    }

    const packet = event.data as BridgePacket;

    // Handle SYN_ACK from Host
    if (packet.type === 'SYN_ACK' && synSent && !complete) {
      logger?.log('recv', 'SYN_ACK', { id: packet.id });

      // Send ACK to complete handshake
      const ack = createAckPacket();
      logger?.log('send', 'ACK', { id: ack.id });

      const parent = getParentWindow();
      if (parent) {
        parent.postMessage(ack, targetOrigin);
      }

      logger?.info('Handshake complete');
      complete = true;
      cleanup();
      callbacks.onConnected();
    }
  }

  return {
    start() {
      const parent = getParentWindow();
      if (!parent) {
        callbacks.onError(new Error('No parent window found. Guest must be in an iframe'));
        return;
      }

      if (messageHandler) return; // Already started

      logger?.info('Guest initiating connection...');

      // Listen for SYN_ACK
      messageHandler = handleMessage;
      window.addEventListener('message', messageHandler);

      // Send SYN
      const syn = createSynPacket();
      logger?.log('send', 'SYN', { id: syn.id });

      parent.postMessage(syn, targetOrigin);
      synSent = true;

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!complete) {
          cleanup();
          callbacks.onError(new Error('Handshake timeout: No response from host'));
        }
      }, timeout);
    },

    stop() {
      cleanup();
    },

    isComplete() {
      return complete;
    },
  };
}
