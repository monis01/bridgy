export type BridgeMode = 'sender' | 'receiver' | 'duplex';

export interface ChannelConfig {
  mode: BridgeMode;
  instanceId: string; // required, unique per channel
  children?: HTMLIFrameElement[]; // optional, only for sender or duplex
  allowedOrigins?: string[]; // optional, for receiver/duplex security
}

export interface PublicChannelAPI {
  send: (command: string, payload: any) => void;
  on: (command: string, handler: (payload: any, event?: MessageEvent) => void) => void;
  off: (command?: string, handler?: Function) => void;
  offAll: () => void;
  getInstanceId: () => string;
}
interface MessagePacket {
  command: string;
  payload: any;
  instanceId: string; // sender id
}

export class Channel {

  private readonly mode!: BridgeMode;
  private readonly instanceId!: string;
  private readonly children!: HTMLIFrameElement[];
  private readonly allowedOrigins!: string[];
  private readonly handlers = new Map<string, Set<Function>>();

  constructor(cfg: ChannelConfig) {
    this.mode = cfg.mode;
    this.instanceId = cfg.instanceId;
    this.children = cfg.children ?? [];
    this.allowedOrigins = cfg.allowedOrigins ?? [];

    if (this.isReceiver() || this.isDuplex()) {
      this.initListener();
    }
  }

  public getPublicAPI(): PublicChannelAPI {
    return {
      send: this.send.bind(this),
      on: this.on.bind(this),
      off: this.off.bind(this),
      offAll: this.offAll.bind(this),
      getInstanceId: this.getInstanceId.bind(this),
    }
  }

  /** Get channel ID */
  public getInstanceId(): string {
    return this.instanceId;
  }

   /** Subscribe to a command */
  public on(command: string, handler: (payload: any, event?: MessageEvent) => void) {
    if (!this.isReceiver() && !this.isDuplex()) {
      throw new Error(`[Channel] Cannot listen: channel is not receiver or duplex`);
    }

    const set = this.handlers.get(command) ?? new Set<Function>();
    set.add(handler);
    this.handlers.set(command, set);
  }

    /** Unsubscribe a handler or all handlers */
  public off(command?: string, handler?: Function) {
      if (!command) {
      // Remove all handlers for all commands
      this.handlers.clear();
      return;
    }

     if (!handler) {
      // Remove all handlers for this command
      this.handlers.delete(command);
      return;
    }

    const set = this.handlers.get(command);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(command);
    }

  }

    /** Remove all handlers */
  public offAll() {
    this.handlers.clear();
  }

   /** Send command to target(s) */
  public send(command: string, payload: any) {
    if (!this.isSender() && !this.isDuplex()) {
      throw new Error(`[Channel] Cannot send: channel is not sender or duplex`);
    }

    const packet: MessagePacket = {
      command,
      payload,
      instanceId: this.instanceId,
    };

     // Parent sending to children ; This is for V1
    // if (this.children.length > 0) {
    //   this.children.forEach((child) =>
    //     child.contentWindow?.postMessage(packet, '*')
    //   );
    //   return;
    // }

     // Child sending to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(packet, '*');
      return;
    }

    console.warn('[Channel] No valid target for send()');
  }

  /** Internal listener for incoming messages */
  private initListener() {
    window.addEventListener('message', (event: MessageEvent) => {

      // Security: check allowed origins
      if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(event.origin)) {
        return;
      }

      const data = event.data as MessagePacket;
      if (!data || !data.command) return;

      const handlers = this.handlers.get(data.command);
      if (handlers) {
        handlers.forEach((fn) => fn(data.payload, event));
      }

    });
  }


  private isSender() { return this.mode === 'sender'; }
  private isReceiver() { return this.mode === 'receiver'; }
  private isDuplex() { return this.mode === 'duplex'; }
}