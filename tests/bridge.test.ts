import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Bridgy } from '../src/bridge';

describe('Bridgy', () => {
  it('should be importable', () => {
    expect(Bridgy).toBeDefined();
  });
});

// describe('Constructor & Initialization', () => {
//   let bridge: Bridgy;

//   afterEach(() => {
//     if (bridge) {
//       bridge.destroy();
//     }
//   });

//   it('creates instance with required config (role, origins)', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//     });

//     expect(bridge).toBeInstanceOf(Bridgy);
//   });

//   it('applies default values for optional config', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//     });

//     // Default mode is 'duplex' - can send and receive
//     // We can't directly access private properties, but we can verify behavior
//     expect(bridge.getState()).toBe('disconnected');
//     expect(bridge.isConnected()).toBe(false);
//   });

//   it('auto-connects when autoConnect is true (default)', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       // autoConnect defaults to true
//     });

//     // Parent starts listening immediately, state should be 'connecting'
//     expect(bridge.getState()).toBe('connecting');
//   });

//   it('does NOT auto-connect when autoConnect is false', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//     });

//     expect(bridge.getState()).toBe('disconnected');
//   });

//   it('state is disconnected before connect', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//     });

//     expect(bridge.getState()).toBe('disconnected');
//     expect(bridge.isConnected()).toBe(false);
//   });

//   it('state is connecting after connect called', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//     });

//     expect(bridge.getState()).toBe('disconnected');

//     bridge.connect();

//     expect(bridge.getState()).toBe('connecting');
//   });

//   it('accepts custom timeout value', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//       timeout: 5000,
//     });

//     // Timeout is used internally for requests, verified in request tests
//     expect(bridge).toBeInstanceOf(Bridgy);
//   });

//   it('accepts custom retries and retryInterval values', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//       retries: 10,
//       retryInterval: 1000,
//     });

//     expect(bridge).toBeInstanceOf(Bridgy);
//   });

//   it('accepts debug option', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//       debug: true,
//     });

//     expect(bridge).toBeInstanceOf(Bridgy);
//   });

//   it('accepts mode option', () => {
//     bridge = new Bridgy({
//       role: 'parent',
//       origins: ['http://localhost:3000'],
//       autoConnect: false,
//       mode: 'push',
//     });

//     expect(bridge).toBeInstanceOf(Bridgy);
//   });
// });

describe('Connection (Child)', () => {
  let bridge: Bridgy;

  beforeEach(() => {
    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });
  });
  afterEach(() => {
    if (bridge) {
      bridge.destroy();
    }
  });

  it('rejects with error when not in iframe (window.parent === window)', async () => {
    // In jsdom, window.parent === window, so child role should fail
    await expect(bridge.connect()).rejects.toThrow('No parent window - must run in iframe');
    expect(bridge.isConnected()).toBeFalsy();
  });

  it('sends SYN packet on connect', () => {
    // Mock parent window
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge.connect();

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'SYN',
      }),
      'http://localhost:3000',
    );

    vi.unstubAllGlobals();
  });

});

describe('Connection (Parent)', () => {
  it.todo('waits for SYN from child');
});
