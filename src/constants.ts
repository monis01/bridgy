export const BRIDGE_MESSAGE_TYPE = 'bridgy-message';

export const MSG_TYPES = {
    SYN: 'SYN',
    SYN_ACK: 'SYN_ACK',
    ACK: 'ACK',
    DATA: 'DATA',
    RESPONSE: 'RESPONSE'
} as const;

export const DEFAULT_TIMEOUT = 10000;
