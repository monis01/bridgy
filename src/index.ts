// =============================================================================
// BRIDGY - Main Entry Point
// =============================================================================

// Legacy exports (to be deprecated)
export { Bridger } from './bridger';

// New type exports
export type {
  BridgeMode,
  ConnectionState,
  BaseBridgeConfig,
  HostConfig,
  GuestConfig,
  BridgeAPI,
  EventHandler,
  RequestHandler,
  ReadyCallback,
  BridgePacket,
  DataPacket,
  RequestPacket,
  ResponsePacket,
} from './types';

// Type guard
export { isBridgePacket } from './types';

// Host class (parent window)
export { Host } from './host';

// Guest class (child iframe)
export { Guest } from './guest';

// Constants
export { PACKET_TYPES, BRIDGE_MODES, DEFAULTS } from './constants';
