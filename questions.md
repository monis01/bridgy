~~1. What is the difference between "on" function and "handle" function? is this over-engineered?~~
   - **Decision:** Keep both. `on/send` is pub/sub (fire-and-forget), `request/handle` is RPC with auto-correlation, timeout, and error propagation. Both patterns serve different needs.

~~2. Timeout feature, This is good to have but seems have issue like if a child application takes time to load, parent is quickly timed out than there is no way to establish the connection back with parent. Same isue will come with retry, so no point is using that as well. Should we pass parameter "strict" when parent gets initialized i.e. if "strict" is passed than timeout will be considered and if not than no timeout is needed. Or any other suggestion you have ?~~
   - **Decision:** Removed timeout from handshake (both parent and child wait indefinitely). Timeout now only applies to `request()` calls. Priority: `DEFAULTS.TIMEOUT` → `config.timeout` → `request({ timeout })`. Origin validation provides security, no `strict` param needed.

~~3. Custom Message passing / or registering specific message communication command at the time of initialization. There is a small issue i.e. Application A and Application B are different with each other. Now Application B has different set of needs, so should Application B pass generic event with a structured payload? or at the time of handshake child pass custom events to parent? or this is overengineered?~~
   - **Decision:** Library stays generic (transport-agnostic). No command registration needed. App developers agree on contract (events, payloads) beforehand. Payload is `unknown` - apps can use TypeScript generics for type safety if needed.

4. Parent : has this code 

    const bridge = new Bridger.Bridgy({
      role: 'parent',
      origins: ['http://localhost:4500'],
      timeout: 1000 * 20
    });
  
    bridge.handle('get-new-access-token', async (payload : any) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          return resolve("dasdsad");
      }, 1000 * 5);
    });
  })

  return resolve("dasdsad"); works and just resolve("dasdsad"); does not work. why. ??
   - **Deferred:** Will verify in test cases. Likely a JavaScript behavior issue (missing outer `return new Promise`), not library-related.

~~5. Should we create a success connection event at both sides? or maintain connection status as well?~~
   - **Decision:** Implemented the following:
     - `autoConnect` option (default: `true`) - set to `false` for manual control
     - Public `connect()` method returns Promise (success/error)
     - Limited auto-retry for child SYN: configurable `retries` (default: 5) and `retryInterval` (default: 2000ms)
     - Skipped `on('connected')` event - redundant with existing `ready()`/`onReady()`
   - **New API:**
     ```typescript
     const bridge = new Bridgy({ role: 'child', origins: [...], autoConnect: false });
     // Later...
     await bridge.connect(); // retries SYN up to 5 times, rejects if all fail
     ```

  
# 4. customize log feature (maybe) which will override the default one. (but check it should not increase the size of the file)
# 3. Mismatched IFrame error handling 
# 6. Versioning of the library
# 5. Check size of actual version of code and deployed version as well.