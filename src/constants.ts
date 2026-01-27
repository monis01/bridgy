// =============================================================================
// BRIDGY CONSTANTS
// =============================================================================

import type { PacketType, BridgeMode } from './types';

/**
 * Packet types for the bridge protocol
 */
export const PACKET_TYPES: Record<PacketType, PacketType> = {
  SYN: 'SYN',
  SYN_ACK: 'SYN_ACK',
  ACK: 'ACK',
  DATA: 'DATA',
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',
  ERROR: 'ERROR',
} as const;

/**
 * Bridge modes
 */
export const BRIDGE_MODES: Record<BridgeMode, BridgeMode> = {
  duplex: 'duplex',
  push: 'push',
  pull: 'pull',
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  TIMEOUT: 10000,
  MODE: 'duplex' as BridgeMode,
  DEBUG: false,
} as const;

/**
 * Error messages
 */
export const ERRORS = {
  NOT_CONNECTED: 'Bridge is not connected',
  ALREADY_DESTROYED: 'Bridge has been destroyed',
  HANDSHAKE_TIMEOUT: 'Handshake timeout',
  REQUEST_TIMEOUT: 'Request timeout',
  INVALID_MODE_SEND: 'Cannot send: bridge mode does not allow sending',
  INVALID_MODE_RECEIVE: 'Cannot receive: bridge mode does not allow receiving',
  NO_PARENT_WINDOW: 'No parent window found. Guest must be in an iframe',
  ORIGIN_NOT_ALLOWED: 'Origin not allowed',
  HANDLER_NOT_FOUND: 'No handler registered for command',
} as const;
