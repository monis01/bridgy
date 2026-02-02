import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Bridgy } from '../src/bridge';

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

  it('state is "connecting" after connect() is called', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge.connect();

    expect(bridge.getState()).toBe('connecting');

    vi.unstubAllGlobals();
  });

  it('retries SYN packet after retryInterval', async () => {
    vi.useFakeTimers();
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    const retryBridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      retries: 3,
      retryInterval: 1000,
    });

    retryBridge.connect();

    // First SYN sent immediately
    expect(mockPostMessage).toHaveBeenCalledTimes(1);

    // Advance time to trigger retry
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockPostMessage).toHaveBeenCalledTimes(2);

    // Another retry
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockPostMessage).toHaveBeenCalledTimes(3);

    retryBridge.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('rejects ready() after max retries exhausted', async () => {
    vi.useFakeTimers();
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    const retryBridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      retries: 2,
      retryInterval: 500,
    });

    const readyPromise = retryBridge.connect();

    // Attach catch handler immediately to prevent unhandled rejection
    let rejectionError: Error | undefined;
    readyPromise.catch((err: Error) => {
      rejectionError = err;
    });

    // Exhaust all retries (initial + 2 retries)
    await vi.advanceTimersByTimeAsync(500); // retry 1
    await vi.advanceTimersByTimeAsync(500); // retry 2
    await vi.advanceTimersByTimeAsync(500); // exceeds retries

    // Wait for any pending promises to resolve
    await vi.runAllTimersAsync();

    expect(rejectionError).toBeInstanceOf(Error);
    expect(rejectionError?.message).toBe('Connection failed after 2 attempts');
    expect(retryBridge.getState()).toBe('disconnected');

    retryBridge.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('completes handshake when receiving SYN_ACK', async () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge.connect();

    // Simulate receiving SYN_ACK from parent
    const synAckEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN_ACK', id: 'sack-123', timestamp: Date.now() },
      origin: 'http://localhost:3000',
      source: fakeParent as unknown as Window,
    });
    window.dispatchEvent(synAckEvent);

    // Should have sent ACK
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
    expect(mockPostMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'ACK',
      }),
      'http://localhost:3000',
    );

    // Should be connected
    expect(bridge.getState()).toBe('connected');
    expect(bridge.isConnected()).toBe(true);

    vi.unstubAllGlobals();
  });

  it('ignores SYN_ACK from wrong origin', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge.connect();

    // Simulate receiving SYN_ACK from wrong origin
    const synAckEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN_ACK', id: 'sack-123', timestamp: Date.now() },
      origin: 'http://malicious-site.com',
      source: fakeParent as unknown as Window,
    });
    window.dispatchEvent(synAckEvent);

    // Should NOT have sent ACK
    expect(mockPostMessage).toHaveBeenCalledTimes(1); // Only SYN
    expect(bridge.getState()).toBe('connecting');

    vi.unstubAllGlobals();
  });

  it('ignores non-bridgy messages', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge.connect();

    // Simulate receiving non-bridgy message
    const randomEvent = new MessageEvent('message', {
      data: { someOther: 'data' },
      origin: 'http://localhost:3000',
      source: fakeParent as unknown as Window,
    });
    window.dispatchEvent(randomEvent);

    // Should NOT have sent ACK
    expect(mockPostMessage).toHaveBeenCalledTimes(1); // Only SYN
    expect(bridge.getState()).toBe('connecting');

    vi.unstubAllGlobals();
  });
});

describe('Connection (Child) - skipHandshake', () => {
  let bridge: Bridgy;

  afterEach(() => {
    if (bridge) {
      bridge.destroy();
    }
    vi.unstubAllGlobals();
  });

  it('connects immediately when skipHandshake is true', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      skipHandshake: true,
      autoConnect: false,
    });

    bridge.connect();

    // Should NOT send SYN
    expect(mockPostMessage).not.toHaveBeenCalled();

    // Should be connected immediately
    expect(bridge.getState()).toBe('connected');
    expect(bridge.isConnected()).toBe(true);
  });

  it('resolves ready() immediately when skipHandshake is true', async () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      skipHandshake: true,
      autoConnect: false,
    });

    await expect(bridge.connect()).resolves.toBeUndefined();
    expect(bridge.isConnected()).toBe(true);
  });

  it('uses first origin as targetOrigin when skipHandshake is true', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      skipHandshake: true,
      autoConnect: false,
    });

    bridge.connect();

    // Send a message to verify targetOrigin
    bridge.send('test', { data: 'value' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'DATA',
        command: 'test',
      }),
      'http://localhost:3000',
    );
  });

  it('uses "*" as targetOrigin when origins array is empty and skipHandshake is true', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: [],
      skipHandshake: true,
      autoConnect: false,
    });

    bridge.connect();
    bridge.send('test', { data: 'value' });

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ __bridgy: true }),
      '*',
    );
  });

  it('can send messages immediately after connect when skipHandshake is true', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['*'],
      skipHandshake: true,
      autoConnect: false,
    });

    bridge.connect();
    bridge.send('event1', { foo: 'bar' });
    bridge.send('event2', { baz: 'qux' });

    expect(mockPostMessage).toHaveBeenCalledTimes(2);
  });

  it('still rejects when not in iframe even with skipHandshake true', async () => {
    // Don't mock parent - window.parent === window in jsdom
    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      skipHandshake: true,
      autoConnect: false,
    });

    await expect(bridge.connect()).rejects.toThrow('No parent window - must run in iframe');
  });

  it('performs normal handshake when skipHandshake is false (default)', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      skipHandshake: false, // explicit false
      autoConnect: false,
    });

    bridge.connect();

    // Should send SYN
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ __bridgy: true, type: 'SYN' }),
      'http://localhost:3000',
    );
    expect(bridge.getState()).toBe('connecting');
  });

  it('performs normal handshake when skipHandshake is undefined', () => {
    const mockPostMessage = vi.fn();
    const fakeParent = { postMessage: mockPostMessage };
    vi.stubGlobal('parent', fakeParent);

    bridge = new Bridgy({
      role: 'child',
      origins: ['http://localhost:3000'],
      // skipHandshake not specified
      autoConnect: false,
    });

    bridge.connect();

    // Should send SYN
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ __bridgy: true, type: 'SYN' }),
      'http://localhost:3000',
    );
    expect(bridge.getState()).toBe('connecting');
  });
});
