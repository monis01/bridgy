// =============================================================================
// IIFE Entry Point for BridgyLite
// Exports BridgyLite + registers BridgyLog on window
// Single <script> tag — both globals available
// =============================================================================

export { BridgyLite, type BridgyLiteConfig } from './lite-bridge';
export { BridgyLog } from './bridgy-log';

import { BridgyLog } from './bridgy-log';

// Make BridgyLog available directly on window for console access
// e.g. BridgyLog.enable('Snow')
if (typeof window !== 'undefined') {
  (window as any).BridgyLog = BridgyLog;
}
