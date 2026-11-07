// =============================================================================
// BRIDGY (Full Featured)
// =============================================================================

export { Bridgy, type BridgyConfig } from './bridge';

// =============================================================================
// BRIDGY LITE (Lightweight)
// =============================================================================

export { BridgyLite, type BridgyLiteConfig } from './lite-bridge';

// =============================================================================
// BRIDGY LOG (Debug Controller)
// =============================================================================

export { BridgyLog } from './bridgy-log';

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
