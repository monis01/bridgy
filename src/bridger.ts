import { Channel, type BridgeMode, type ChannelConfig, type PublicChannelAPI } from "./channel";
import type { ActOptions, BridgerPublic } from "./types";

const registry = new Map<string, Channel>();

// export const Bridger = {

//     act(opts: ActOptions): BridgerPublic | void {

//         const channel = new Channel(opts);

//     }
// }

// function publicApiFor(channel: Channel): BridgerPublic {

//     return {
//         send: (command: string, payload?: any, targetId?: string) => {
//       // Allow sending from c2p or peer (for now)
//       channel.send(command, payload, targetId);
//     },
//     on: (command: string, handler) => channel.on(command, handler),
//     off: (command: string, handler?) => channel.off(command, handler),
//     getInstanceId: () => channel.getInstanceId()
//     }

// }

export class Bridger {
  static act(bridgeMode: BridgeMode, opts: ChannelConfig): PublicChannelAPI {
    if (!opts.instanceId) {
      throw new Error(
        `[Bridger] instanceId is required. Provide a unique ID per parent/child channel.`
      );
    }
    const key = opts.instanceId;
    const channel = new Channel({ ...opts, mode: bridgeMode});
    registry.set(key, channel);
    return channel.getPublicAPI();
  }

  static get(instanceId: string): PublicChannelAPI | undefined {
    const channel = registry.get(instanceId);
    return channel?.getPublicAPI();
  }

  static remove(instanceId: string) {
    const channel = registry.get(instanceId);
    if (channel) {
      channel.offAll();
      registry.delete(instanceId);
    }
  }
  static listInstanceIds(): string[] {
    return Array.from(registry.keys());
  }
}
