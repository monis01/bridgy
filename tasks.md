# Bridgy - Implementation Tasks

## Phase 1: Core Implementation

| # | Task | Status | Description |
|---|------|--------|-------------|
| 1 | Define type system | ✅ Done | `HostConfig`, `GuestConfig`, `BridgeAPI`, `BridgePacket` interfaces |
| 2 | Implement handshake | ✅ Done | SYN → SYN_ACK → ACK mechanism with timeout |
| 3 | Implement Host class | ✅ Done | Parent side: waits for child connection |
| 4 | Implement Guest class | ✅ Done | Child side: initiates handshake |
| 5 | Implement `send()` | ✅ Done | Fire-and-forget messaging (in Host) |
| 6 | Implement `on()`/`off()` | ✅ Done | Event subscription system (in Host) |
| 7 | Implement `request()` | ✅ Done | Promise-based request-response (in Host) |
| 8 | Implement debug system | ✅ Done | Logging with `enableDebug()`/`disableDebug()` |
| 9 | Implement `destroy()` | ✅ Done | Cleanup listeners, close connection (in Host) |
| 10 | Export types/interfaces | ✅ Done | All public types exported in index.ts |

## Phase 2: Testing

| # | Task | Status | Description |
|---|------|--------|-------------|
| 11 | Set up Vitest | ⏳ Pending | Configure for unit testing |
| 12 | Unit tests - handshake | ⏳ Pending | Test SYN/ACK flow, timeouts, errors |
| 13 | Unit tests - messaging | ⏳ Pending | Test send, on, off, request |
| 14 | Set up Playwright | ⏳ Pending | Configure for E2E iframe testing |
| 15 | E2E tests | ⏳ Pending | Real iframe parent-child communication |

## Phase 3: Build & Distribution

| # | Task | Status | Description |
|---|------|--------|-------------|
| 16 | Update tsup config | ⏳ Pending | Optimize bundle, ensure all formats |
| 17 | GitHub Actions CI | ⏳ Pending | Run tests on PR/push |
| 18 | Private npm publish | ⏳ Pending | GitHub Action for npm publish |
| 19 | S3 + CloudFront setup | ⏳ Pending | Deploy IIFE bundle to CDN |

## Phase 4: Documentation

| # | Task | Status | Description |
|---|------|--------|-------------|
| 20 | Update README | ⏳ Pending | New API docs, examples |
| 21 | Update CLAUDE.md | ⏳ Pending | Reflect final implementation |

---

## Files Created/Modified

### New Files
- `src/types.ts` - Complete type system
- `src/handshake.ts` - Handshake mechanism
- `src/host.ts` - Host (parent) implementation
- `src/logger.ts` - Debug logging
- `src/guest.ts` - Guest (child) implementation (P1_T4)

### Modified Files
- `src/constants.ts` - Updated constants
- `src/index.ts` - Updated exports
- `src/bridger.ts` - Removed unused imports

### Legacy Files (to be deprecated)
- `src/channel.ts` - Old channel implementation
- `src/bridger.ts` - Old Bridger class
