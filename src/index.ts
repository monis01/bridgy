// =============================================================================
// BRIDGY
// =============================================================================

// Main classes
export { Parent } from './parent';
export { Child } from './child';

// Types
export type {
  BridgeMode,
  ConnectionState,
  ParentConfig,
  ChildConfig,
  BridgeAPI,
  BridgePacket,
  EventHandler,
  RequestHandler,
} from './types';

export { isBridgePacket } from './types';
