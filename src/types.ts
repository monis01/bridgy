import { BRIDGE_MESSAGE_TYPE, ROLES } from "./constants";

export type Role = (typeof ROLES)[keyof typeof ROLES];
export interface BridgeOptions {
  role: Role;
  toOrigin?: string;
  fromOrigin?: string;
  targetWindow?: Window;
  instanceId?: string;
}
export interface BridgeMessage {
  type: typeof BRIDGE_MESSAGE_TYPE;
  command: string;
  payload?: any;
  messageId: string;
  sourceId?: string;
  targetId?: string;
//   timestamp: number;
//   version?: string;
//   permissions?: string[];
//   correlationId?: string;
//   trace?: string;
}
export type CommandHandler = (payload?: any, message?: BridgeMessage) => void;
