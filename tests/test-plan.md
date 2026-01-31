# Bridgy Unit Test Plan

## 1. Constructor & Initialization

- [ ] Creates instance with required config (role, origins)
- [ ] Applies default values for optional config (mode, debug, timeout, autoConnect, retries, retryInterval)
- [ ] Auto-connects when `autoConnect: true` (default)
- [ ] Does NOT auto-connect when `autoConnect: false`
- [ ] State is `disconnected` before connect
- [ ] State is `connecting` after connect called

## 2. Connection - Child Role

- [ ] Rejects with error when not in iframe (window.parent === window)
- [ ] Sends SYN packet on connect
- [ ] Responds with ACK after receiving SYN_ACK
- [ ] State becomes `connected` after handshake
- [ ] `ready()` promise resolves on successful connection
- [ ] Retries SYN up to `retries` times
- [ ] Rejects after max retries reached
- [ ] Stops retrying once connected
- [ ] Ignores messages from wrong origin
- [ ] Ignores non-bridgy packets

## 3. Connection - Parent Role

- [ ] Waits for SYN from child
- [ ] Responds with SYN_ACK after receiving SYN
- [ ] State becomes `connected` after receiving ACK
- [ ] `ready()` promise resolves on successful connection
- [ ] Ignores SYN from disallowed origins
- [ ] Ignores non-bridgy packets
- [ ] Handles multiple SYN retries from child (idempotent)

## 4. Public `connect()` Method

- [ ] Returns promise that resolves on connection
- [ ] Returns same promise if already connecting
- [ ] Returns resolved promise if already connected
- [ ] Works with `autoConnect: false`

## 5. Message Sending - `send()`

- [ ] Sends DATA packet with command and payload
- [ ] Queues messages if not connected
- [ ] Flushes queue on connection
- [ ] Does nothing in `pull` mode
- [ ] Works in `duplex` and `push` modes

## 6. Message Receiving - `on()` / `off()`

- [ ] Registers handler for command
- [ ] Handler receives payload and MessageEvent
- [ ] Multiple handlers for same command
- [ ] `off()` with no args clears all handlers
- [ ] `off(command)` clears all handlers for command
- [ ] `off(command, handler)` removes specific handler
- [ ] Does nothing in `push` mode
- [ ] Works in `duplex` and `pull` modes

## 7. Request/Response - `request()`

- [ ] Sends REQUEST packet
- [ ] Resolves with response payload
- [ ] Rejects on timeout
- [ ] Rejects with error message from response
- [ ] Per-request timeout override works
- [ ] Uses default timeout from config
- [ ] Does nothing in `pull` mode

## 8. Request/Response - `handle()`

- [ ] Registers handler for command
- [ ] Handler receives payload and MessageEvent
- [ ] Sends RESPONSE with handler return value
- [ ] Sends error RESPONSE when handler throws
- [ ] Sends error RESPONSE when no handler registered
- [ ] Async handlers work correctly
- [ ] Does nothing in `push` mode

## 9. Origin Validation

- [ ] Parent validates origin against `origins` array
- [ ] Child validates origin against first origin or `*`
- [ ] Wildcard `*` allows any origin
- [ ] Messages from invalid origins are ignored

## 10. Mode Restrictions

- [ ] `duplex` mode: can send and receive
- [ ] `push` mode: can only send
- [ ] `pull` mode: can only receive

## 11. State & Status Methods

- [ ] `isConnected()` returns correct boolean
- [ ] `getState()` returns current state
- [ ] `ready()` returns promise
- [ ] `onReady()` calls callback when connected

## 12. Debug Logging

- [ ] `enableDebug()` turns on logging
- [ ] `disableDebug()` turns off logging
- [ ] Debug logs show send/recv packets

## 13. Cleanup - `destroy()`

- [ ] Removes message event listeners
- [ ] Clears retry timer
- [ ] Clears handshake handler
- [ ] Clears event handlers
- [ ] Clears request handlers
- [ ] Rejects pending requests with "Destroyed" error
- [ ] Clears message queue
- [ ] Sets state to `disconnected`

## 14. Packet Validation

- [ ] `isBridgePacket()` returns true for valid packets
- [ ] `isBridgePacket()` returns false for non-objects
- [ ] `isBridgePacket()` returns false for objects without `__bridgy`
- [ ] Ignores packets without `__bridgy: true` marker

## 15. Edge Cases

- [ ] Multiple `connect()` calls are idempotent
- [ ] `send()` before connection queues message
- [ ] `request()` before connection queues request
- [ ] Handles rapid connect/destroy cycles
- [ ] Handles duplicate SYN_ACK packets gracefully

---

# E2E Test Plan (Playwright)

> These tests run in real browser with actual parent page + child iframe.

## 1. Basic Connection

- [ ] Parent and child establish connection successfully
- [ ] Handshake completes (SYN → SYN_ACK → ACK)
- [ ] Both sides report `connected` state
- [ ] `ready()` resolves on both sides

## 2. Connection with Delays

- [ ] Child connects when parent is already waiting
- [ ] Parent initialized after child (retry mechanism works)
- [ ] Slow-loading child iframe still connects
- [ ] Connection succeeds after network delay simulation

## 3. Connection Failures

- [ ] Child fails after max retries when parent never responds
- [ ] Error message is correct on failure
- [ ] Child not in iframe shows appropriate error

## 4. Origin Validation (Security)

- [ ] Parent rejects child from disallowed origin
- [ ] Child rejects messages from wrong origin
- [ ] Wildcard `*` origin allows any connection
- [ ] Multiple allowed origins work correctly

## 5. Fire-and-Forget Messaging (`send`/`on`)

- [ ] Parent sends message, child receives
- [ ] Child sends message, parent receives
- [ ] Payload data is preserved correctly
- [ ] Multiple subscribers receive same message
- [ ] Messages queued before connection are delivered

## 6. Request/Response (`request`/`handle`)

- [ ] Parent requests data from child, receives response
- [ ] Child requests data from parent, receives response
- [ ] Async handler returns correct value
- [ ] Handler error is propagated to requester
- [ ] Missing handler returns error response
- [ ] Request timeout works correctly
- [ ] Multiple concurrent requests resolve correctly

## 7. Bidirectional Communication

- [ ] Both sides can send and receive simultaneously
- [ ] No message loss under rapid messaging
- [ ] Order of messages is preserved

## 8. Mode Restrictions

- [ ] `push` mode: parent can send, cannot receive
- [ ] `pull` mode: parent can receive, cannot send
- [ ] `duplex` mode: full bidirectional works

## 9. Manual Connection (`autoConnect: false`)

- [ ] Bridge doesn't connect on instantiation
- [ ] `connect()` initiates connection
- [ ] Connection succeeds after explicit `connect()` call
- [ ] Can set up handlers before connecting

## 10. Reconnection Scenarios

- [ ] Child iframe reload establishes new connection
- [ ] `destroy()` + new instance works
- [ ] Parent survives child iframe navigation

## 11. Multiple Iframes

- [ ] Parent communicates with multiple child iframes
- [ ] Each child has independent connection
- [ ] Messages go to correct child

## 12. Cleanup (`destroy`)

- [ ] No memory leaks after destroy
- [ ] No console errors after destroy
- [ ] Pending requests rejected on destroy
- [ ] Event listeners removed on destroy

## 13. Debug Logging

- [ ] Debug mode shows handshake packets
- [ ] Debug mode shows send/recv messages
- [ ] `enableDebug()`/`disableDebug()` toggle works at runtime

## 14. Real-World Scenarios

- [ ] Token refresh flow (child requests token from parent)
- [ ] Parent notifies child of user logout
- [ ] Child notifies parent to navigate/reload
- [ ] Large payload transfer (JSON objects)
- [ ] Rapid message bursts (stress test)
