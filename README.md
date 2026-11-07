<p align="center">
  <img src="logo.svg" alt="Bridgy Logo" width="400"/>
</p>

<h1 align="center">Bridgy</h1>

<p align="center">
  Lightweight, secure iframe communication library for cross-origin messaging.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bridgy-7.9kb-blue" alt="Bridgy Size"/>
  <img src="https://img.shields.io/badge/BridgyLite-5.0kb-green" alt="BridgyLite Size"/>
  <img src="https://img.shields.io/badge/typescript-ready-brightgreen" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

---

## 📦 Two Versions Available

Choose the version that fits your needs:

| Version | Size | Use When |
|---------|------|----------|
| **Bridgy** (Full) | 7.9 KB | Need handshake, retries, message queueing |
| **BridgyLite** | 5.0 KB | Simple request/response + events (37% smaller!) |

### Quick Comparison

| Feature | Bridgy | BridgyLite |
|---------|--------|------------|
| **Size (minified)** | 7.9 KB | 5.0 KB ✅ |
| **Request/Response** | ✅ | ✅ |
| **Events (send/on)** | ✅ | ✅ |
| **Origin Validation** | ✅ | ✅ |
| **Debug Logging** | ✅ | ✅ |
| **Timeout (per-request)** | ✅ | ✅ |
| **3-Way Handshake** | ✅ | ❌ |
| **Message Queueing** | ✅ | ❌ |
| **Retry Logic** | ✅ | ❌ |
| **Mode System** | ✅ | ❌ |
| **Auto-connect** | ✅ | ❌ Manual only |

---

## 🚀 Installation

### npm
```bash
npm install @monis01/iframe-bridge
```

### CDN (Script Tag)

Choose the version you need:

```html
<!-- Full Bridgy (7.9 KB) - With handshake, retries, queueing -->
<script src="https://unpkg.com/@monis01/iframe-bridge/dist/bridgy.global.js"></script>

<!-- OR BridgyLite (5.0 KB) - Lightweight, instant connection -->
<script src="https://unpkg.com/@monis01/iframe-bridge/dist/bridgy-lite.global.js"></script>
```

---

## 🎯 Quick Start

### Option 1: BridgyLite (Recommended for Simple Use Cases)

**When to use BridgyLite:**
- ✅ You need request/response + events
- ✅ You want instant connection (no handshake)
- ✅ You want the smallest bundle size
- ✅ Parent may or may not use Bridgy

#### Child Application (5.0 KB)

```typescript
import { BridgyLite } from '@monis01/iframe-bridge';

const bridge = new BridgyLite({
  role: 'child',
  origins: ['https://parent-app.com'],
  debug: true,
  timeout: 30000
});

// Manual connection (instant, no handshake)
bridge.connect();

// Request-response
const token = await bridge.request('get-token', { userId: 123 });
console.log('Got token:', token);

// Listen for events
bridge.on('config-update', (data) => {
  console.log('New config:', data);
});

// Send events
bridge.send('user-action', { action: 'click', button: 'submit' });
```

#### Parent Application (No Bridgy Required!)

```javascript
// Parent can use raw postMessage - no library needed!
window.addEventListener('message', (event) => {
  const msg = event.data;

  // Handle REQUEST from BridgyLite child
  if (msg.__bridgy && msg.type === 'REQUEST' && msg.command === 'get-token') {
    // Send RESPONSE back
    event.source.postMessage({
      __bridgy: true,
      type: 'RESPONSE',
      id: 'res-' + Date.now(),
      timestamp: Date.now(),
      replyTo: msg.id,  // ← Match request ID!
      payload: { token: 'abc123' }
    }, event.origin);
  }

  // Send event to child (simplified format)
  event.source.postMessage({
    command: 'config-update',  // ← BridgyLite extracts this
    theme: 'dark',
    lang: 'en'
  }, event.origin);
});
```

---

### Option 2: Full Bridgy (For Advanced Features)

**When to use full Bridgy:**
- ✅ You need 3-way handshake for secure connection
- ✅ You need message queueing before connection
- ✅ You need retry logic
- ✅ Both parent and child use Bridgy

#### Parent Application

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

#### Child Application

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

---

## 📚 Which File to Use?

### For npm (TypeScript/Bundlers)

```typescript
// Full Bridgy (tree-shaken to ~6-7 KB)
import { Bridgy } from '@monis01/iframe-bridge';

// OR BridgyLite (tree-shaken to ~2-5 KB)
import { BridgyLite } from '@monis01/iframe-bridge';
```

**Files used:**
- `dist/index.js` (ESM)
- `dist/index.cjs` (CommonJS)
- `dist/index.d.ts` (TypeScript types)

---

### For CDN (Script Tag)

#### Full Bridgy (7.9 KB)
```html
<script src="https://unpkg.com/@monis01/iframe-bridge/dist/bridgy.global.js"></script>
<script>
  const bridge = new Bridger.Bridgy({
    role: 'child',
    origins: ['*'],
    skipHandshake: true
  });
</script>
```

#### BridgyLite (5.0 KB) ⭐ Recommended
```html
<script src="https://unpkg.com/@monis01/iframe-bridge/dist/bridgy-lite.global.js"></script>
<script>
  const bridge = new BridgerLite.BridgyLite({
    role: 'child',
    origins: ['*']
  });

  bridge.connect();
  bridge.request('get-token', {}).then(result => {
    console.log('Token:', result.token);
  });
</script>
```

---

## 🔧 BridgyLite API

### Constructor

```typescript
new BridgyLite(config: BridgyLiteConfig)
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `role` | `'parent' \| 'child'` | Yes | Parent has iframe, child is inside iframe |
| `origins` | `string[]` | Yes | Allowed origins (parent) or target origin (child) |
| `debug` | `boolean` | No | Enable debug logging (default: `false`) |
| `timeout` | `number` | No | Request timeout in ms (default: `30000`) |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `void` | **Manual connection** (instant, no handshake) |
| `isConnected()` | `boolean` | Check connection status |
| `request(cmd, payload?, options?)` | `Promise<T>` | Request-response with timeout |
| `handle(cmd, handler)` | `void` | Register request handler |
| `send(cmd, payload?)` | `void` | Fire-and-forget message |
| `on(cmd, handler)` | `void` | Subscribe to events |
| `off(cmd?, handler?)` | `void` | Unsubscribe from events |
| `destroy()` | `void` | Cleanup and disconnect |

### Example: Timeout Override

```typescript
const bridge = new BridgyLite({
  role: 'child',
  origins: ['*'],
  timeout: 30000  // Global default: 30s
});

try {
  // Use global timeout (30s)
  const result1 = await bridge.request('quick-action', {});

  // Override timeout for slow operation (60s)
  const result2 = await bridge.request('slow-action', {}, { timeout: 60000 });

} catch (error) {
  // Timeout error includes command and duration
  console.error(error.message); // "Timeout: slow-action (60000ms)"
}
```

### Example: Raw Message Support

BridgyLite accepts both Bridgy packets AND raw messages:

```javascript
// Parent sends raw message (no Bridgy library needed)
iframe.contentWindow.postMessage({
  command: 'token-update',  // ← BridgyLite extracts this
  token: 'new-token-abc123',
  expires: 3600
}, 'https://child-origin.com');

// Child receives it
bridge.on('token-update', (data) => {
  console.log('New token:', data.token);  // Works! ✅
});
```

**Supported command fields:**
- `data.command`
- `data.type`
- `data.event`

---

## 🔧 Full Bridgy API

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
- `connect()` - Promise<void>
- `ready()` - Promise<void>
- `onReady(callback)` - void
- `isConnected()` - boolean
- `getState()` - ConnectionState
- `destroy()` - void

#### Messaging
- `send(command, payload?)` - void
- `on(command, handler)` - void
- `off(command?, handler?)` - void
- `request(command, payload?, timeout?)` - Promise<T>
- `handle(command, handler)` - void
- `removeHandler(command)` - void

#### Debug
- `enableDebug()` - void
- `disableDebug()` - void

---

## 🎨 Usage with Frameworks

### Angular with BridgyLite

```typescript
// bridge.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BridgyLite } from '@monis01/iframe-bridge';

@Injectable({ providedIn: 'root' })
export class BridgeService implements OnDestroy {
  private bridge: BridgyLite;

  constructor() {
    this.bridge = new BridgyLite({
      role: 'child',
      origins: ['https://parent-app.com'],
      debug: true,
      timeout: 60000
    });
  }

  connect(): void {
    this.bridge.connect();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.bridge.on('config-update', (data) => {
      console.log('Config updated:', data);
    });

    this.bridge.handle('get-status', async () => {
      return { ready: true, timestamp: Date.now() };
    });
  }

  async getAccessToken(): Promise<string> {
    const result = await this.bridge.request('get-token', {});
    return result.accessToken;
  }

  ngOnDestroy(): void {
    this.bridge.destroy();
  }
}
```

### React with BridgyLite

```typescript
// useBridge.ts
import { useEffect, useRef } from 'react';
import { BridgyLite } from '@monis01/iframe-bridge';

export function useBridge(config: BridgyLiteConfig) {
  const bridgeRef = useRef<BridgyLite>();

  useEffect(() => {
    const bridge = new BridgyLite(config);
    bridge.connect();
    bridgeRef.current = bridge;

    return () => bridge.destroy();
  }, []);

  return bridgeRef.current;
}

// Usage in component
function MyComponent() {
  const bridge = useBridge({
    role: 'child',
    origins: ['*'],
    debug: true
  });

  const handleGetToken = async () => {
    if (bridge) {
      const result = await bridge.request('get-token', {});
      console.log('Token:', result.token);
    }
  };

  return <button onClick={handleGetToken}>Get Token</button>;
}
```

### Vue with BridgyLite

```typescript
// useBridge.ts
import { ref, onMounted, onUnmounted } from 'vue';
import { BridgyLite, type BridgyLiteConfig } from '@monis01/iframe-bridge';

export function useBridge(config: BridgyLiteConfig) {
  const bridge = ref<BridgyLite>();
  const isConnected = ref(false);

  onMounted(() => {
    bridge.value = new BridgyLite(config);
    bridge.value.connect();
    isConnected.value = bridge.value.isConnected();
  });

  onUnmounted(() => {
    bridge.value?.destroy();
  });

  return { bridge, isConnected };
}
```

---

## 📊 Bundle Sizes

| Format | File | Bridgy (Full) | BridgyLite |
|--------|------|---------------|------------|
| **IIFE (CDN)** | `*.global.js` | **7.9 KB** | **5.0 KB** ✅ |
| **ESM (npm)** | `index.js` | 11.8 KB | - |
| **CJS (npm)** | `index.cjs` | 12.3 KB | - |
| **Types** | `index.d.ts` | 6.3 KB | - |

**Note:** For npm, both versions are exported from the same package. Bundlers (webpack/vite) tree-shake unused code, so you only pay for what you import.

---

## 📁 File Structure

```
dist/
├── bridgy.global.js           # Full Bridgy for CDN (7.9 KB)
├── bridgy-lite.global.js      # BridgyLite for CDN (5.0 KB) ⭐
├── index.js                   # ESM for npm (both versions)
├── index.cjs                  # CommonJS for npm (both versions)
├── index.d.ts                 # TypeScript types
└── *.map                      # Source maps

src/
├── index.ts                   # Main exports (both versions)
├── bridge.ts                  # Full Bridgy class
├── lite-bridge.ts             # BridgyLite class
├── types.ts                   # TypeScript interfaces
├── constants.ts               # Default values
├── logger.ts                  # Debug logger
└── utils.ts                   # Helpers
```

---

## 🔍 Debug Logging

Both versions have comprehensive debug logging:

```typescript
const bridge = new BridgyLite({
  role: 'child',
  origins: ['*'],
  debug: true  // ← Enable debug mode
});
```

**Console output:**
```
[BridgyLite]:child BridgyLite initialized {role: 'child'}
[BridgyLite]:child Connected
[BridgyLite]:child Handler registered {command: 'token-update', type: 'event'}
[BridgyLite]:child → REQUEST {command: 'get-token', id: 'req-abc123', timeout: 30000}
[BridgyLite]:child ← MESSAGE {origin: 'https://parent.com', hasCommand: true, isBridgy: true}
[BridgyLite]:child ← RESPONSE {replyTo: 'req-abc123'}
```

**Error cases:**
```
[BridgyLite]:child BLOCKED_ORIGIN {origin: 'https://evil.com', allowed: ['https://parent.com']}
[BridgyLite]:child REQUEST_TIMEOUT {command: 'slow-api', timeout: 5000, id: 'req-xyz'}
[BridgyLite]:child NO_COMMAND {data: {token: 'abc'}}
```

---

## 🌐 Communication Patterns

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

---

## 🔒 Security

Both versions validate origins:

```typescript
// Parent - whitelist specific origins
const bridge = new BridgyLite({
  role: 'parent',
  origins: [
    'https://child1.example.com',
    'https://child2.example.com'
  ]
});

// Child - specify parent origin
const bridge = new BridgyLite({
  role: 'child',
  origins: ['https://parent.example.com']
});

// Development only - allow any origin
const bridge = new BridgyLite({
  role: 'child',
  origins: ['*']  // ⚠️ Not recommended for production
});
```

---

## 🔄 Migration Guide

### From Full Bridgy to BridgyLite

```typescript
// Before (Full Bridgy)
const bridge = new Bridgy({
  role: 'child',
  origins: ['*'],
  skipHandshake: true,
  autoConnect: false,
  timeout: 30000
});

// After (BridgyLite)
const bridge = new BridgyLite({
  role: 'child',
  origins: ['*'],
  timeout: 30000
  // skipHandshake: removed (always skipped)
  // autoConnect: removed (always manual)
});

// Connect manually
bridge.connect();

// All other methods work the same!
bridge.request('get-token', {});
bridge.on('event', handler);
bridge.send('data', payload);
```

**What to remove:**
- ❌ `skipHandshake` (always true in BridgyLite)
- ❌ `autoConnect` (always false in BridgyLite)
- ❌ `mode` (always duplex in BridgyLite)
- ❌ `retries` (no handshake, no retries)
- ❌ `retryInterval` (no handshake, no retries)
- ❌ `ready()` / `onReady()` (connection is instant)

**What stays the same:**
- ✅ `request()` / `handle()`
- ✅ `send()` / `on()` / `off()`
- ✅ `isConnected()` / `destroy()`
- ✅ `debug` / timeout configuration

---

## 📦 TypeScript Support

Both versions are fully typed:

```typescript
import { BridgyLite, type BridgyLiteConfig } from '@monis01/iframe-bridge';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const bridge = new BridgyLite({
  role: 'child',
  origins: ['*']
});

// Typed request/response
const result = await bridge.request<{}, TokenResponse>('get-token', {});
console.log(result.accessToken); // ✅ Typed!

// Typed event handler
bridge.on<TokenResponse>('token-update', (data) => {
  console.log(data.expiresIn); // ✅ Typed!
});
```

---

## 🌍 Browser Support

Works in all modern browsers that support `postMessage`:
- ✅ Chrome, Firefox, Safari, Edge (latest)
- ✅ IE11 (with polyfills)

---

## 📝 License

MIT

---

## 🤝 Contributing

Issues and pull requests are welcome at [github.com/monis01/bridgy](https://github.com/monis01/bridgy)

---

## 📖 More Examples

See the [examples](./examples) directory for complete working examples with different frameworks.
