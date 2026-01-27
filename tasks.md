# Bridgy - Implementation Tasks

## Summary

| Phase | Status | Tasks |
|-------|--------|-------|
| Phase 1: Core Implementation | ✅ Complete | 10/10 |
| Phase 2: Testing | ⏳ Pending | 0/5 |
| Phase 3: Build & Distribution | ⏳ Pending | 0/4 |
| Phase 4: Documentation | 🔄 Partial | 2/3 |

---

## Phase 1: Core Implementation ✅

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Define type system | ✅ Done | Single `BridgePacket` interface, minimal types |
| 2 | Implement handshake | ✅ Done | SYN → SYN_ACK → ACK (inside Bridgy class) |
| 3 | Implement single Bridgy class | ✅ Done | Replaced separate Parent/Child classes |
| 4 | Implement `send()` | ✅ Done | Fire-and-forget with queueing |
| 5 | Implement `on()`/`off()` | ✅ Done | Event subscription |
| 6 | Implement `request()`/`handle()` | ✅ Done | Promise-based request-response |
| 7 | Implement message queueing | ✅ Done | Non-blocking, messages queued until connected |
| 8 | Implement debug system | ✅ Done | `enableDebug()`/`disableDebug()` |
| 9 | Implement `destroy()` | ✅ Done | Cleanup listeners, pending requests |
| 10 | Export types/interfaces | ✅ Done | All public types in index.ts |

### Refactoring Done
- ❌ Removed: Separate `Parent`/`Child` classes (code duplication)
- ❌ Removed: `handshake.ts` (merged into `bridge.ts`)
- ❌ Removed: Over-engineered type system (15+ interfaces → 6)
- ❌ Removed: Controller patterns, factory abstractions
- ✅ Added: Message queueing (non-blocking)
- ✅ Added: Single `Bridgy` class with `role` parameter

---

## Phase 2: Testing ⏳

| # | Task | Status | Description |
|---|------|--------|-------------|
| 11 | Set up Vitest | ⏳ Pending | Configure for unit testing |
| 12 | Unit tests - handshake | ⏳ Pending | Test SYN/ACK flow, timeouts, errors |
| 13 | Unit tests - messaging | ⏳ Pending | Test send, on, off, request |
| 14 | Set up Playwright | ⏳ Pending | Configure for E2E iframe testing |
| 15 | E2E tests | ⏳ Pending | Real iframe parent-child communication |

---

## Phase 3: Build & Distribution ⏳

| # | Task | Status | Description |
|---|------|--------|-------------|
| 16 | Update tsup config | ⏳ Pending | Optimize bundle, rename output |
| 17 | GitHub Actions CI | ⏳ Pending | Run tests on PR/push |
| 18 | Private npm publish | ⏳ Pending | GitHub Action for npm publish |
| 19 | S3 + CloudFront setup | ⏳ Pending | Deploy IIFE bundle to CDN |

---

## Phase 4: Documentation 🔄

| # | Task | Status | Description |
|---|------|--------|-------------|
| 20 | README.md | ✅ Done | API docs, examples, logo |
| 21 | CLAUDE.md | ✅ Done | Patterns, anti-patterns, architecture |
| 22 | Framework examples | ⏳ Pending | Angular service, React hook patterns |

---

## Current File Structure

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

## Bundle Sizes

| Format | Size |
|--------|------|
| IIFE (CDN) | **6.31 KB** |
| ESM | **5.85 KB** |
| CJS | **6.33 KB** |
| Types | **3.74 KB** |

---

## Deleted Files (Over-engineering cleanup)

- `src/host.ts` - Replaced by single `Bridgy` class
- `src/guest.ts` - Replaced by single `Bridgy` class
- `src/parent.ts` - Replaced by single `Bridgy` class
- `src/child.ts` - Replaced by single `Bridgy` class
- `src/handshake.ts` - Merged into `bridge.ts`
- `src/bridger.ts` - Legacy, removed
- `src/channel.ts` - Legacy, removed

---

## Next Steps

1. **Phase 2** - Set up Vitest, write unit tests
2. **Phase 3** - CI/CD pipeline, npm publish, CDN deployment
3. **Phase 4** - Add framework-specific examples to README
