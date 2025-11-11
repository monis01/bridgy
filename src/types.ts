import { BRIDGE_MESSAGE_TYPE, MODES } from "./constants";

export type Mode = (typeof MODES)[keyof typeof MODES];
export interface ActOptions {
  mode: Mode;
  // for senders: where to post (parent origin)
  toOrigin?: string;
  // for receivers: allowed origins for incoming messages
  fromOrigins?: string[]; // whitelist, '*' allowed for dev
  // optional friendly id; auto-generated if absent
  instanceId?: string;
  // version of your bridge library/consumer
  version?: string;
}
export interface BridgeMessage {
  type: typeof BRIDGE_MESSAGE_TYPE;
  command: string;
  payload?: any;
  messageId: string;
  senderId: string;
  targetId?: string; // optional
  timestamp: number; // ms
  version?: string;
  // permissions or other meta can be added later
}

export type OnHandler = (payload: any, meta: BridgeMessage, ev?: MessageEvent) => void;

export interface BridgerPublic {
  // send a command (allowed if mode supports it)
  send(command: string, payload?: any, targetId?: string): void;
  // register a listener for a command
  on(command: string, handler: OnHandler): void;
  // remove previously registered listener
  off(command: string, handler?: OnHandler): void;
  // returns instance id for tracing
  getInstanceId(): string;
}


