<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/monis01/bridgy@main/logo.svg" alt="Bridgy — secure iframe messaging" width="520"/>
</p>

<p align="center">
  Tiny, typed, framework-agnostic messaging between a page and its iframes.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/BridgyLite-6.6kb-green" alt="BridgyLite size"/>
  <img src="https://img.shields.io/badge/Bridgy-7.9kb-blue" alt="Bridgy size"/>
  <img src="https://img.shields.io/badge/typescript-ready-brightgreen" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License"/>
</p>

Bridgy wraps `postMessage` so you can **send events** and **make requests that return a Promise** across the iframe boundary, with origin checks built in. Works with Angular, React, Vue or plain JS.

## Install

```bash
npm install @monis01/iframe-bridge
```

Or with a script tag:

```html
<script src="https://unpkg.com/@monis01/iframe-bridge/dist/bridgy-lite.global.js"></script>
<!-- exposes BridgerLite.BridgyLite and BridgyLog -->
```

## Quick start

**Parent page** (contains the iframe):

```ts
import { BridgyLite } from '@monis01/iframe-bridge';

const bridge = new BridgyLite({ role: 'parent', origins: ['https://child.example.com'] });
bridge.connect();

bridge.handle('get-user', async ({ id }) => {
  return await fetchUser(id);           // returned value goes back to the child
});
```

**Child page** (inside the iframe):

```ts
import { BridgyLite } from '@monis01/iframe-bridge';

const bridge = new BridgyLite({ role: 'child', origins: ['https://parent.example.com'] });
bridge.connect();

const user = await bridge.request('get-user', { id: 42 });

bridge.send('clicked', { button: 'save' });          // fire-and-forget
bridge.on('theme-changed', (theme) => apply(theme)); // listen
```

> **Good to know:** the parent learns which iframe to talk to from the child's messages, so the **child should speak first** (a `request` or `send`). After that, the parent can `send` freely.

## Which one should I use?

| | **BridgyLite** (recommended) | **Bridgy** (full) |
|---|---|---|
| Size (CDN) | 6.6 KB | 7.9 KB |
| Connect | `connect()` — instant | Automatic 3-way handshake with retries |
| Before connected | Messages are dropped | Messages are queued |
| Other side must use Bridgy? | No — plain `postMessage` works | Yes (unless `skipHandshake: true`) |
| Runtime debug toggle (`BridgyLog`) | ✅ | ❌ |

## BridgyLite API

```ts
new BridgyLite({
  role: 'parent' | 'child',  // required
  origins: string[],         // required — allowed origins; the child posts to origins[0]
  label?: string,            // name shown in logs, default 'Bridgy'
  debug?: boolean,           // print logs to the console, default false
  timeout?: number,          // request timeout in ms, default 30000
  redact?: string[],         // commands whose payloads are hidden in logs
});
```

| Method | What it does |
|---|---|
| `connect()` | Start listening. The child throws if it isn't inside an iframe. |
| `request(cmd, payload?, { timeout? })` | Ask the other side; resolves with its answer, rejects on error or timeout. |
| `handle(cmd, fn)` | Answer requests. `fn` may be async; a thrown error rejects the caller. |
| `send(cmd, payload?)` | Fire-and-forget event. |
| `on(cmd, fn)` / `off(cmd?, fn?)` | Subscribe / unsubscribe to events. |
| `isConnected()` | `true` after `connect()`. |
| `destroy()` | Remove listeners and reject pending requests. |

Everything is typed — pass generics when you want typed payloads:

```ts
const res = await bridge.request<{ id: number }, User>('get-user', { id: 42 });
```

### Talking to a parent that doesn't use Bridgy

A BridgyLite child also accepts plain messages. Any object with a `command`, `type` or `event` field triggers the matching `on()` handler with the whole object:

```js
// parent, no library
iframe.contentWindow.postMessage({ command: 'token-update', token: 'abc' }, 'https://child.example.com');

// child
bridge.on('token-update', (msg) => console.log(msg.token));
```

## Full Bridgy

Same messaging API (`send`, `on`, `off`, `request`, `handle`) plus a handshake, so you don't call `connect()` and can send before the other side is ready:

```ts
import { Bridgy } from '@monis01/iframe-bridge';

const bridge = new Bridgy({ role: 'child', origins: ['https://parent.example.com'] });
bridge.send('hello');                 // queued until connected
await bridge.ready();                 // optional: wait for the handshake
```

Extra options: `mode` (`'duplex' | 'push' | 'pull'`), `autoConnect` (default `true`), `retries` (5), `retryInterval` (2000 ms), `skipHandshake` (`false`), `timeout` (10000 ms). Extra methods: `ready()`, `onReady(cb)`, `getState()`, `removeHandler(cmd)`, `enableDebug()`, `disableDebug()`.

CDN build: `dist/bridgy.global.js`, exposed as `Bridger.Bridgy`.

## Debugging

Turn on logs with `debug: true`, or at runtime from the browser console — no redeploy needed:

```js
BridgyLog.list()            // show bridge labels on this page
BridgyLog.enable('MyApp')   // print the last 50 events for that label, then log live
BridgyLog.enable()          // all bridges
BridgyLog.disable()         // stop
```

The setting is remembered in `localStorage`, so it survives page reloads. Use `redact` to keep sensitive payloads (tokens, etc.) out of the logs.

## Security

Always list exact origins. `'*'` accepts messages from any site and is only for local development.

## License

MIT · Issues and pull requests welcome at [github.com/monis01/bridgy](https://github.com/monis01/bridgy).
