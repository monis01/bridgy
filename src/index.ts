// =============================================================================
// BRIDGY (Full Featured)
// =============================================================================

export { Bridgy, type BridgyConfig } from './bridge';

// =============================================================================
// BRIDGY LITE (Lightweight)
// =============================================================================

export { BridgyLite, type BridgyLiteConfig } from './lite-bridge';

// =============================================================================
// SHARED TYPES
// =============================================================================

export type {
  BridgeMode,
  ConnectionState,
  BridgeAPI,
  BridgePacket,
  EventHandler,
  RequestHandler,
  RequestOptions,
} from './types';

export { isBridgePacket } from './types';
