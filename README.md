<p align="center">
  <img src="logo.svg" alt="Bridgy Logo" width="400"/>
</p>

<h1 align="center">Bridgy</h1>

<p align="center">
  Lightweight, secure iframe communication library for cross-origin messaging.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/size-~7kb-blue" alt="Size"/>
  <img src="https://img.shields.io/badge/typescript-ready-brightgreen" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

---

## Features

- **Single Class API** - One `Bridgy` class for both parent and child
- **Secure Handshake** - 3-way handshake (SYN → SYN_ACK → ACK) before communication
- **Skip Handshake Mode** - Optional instant connection for raw postMessage parents
- **Origin Validation** - Whitelist allowed origins for security
- **Message Queueing** - Messages sent before connection are queued automatically
- **Non-blocking** - No callback hell, connection happens in background
- **Multiple Patterns** - Fire-and-forget, event subscription, request-response
- **Debug Mode** - Built-in logging with runtime toggle
- **TypeScript** - Full type support
- **Lightweight** - ~7KB minified

## Installation

```bash
npm install @monis01/iframe-bridge
```

Or via script tag:
```html
<script src="path/to/index.global.js"></script>
```

## Quick Start

### Parent Application (has iframe)

```typescript
import { Bridgy } from '@monis01/iframe-bridge';

const bridge = new Bridgy({
  role: 'parent',
  origins: ['https://child-app.com'],
  debug: true
});

// Send data to child (queued until connected)
bridge.send('config', { theme: 'dark', lang: 'en' });

// Listen for events from child
bridge.on('user-click', (data) => {
  console.log('User clicked:', data.buttonId);
});

// Handle requests from child
bridge.handle('get-user', async (payload) => {
  const user = await fetchUser(payload.id);
  return user;
});

// Optional: know when connected
bridge.ready()
  .then(() => console.log('Child connected'))
  .catch((err) => console.error('Connection failed:', err));
```

### Child Application (inside iframe)

```typescript
import { Bridgy } from '@monis01/iframe-bridge';

const bridge = new Bridgy({
  role: 'child',
  origins: ['https://parent-app.com'],
  debug: true
});

// Listen for events from parent
bridge.on('config', (data) => {
  applyTheme(data.theme);
});

// Send events to parent
bridge.send('user-click', { buttonId: 'submit-btn' });

// Request data from parent
const user = await bridge.request('get-user', { id: 123 });
console.log('Got user:', user);
```

## API Reference

### Constructor

```typescript
new Bridgy(config: BridgyConfig)
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `role` | `'parent' \| 'child'` | Yes | Parent has iframe, child is inside iframe |
| `origins` | `string[]` | Yes | Allowed origins (parent) or target origin (child) |
| `mode` | `'duplex' \| 'push' \| 'pull'` | No | Communication mode (default: `'duplex'`) |
| `debug` | `boolean` | No | Enable debug logging (default: `false`) |
| `timeout` | `number` | No | Request timeout in ms (default: `10000`) |
| `autoConnect` | `boolean` | No | Auto-connect on instantiation (default: `true`) |
| `retries` | `number` | No | SYN retry attempts for child (default: `5`) |
| `retryInterval` | `number` | No | Interval between retries in ms (default: `2000`) |
| `skipHandshake` | `boolean` | No | Skip handshake, connect immediately (default: `false`) |

### Methods

#### Connection

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Manually initiate connection (use with `autoConnect: false`) |
| `ready()` | `Promise<void>` | Resolves when connected |
| `onReady(callback)` | `void` | Callback when connected |
| `isConnected()` | `boolean` | Check connection status |
| `getState()` | `ConnectionState` | Get current state |
| `destroy()` | `void` | Cleanup and disconnect |

#### Messaging

| Method | Returns | Description |
|--------|---------|-------------|
| `send(command, payload?)` | `void` | Fire-and-forget message |
| `on(command, handler)` | `void` | Subscribe to events |
| `off(command?, handler?)` | `void` | Unsubscribe |
| `request(command, payload?, timeout?)` | `Promise<T>` | Request-response |
| `handle(command, handler)` | `void` | Register request handler |
| `removeHandler(command)` | `void` | Remove request handler |

#### Debug

| Method | Description |
|--------|-------------|
| `enableDebug()` | Turn on console logging |
| `disableDebug()` | Turn off console logging |

## Communication Modes

| Mode | Send | Receive | Use Case |
|------|------|---------|----------|
| `duplex` | ✓ | ✓ | Two-way communication (default) |
| `push` | ✓ | ✗ | Only send messages |
| `pull` | ✗ | ✓ | Only receive messages |

```typescript
// Push only - can send but not receive
const bridge = new Bridgy({
  role: 'parent',
  origins: ['https://child.com'],
  mode: 'push'
});
```

## Handshake Flow

```
Child                              Parent
  |                                  |
  |----------- SYN ---------------->|  Child initiates
  |                                  |
  |<---------- SYN_ACK -------------|  Parent acknowledges
  |                                  |
  |----------- ACK ---------------->|  Child confirms
  |                                  |
  |========== CONNECTED ============|
```

## Manual Connection

By default, Bridgy connects automatically on instantiation. Use `autoConnect: false` for manual control:

```typescript
const bridge = new Bridgy({
  role: 'child',
  origins: ['https://parent-app.com'],
  autoConnect: false,  // Don't connect immediately
  retries: 3,          // Retry SYN 3 times
  retryInterval: 1000  // 1 second between retries
});

// Set up handlers before connecting
bridge.on('config', (data) => applyConfig(data));
bridge.handle('get-status', () => ({ ready: true }));

// Connect when ready
try {
  await bridge.connect();
  console.log('Connected!');
} catch (err) {
  console.error('Connection failed:', err.message);
}
```

## Skip Handshake Mode

When the parent application uses raw `postMessage` instead of Bridgy, use `skipHandshake: true` to bypass the 3-way handshake:

```typescript
const bridge = new Bridgy({
  role: 'child',
  origins: ['*'],
  skipHandshake: true,   // Skip handshake, assume parent is ready
  autoConnect: false
});

// Connect immediately - no waiting for parent response
await bridge.connect();

// Send messages immediately
bridge.send('child-ready', { status: 'initialized' });

// Request-response still works if parent sends proper response format
const token = await bridge.request('getToken', { userId: 123 });
```

**When to use `skipHandshake: true`:**
- Parent uses raw `window.postMessage()` instead of Bridgy
- You want instant connection without handshake overhead
- Parent application is guaranteed to be ready

**Parent (raw postMessage) must respond to requests with this format:**
```javascript
// Parent handling request from Bridgy child
window.addEventListener('message', (event) => {
  const packet = event.data;

  if (packet?.__bridgy && packet.type === 'REQUEST') {
    // Send response with matching replyTo
    event.source.postMessage({
      __bridgy: true,
      type: 'RESPONSE',
      replyTo: packet.id,        // Must match request ID
      payload: { token: 'xyz' }  // Your response data
    }, event.origin);
  }
});
```

## Message Patterns

### Fire-and-Forget

```typescript
// Sender
bridge.send('notification', { message: 'Hello!' });

// Receiver
bridge.on('notification', (data) => {
  showNotification(data.message);
});
```

### Request-Response

```typescript
// Requester
const result = await bridge.request('calculate', { a: 5, b: 3 });
console.log(result); // { sum: 8 }

// Handler
bridge.handle('calculate', (payload) => {
  return { sum: payload.a + payload.b };
});
```

### Async Handler

```typescript
bridge.handle('fetch-data', async (payload) => {
  const response = await fetch(`/api/data/${payload.id}`);
  return response.json();
});
```

## Usage with Frameworks

### Script Tag (Vanilla JS)

```html
<script src="path/to/index.global.js"></script>
<script>
  // Access via global Bridger object
  var bridge = new Bridger.Bridgy({
    role: 'child',
    origins: ['*'],
    skipHandshake: true,
    autoConnect: false
  });

  // Connect and use
  bridge.connect().then(function() {
    bridge.send('ready', { status: 'connected' });
  });
</script>
```

### Angular

```typescript
// bridge.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Bridgy } from '@monis01/iframe-bridge';

@Injectable({ providedIn: 'root' })
export class BridgeService implements OnDestroy {
  private bridge: Bridgy;

  constructor() {
    this.bridge = new Bridgy({
      role: 'child',
      origins: ['*'],
      skipHandshake: true,
      autoConnect: false
    });
  }

  // Expose instance for direct access to standard methods
  get instance(): Bridgy {
    return this.bridge;
  }

  // Custom connect that registers handlers after connection
  async connect(): Promise<void> {
    await this.bridge.connect();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.bridge.handle('get-status', () => ({ ready: true }));
  }

  ngOnDestroy(): void {
    this.bridge.destroy();
  }
}

// Usage in component
@Component({ ... })
export class MyComponent {
  constructor(private bridgeService: BridgeService) {}

  async ngOnInit() {
    await this.bridgeService.connect();

    // Use instance directly for standard operations
    this.bridgeService.instance.send('ready', { timestamp: Date.now() });
    this.bridgeService.instance.on('config', (data) => this.applyConfig(data));
  }
}
```

### React

```typescript
// useBridge.ts
import { useEffect, useRef } from 'react';
import { Bridgy } from '@monis01/iframe-bridge';

export function useBridge(config: BridgyConfig) {
  const bridgeRef = useRef<Bridgy>();

  useEffect(() => {
    bridgeRef.current = new Bridgy(config);
    return () => bridgeRef.current?.destroy();
  }, []);

  return bridgeRef.current;
}
```

## Bundle Sizes

| Format | File | Size |
|--------|------|------|
| IIFE (CDN) | `dist/index.global.js` | **~7.3 KB** |
| ESM | `dist/index.js` | **~6.8 KB** |
| CJS | `dist/index.cjs` | **~7.3 KB** |
| Types | `dist/index.d.ts` | **~4.6 KB** |

## File Structure

```
src/
├── index.ts      - Exports
├── bridge.ts     - Main Bridgy class
├── types.ts      - TypeScript interfaces
├── constants.ts  - Default values
├── logger.ts     - Debug logger
└── utils.ts      - Helpers
```

## Browser Support

Works in all modern browsers that support `postMessage`:
- Chrome, Firefox, Safari, Edge (latest)
- IE11 (with polyfills)

## License

MIT
