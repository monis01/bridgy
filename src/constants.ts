// Message type constant
export const BRIDGE_MESSAGE_TYPE = 'BRIDGER_MESSAGE_V0';

// Roles
export const MODES = {
  SENDER: 'sender',
  RECEIVER: 'receiver',
  DUPLEX: 'duplex',
} as const;

export const DEFAULT_VERSION = '0.1.0';

// Command constants
export const COMMANDS = {
  INIT: 'init',
  ACK: 'ack',
  REFRESH: 'refresh',
  UPDATE: 'update',
} as const;
