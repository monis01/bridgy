# CLAUDE.md - Project Instructions for Claude Opus

## Project Overview

**Bridgy** (`@monis01/iframe-bridge`) is a lightweight, framework-agnostic TypeScript library that provides a universal iframe bridge for secure cross-window messaging. It enables seamless communication between parent windows and embedded iframes, supporting one-way and bidirectional messaging patterns.

- **Package Name:** `@monis01/iframe-bridge`
- **Repository:** https://github.com/monis01/bridgy
- **Current Version:** 1.1.3

## Tech Stack

- **Language:** TypeScript 5.9.3
- **Bundler:** tsup 8.5.0
- **Output Formats:** CommonJS, ES Modules, IIFE (UMD)
- **Runtime Dependency:** uuidv4 6.2.13

## Project Structure

```
bridgy/
├── src/
│   ├── index.ts        # Main entry point and public exports
│   ├── bridger.ts      # Core Bridger class (factory & registry)
│   ├── channel.ts      # Channel class (messaging implementation)
│   ├── types.ts        # TypeScript interfaces and type definitions
│   ├── constants.ts    # Message types and default values
│   └── utils.ts        # Utility functions (ID generation, origin validation)
├── dist/               # Build output (generated)
├── package.json
├── tsconfig.json
└── .github/workflows/  # CI/CD for npm publishing
```

## Key Components

### Bridger Class (`bridger.ts`)
Static factory and registry class that manages Channel instances:
- `Bridger.act(mode, config)` - Create and register a new channel
- `Bridger.get(instanceId)` - Retrieve existing channel by ID
- `Bridger.remove(instanceId)` - Unregister and cleanup a channel
- `Bridger.listInstanceIds()` - List all active channel IDs

### Channel Class (`channel.ts`)
Core messaging engine handling window communication:
- **Modes:** `sender` | `receiver` | `duplex`
- **Methods:** `send()`, `on()`, `off()`, `offAll()`, `getInstanceId()`
- Uses `window.postMessage()` API internally
- Supports origin whitelisting for security

### Types (`types.ts`)
- `BridgeMode` - Communication mode union type
- `ChannelConfig` - Channel configuration interface
- `PublicChannelAPI` - Public API interface
- `MessagePacket` - Internal message structure

### Constants (`constants.ts`)
- `BRIDGE_MESSAGE_TYPE` - Message identifier ('bridgy-message')
- `MSG_TYPES` - Message type constants (SYN, SYN_ACK, ACK, DATA, RESPONSE)
- `DEFAULT_TIMEOUT` - Default timeout value (10000ms)

## Build Commands

```bash
npm run build    # Build all formats (CJS, ESM, IIFE) with minification
npm publish      # Publish to npm registry
```

## Development Workflow

1. **Main Branch (`main`):** Production-ready code, triggers npm publish via CI/CD
2. **Dev Branch (`dev`):** Active development branch
3. **Build Output:** `dist/` directory contains compiled files

## Code Conventions

- **Strict TypeScript:** Project uses strict mode (`strict: true` in tsconfig)
- **Export Pattern:** Single entry point (`src/index.ts`) exports Bridger class and types
- **Registry Pattern:** Bridger uses Map-based registry to track channels
- **Handler Pattern:** Command-based event handlers with Set for multiple listeners

## API Usage Example

```typescript
// Parent window (sender)
const api = Bridger.act('sender', { instanceId: 'my-channel' });
api.send('theme-change', { theme: 'dark' });

// Child iframe (receiver)
const api = Bridger.act('receiver', {
  instanceId: 'my-channel',
  allowedOrigins: ['https://parent.com']
});
api.on('theme-change', (payload) => console.log(payload));

// Bidirectional (duplex)
const api = Bridger.act('duplex', {
  instanceId: 'my-channel',
  allowedOrigins: ['*']
});
```

## Important Notes

- Always validate origins in production (avoid `'*'` except for development)
- Each channel requires a unique `instanceId`
- Multiple handlers can be registered for the same command
- Use `off()` or `offAll()` for cleanup to prevent memory leaks
- The library is framework-agnostic and works with Angular, React, Vue, or vanilla JS

## Testing

Currently no test framework is configured. When adding tests:
- Consider using Vitest or Jest
- Mock `window.postMessage` and message events
- Test all three bridge modes (sender, receiver, duplex)

## CI/CD

GitHub Actions workflow (`.github/workflows/publish.yml`) automatically publishes to npm when changes are pushed to the `main` branch.
