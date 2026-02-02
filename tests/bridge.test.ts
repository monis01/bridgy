import { describe, it, expect, afterEach } from 'vitest';
import { Bridgy } from '../src/bridge';

describe('Bridgy', () => {
  it('should be importable', () => {
    expect(Bridgy).toBeDefined();
  });
});

describe('Constructor & Initialization', () => {
  let bridge: Bridgy;

  afterEach(() => {
    if (bridge) {
      bridge.destroy();
    }
  });

  it('creates instance with required config (role, origins)', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });

  it('applies default values for optional config', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    expect(bridge.getState()).toBe('disconnected');
    expect(bridge.isConnected()).toBe(false);
  });

  it('auto-connects when autoConnect is true (default)', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
    });

    // Parent starts listening immediately, state should be 'connecting'
    expect(bridge.getState()).toBe('connecting');
  });

  it('does NOT auto-connect when autoConnect is false', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
    });

    expect(bridge.getState()).toBe('disconnected');
  });

  it('accepts custom timeout value', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      timeout: 5000,
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });

  it('accepts custom retries and retryInterval values', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      retries: 10,
      retryInterval: 1000,
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });

  it('accepts debug option', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      debug: true,
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });

  it('accepts mode option', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      mode: 'push',
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });

  it('accepts skipHandshake option', () => {
    bridge = new Bridgy({
      role: 'parent',
      origins: ['http://localhost:3000'],
      autoConnect: false,
      skipHandshake: true,
    });

    expect(bridge).toBeInstanceOf(Bridgy);
  });
});
