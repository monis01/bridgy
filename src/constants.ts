// Message type constant
export const BRIDGE_MESSAGE_TYPE = 'BRIDGER_MESSAGE';

// Roles
export const ROLES = {
  SENDER: 'sender',
  RECEIVER: 'receiver',
  DUPLEX: 'duplex',
} as const;

// Command constants
export const COMMANDS = {
  INIT: 'init',
  ACK: 'ack',
  REFRESH: 'refresh',
  UPDATE: 'update',
} as const;
