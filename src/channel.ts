import type { BridgeMessage, BridgeOptions, CommandHandler } from "./types";
import { BRIDGE_MESSAGE_TYPE, COMMANDS, ROLES } from './constants';
import { v4 as uuidv4 } from 'uuid';

interface ChildRegistry {
  [instanceId: string]: Window;
}


export class Bridge {

  constructor(private options: BridgeOptions){}

  setTargetWindow(win: Window) {}

  send(command: string, payload?: any, extra?: Partial<BridgeMessage>) {}

  listen(command: string, handler: CommandHandler) {}

}