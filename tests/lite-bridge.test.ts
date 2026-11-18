import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgyLite } from '../src/lite-bridge';

describe('BridgyLite parent window routing', () => {
  let bridge: BridgyLite;
  const origin = 'https://child.example';
  const replacementOrigin = 'https://replacement.example';
  const first = { postMessage: vi.fn() };
  const second = { postMessage: vi.fn() };

  function deliver(source: typeof first | null, data: object, from = origin): void {
    window.dispatchEvent(new MessageEvent('message', {
      source: source as unknown as Window,
      origin: from,
      data: { __bridgy: true, ...data },
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new BridgyLite({ role: 'parent', origins: [origin, replacementOrigin], debug: false });
    bridge.handle('echo', payload => payload);
    bridge.connect();
  });

  afterEach(() => {
    bridge.destroy();
    vi.restoreAllMocks();
  });

  it('replies to each requesting frame after an iframe replacement', async () => {
    deliver(first, { type: 'REQUEST', id: 'first', command: 'echo', payload: 1 });
    await Promise.resolve();
    deliver(second, { type: 'REQUEST', id: 'second', command: 'echo', payload: 2 });
    await Promise.resolve();
    expect(first.postMessage).toHaveBeenCalledTimes(1);
    expect(second.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESPONSE', replyTo: 'second', payload: 2 }), origin,
    );
    bridge.send('notice');
    expect(second.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'DATA', command: 'notice' }), origin,
    );
  });

  it('follows the latest DATA sender for outgoing events', () => {
    deliver(first, { type: 'DATA', command: 'ready' });
    deliver(second, { type: 'DATA', command: 'ready' });
    bridge.send('notice');
    expect(first.postMessage).not.toHaveBeenCalled();
    expect(second.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'notice' }), origin);
  });

  it('returns a delayed reply to its sender after another frame becomes current', async () => {
    let release!: (value: unknown) => void;
    bridge.handle('slow', () => new Promise(resolve => { release = resolve; }));
    deliver(first, { type: 'REQUEST', id: 'slow', command: 'slow' });
    deliver(second, { type: 'DATA', command: 'ready' }, replacementOrigin);
    release('done');
    await Promise.resolve();
    expect(first.postMessage).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'slow', payload: 'done' }), origin);
    expect(second.postMessage).not.toHaveBeenCalled();
    bridge.send('notice');
    expect(second.postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'notice' }), replacementOrigin);
  });

  it('does not let a RESPONSE replace the current target', () => {
    deliver(first, { type: 'DATA', command: 'ready' });
    deliver(second, { type: 'RESPONSE', replyTo: 'unknown' }, replacementOrigin);
    bridge.send('notice');
    expect(first.postMessage).toHaveBeenCalledTimes(1);
    expect(second.postMessage).not.toHaveBeenCalled();
  });

  it('does not let a RESPONSE establish the first target', () => {
    deliver(second, { type: 'RESPONSE', replyTo: 'unknown' }, replacementOrigin);
    bridge.send('notice');
    expect(second.postMessage).not.toHaveBeenCalled();
  });

  it('rejects a disallowed origin without replacing the current target', () => {
    deliver(first, { type: 'DATA', command: 'ready' });
    deliver(second, { type: 'REQUEST', id: 'blocked', command: 'echo' }, 'https://blocked.example');
    bridge.send('notice');
    expect(first.postMessage).toHaveBeenCalledTimes(1);
    expect(second.postMessage).not.toHaveBeenCalled();
  });

  it('sends missing-handler and thrown-handler errors to their requesting frame', async () => {
    deliver(first, { type: 'DATA', command: 'ready' });
    bridge.handle('broken', () => { throw new Error('failed'); });
    deliver(second, { type: 'REQUEST', id: 'missing', command: 'missing' });
    deliver(second, { type: 'REQUEST', id: 'broken', command: 'broken' });
    await Promise.resolve();
    expect(first.postMessage).not.toHaveBeenCalled();
    expect(second.postMessage).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'missing', error: 'No handler for: missing' }), origin);
    expect(second.postMessage).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'broken', error: 'failed' }), origin);
  });

  it('keeps child-mode outgoing messages and replies directed to its parent', async () => {
    bridge.destroy();
    vi.spyOn(window, 'parent', 'get').mockReturnValue(first as unknown as Window);
    bridge = new BridgyLite({ role: 'child', origins: [origin], debug: false });
    bridge.handle('echo', payload => payload);
    bridge.connect();
    deliver(first, { type: 'REQUEST', id: 'parent', command: 'echo', payload: 'ok' });
    await Promise.resolve();
    deliver(second, { type: 'DATA', command: 'ready' });
    bridge.send('notice');
    expect(first.postMessage).toHaveBeenCalledWith(expect.objectContaining({ replyTo: 'parent', payload: 'ok' }), origin);
    expect(first.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ command: 'notice' }), origin);
    expect(second.postMessage).not.toHaveBeenCalled();
  });

  it('ignores a null source when selecting a target', () => {
    deliver(first, { type: 'DATA', command: 'ready' });
    deliver(null, { type: 'DATA', command: 'ready' });
    bridge.send('notice');
    expect(first.postMessage).toHaveBeenCalledTimes(1);
  });
});
