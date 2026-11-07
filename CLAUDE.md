# CLAUDE.md - Project Context for Claude

## Project Overview

**Bridgy** (`@monis01/iframe-bridge`) is a lightweight, framework-agnostic TypeScript library for secure cross-origin iframe communication.

- **Package:** `@monis01/iframe-bridge`
- **Repository:** https://github.com/monis01/bridgy
- **Bundle Size:** ~6.31 KB (IIFE)

## Core Principles

### What This Library Does
- Secure communication between parent window and child iframe
- 3-way handshake for connection establishment
- Fire-and-forget messaging, event subscription, request-response patterns
- Works with any framework (Angular, React, Vue, vanilla JS)

### Design Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Single class vs Parent/Child | **Single `Bridgy` class** | No code duplication, simpler API |
| Auto-connect vs explicit | **Auto-connect** | Industry standard, less boilerplate |
| Role detection | **Explicit `role` param** | Nested iframes (Parent→Child1→Child2) need explicit roles |
| Origins config | **Array** | Parent: whitelist multiple origins. Child: uses first |
| Message queueing | **Yes** | Non-blocking, no callback hell |

## Architecture

### File Structure
```
src/
├── index.ts      (16 lines)   - Exports
├── bridge.ts     (290 lines)  - Main Bridgy class
├── types.ts      (76 lines)   - TypeScript interfaces
├── constants.ts  (9 lines)    - Default values
├── logger.ts     (37 lines)   - Debug logger
└── utils.ts      (10 lines)   - Helpers

Total: ~438 lines
```

### Handshake Flow
```
Child (role: 'child')              Parent (role: 'parent')
        |                                    |
        |----------- SYN ------------------>|
        |<---------- SYN_ACK ---------------|
        |----------- ACK ------------------>|
        |========== CONNECTED ==============|
```

### Packet Structure
```typescript
interface BridgePacket {
  __bridgy: true;        // Marker to identify our messages
  type: PacketType;      // SYN, SYN_ACK, ACK, DATA, REQUEST, RESPONSE
  id: string;            // Unique packet ID
  timestamp: number;
  command?: string;      // For DATA/REQUEST
  payload?: unknown;     // Message data
  replyTo?: string;      // For RESPONSE (correlation)
  error?: string;        // For error responses
}
```

## Patterns (DO)

### 1. Single Class with Role
```typescript
// Parent
const bridge = new Bridgy({ role: 'parent', origins: ['https://child.com'] });

// Child
const bridge = new Bridgy({ role: 'child', origins: ['https://parent.com'] });
```

### 2. Non-blocking Usage
```typescript
const bridge = new Bridgy({ role: 'parent', origins: ['*'] });

// These work immediately - queued until connected
bridge.send('event', { data: 'value' });
bridge.on('response', handler);

// Optional: handle connection status
bridge.ready().then(...).catch(...);
```

### 3. Request-Response
```typescript
// Requester
const result = await bridge.request('get-data', { id: 1 });

// Handler
bridge.handle('get-data', async (payload) => {
  return await fetchData(payload.id);
});
```

### 4. Angular Service Pattern
```typescript
@Injectable({ providedIn: 'root' })
export class BridgeService {
  private bridge = new Bridgy({ role: 'parent', origins: [...] });

  send(cmd: string, data: any) { this.bridge.send(cmd, data); }
  on(cmd: string, handler: Function) { this.bridge.on(cmd, handler); }
}
```

## Anti-Patterns (DON'T)

### 1. ❌ Separate Parent/Child Classes
```typescript
// DON'T - duplicates code
class Parent { ... }
class Child { ... }

// DO - single class with role
class Bridgy { constructor({ role }) { ... } }
```

### 2. ❌ Callback Hell
```typescript
// DON'T
bridge.onReady(() => {
  bridge.send(...);
  bridge.on(..., () => {
    // nested...
  });
});

// DO - message queueing handles this
bridge.send(...);  // Works immediately, queued if not connected
bridge.on(...);
```

### 3. ❌ Over-Engineering
```typescript
// DON'T - too many abstractions
interface Logger { ... }
interface HandshakeController { ... }
interface PacketFactory { ... }
class SynPacket extends BasePacket { ... }
class SynAckPacket extends BasePacket { ... }

// DO - simple, direct
function createPacket(type) { return { __bridgy: true, type, ... }; }
```

### 4. ❌ Multiple Type Definitions
```typescript
// DON'T - 7 separate packet interfaces
interface SynPacket { type: 'SYN'; ... }
interface SynAckPacket { type: 'SYN_ACK'; ... }
// ...

// DO - single flexible interface
interface BridgePacket {
  type: PacketType;
  command?: string;
  payload?: unknown;
  // ...
}
```

### 5. ❌ Excessive Defensive Checks
```typescript
// DON'T
private assertConnected() { ... }
private assertCanSend() { ... }
private assertCanReceive() { ... }
private assertNotDestroyed() { ... }

// DO - simple inline checks
if (this.state !== 'connected' || !this.canSend()) return;
```

## API Reference

### Constructor
```typescript
new Bridgy({
  role: 'parent' | 'child',  // Required
  origins: string[],          // Required
  mode?: 'duplex' | 'push' | 'pull',  // Default: 'duplex'
  debug?: boolean,            // Default: false
  timeout?: number            // Default: 10000
})
```

### Methods
| Method | Description |
|--------|-------------|
| `send(cmd, payload?)` | Fire-and-forget |
| `on(cmd, handler)` | Subscribe to events |
| `off(cmd?, handler?)` | Unsubscribe |
| `request(cmd, payload?)` | Returns Promise |
| `handle(cmd, handler)` | Register request handler |
| `removeHandler(cmd)` | Remove handler |
| `ready()` | Promise for connection |
| `onReady(callback)` | Callback for connection |
| `isConnected()` | Boolean |
| `getState()` | ConnectionState |
| `enableDebug()` | Turn on logging |
| `disableDebug()` | Turn off logging |
| `destroy()` | Cleanup |

## Build & Distribution

### Build Command
```bash
npm run build
```

### Output
```
dist/
├── index.js          (CJS)     - 6.33 KB
├── index.mjs         (ESM)     - 5.85 KB
├── index.global.js   (IIFE)    - 6.31 KB  ← For CDN/S3
├── index.d.ts        (Types)   - 3.74 KB
└── *.map             (Sourcemaps)
```

### Usage
```typescript
// npm (TypeScript/bundlers)
import { Bridgy } from '@monis01/iframe-bridge';

// Script tag (browser)
<script src="bridgy.min.js"></script>
new Bridger.Bridgy({ ... });
```

## Key Learnings

1. **Keep it simple** - A library should be easy to understand and maintain
2. **No premature abstraction** - Don't create interfaces/factories until needed
3. **Single responsibility** - One class doing one thing well
4. **Message queueing** - Eliminates timing issues and callback hell
5. **Explicit over magic** - User specifies role, no auto-detection for edge cases
