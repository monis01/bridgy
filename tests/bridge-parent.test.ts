import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { Bridgy } from '../src/bridge';

describe('Connection (Parent)', () => {
  let bridge: Bridgy;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (bridge) {
      bridge.destroy();
    }
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('starts in connecting state when autoConnect is true', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
    });

    expect(bridge.getState()).toBe('connecting');
  });

  it('stays in disconnected state when autoConnect is false', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    expect(bridge.getState()).toBe('disconnected');
  });

  it('transitions to connecting state after connect() is called', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    expect(bridge.getState()).toBe('disconnected');
    bridge.connect();
    expect(bridge.getState()).toBe('connecting');
  });

  it('responds with SYN_ACK when receiving SYN from allowed origin', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving SYN from child
    const synEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN', id: 'syn-123', timestamp: Date.now() },
      origin: 'http://localhost:3000',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(synEvent);

    // Should have sent SYN_ACK
    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'SYN_ACK',
      }),
      'http://localhost:3000',
    );
  });

  it('ignores SYN from disallowed origin', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving SYN from wrong origin
    const synEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN', id: 'syn-123', timestamp: Date.now() },
      origin: 'http://malicious-site.com',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(synEvent);

    // Should NOT have sent SYN_ACK
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(bridge.getState()).toBe('connecting');
  });

  it('completes handshake when receiving ACK after SYN_ACK', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving SYN from child
    const synEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN', id: 'syn-123', timestamp: Date.now() },
      origin: 'http://localhost:3000',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(synEvent);

    // Simulate receiving ACK from child
    const ackEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'ACK', id: 'ack-123', timestamp: Date.now() },
      origin: 'http://localhost:3000',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(ackEvent);

    // Should be connected
    expect(bridge.getState()).toBe('connected');
    expect(bridge.isConnected()).toBe(true);
  });

  it('accepts wildcard origin "*"', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['*'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving SYN from any origin
    const synEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN', id: 'syn-123', timestamp: Date.now() },
      origin: 'http://any-origin.com',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(synEvent);

    // Should have sent SYN_ACK
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'SYN_ACK',
      }),
      'http://any-origin.com',
    );
  });

  it('accepts multiple allowed origins', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000', 'http://localhost:4000', 'https://example.com'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving SYN from second allowed origin
    const synEvent = new MessageEvent('message', {
      data: { __bridgy: true, type: 'SYN', id: 'syn-123', timestamp: Date.now() },
      origin: 'http://localhost:4000',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(synEvent);

    // Should have sent SYN_ACK
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __bridgy: true,
        type: 'SYN_ACK',
      }),
      'http://localhost:4000',
    );
  });

  it('ignores non-bridgy messages', () => {
    const mockPostMessage = vi.fn();
    const mockChildWindow = { postMessage: mockPostMessage };

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    bridge.connect();

    // Simulate receiving non-bridgy message
    const randomEvent = new MessageEvent('message', {
      data: { someOther: 'data' },
      origin: 'http://localhost:3000',
      source: mockChildWindow as unknown as Window,
    });
    window.dispatchEvent(randomEvent);

    // Should NOT have sent anything
    expect(mockPostMessage).not.toHaveBeenCalled();
    expect(bridge.getState()).toBe('connecting');
  });

  it('waits indefinitely for child (no timeout)', async () => {
    vi.useFakeTimers();

    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    bridge.connect();

    // Advance time significantly - parent should still be waiting
    await vi.advanceTimersByTimeAsync(60000); // 1 minute

    expect(bridge.getState()).toBe('connecting');
    expect(bridge.isConnected()).toBe(false);

    vi.useRealTimers();
  });
});
