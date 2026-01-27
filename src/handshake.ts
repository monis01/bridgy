// =============================================================================
// BRIDGY HANDSHAKE
// =============================================================================
// 3-way handshake: Child sends SYN → Parent sends SYN_ACK → Child sends ACK
// =============================================================================

import type { BridgePacket } from './types';
import { isBridgePacket } from './types';
import { makeId, isOriginAllowed } from './utils';
import type { Logger } from './logger';

// Packet creators
function createPacket(type: 'SYN' | 'SYN_ACK' | 'ACK'): BridgePacket {
  return { __bridgy: true, type, id: makeId(type.toLowerCase()), timestamp: Date.now() };
}

// =============================================================================
// PARENT HANDSHAKE - Waits for child to connect
// =============================================================================

export interface ParentHandshakeResult {
  childWindow: Window;
  childOrigin: string;
  cleanup: () => void;
}

export function parentHandshake(
  allowedOrigins: string[],
  timeout: number,
  logger: Logger
): Promise<ParentHandshakeResult> {
  return new Promise((resolve, reject) => {
    let childWindow: Window | null = null;
    let childOrigin: string | null = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeoutId);
    };

    const handler = (event: MessageEvent) => {
      if (!isOriginAllowed(event.origin, allowedOrigins)) return;
      if (!isBridgePacket(event.data)) return;

      const packet = event.data;

      if (packet.type === 'SYN') {
        logger.log('recv', 'SYN', { origin: event.origin });
        childWindow = event.source as Window;
        childOrigin = event.origin;

        const synAck = createPacket('SYN_ACK');
        logger.log('send', 'SYN_ACK', {});
        childWindow.postMessage(synAck, childOrigin);
      }

      if (packet.type === 'ACK' && childWindow && childOrigin) {
        logger.log('recv', 'ACK', {});
        logger.info('Handshake complete');
        cleanup();
        resolve({ childWindow, childOrigin, cleanup: () => {} });
      }
    };

    window.addEventListener('message', handler);
    logger.info('Waiting for child...');

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Handshake timeout'));
    }, timeout);
  });
}

// =============================================================================
// CHILD HANDSHAKE - Initiates connection to parent
// =============================================================================

export function childHandshake(
  targetOrigin: string,
  timeout: number,
  logger: Logger
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parent = window.parent;
    if (!parent || parent === window) {
      reject(new Error('No parent window - must run in iframe'));
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      window.removeEventListener('message', handler);
      clearTimeout(timeoutId);
    };

    const handler = (event: MessageEvent) => {
      if (targetOrigin !== '*' && event.origin !== targetOrigin) return;
      if (!isBridgePacket(event.data)) return;

      if (event.data.type === 'SYN_ACK') {
        logger.log('recv', 'SYN_ACK', {});

        const ack = createPacket('ACK');
        logger.log('send', 'ACK', {});
        parent.postMessage(ack, targetOrigin);

        logger.info('Handshake complete');
        cleanup();
        resolve();
      }
    };

    window.addEventListener('message', handler);

    const syn = createPacket('SYN');
    logger.log('send', 'SYN', {});
    parent.postMessage(syn, targetOrigin);

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Handshake timeout'));
    }, timeout);
  });
}
