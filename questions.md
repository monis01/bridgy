1. What is the difefrence between "on" function and "handle" function
2. Timeout feature
3. Mismatched IFrame error handling 
4. customize log feature (maybe) which will override the default one. (but check it should not increase the size of the file)
5. Check size of actual version of code and deployed version as well.
6. Versioning of the library
7. Cutsom Message passing / or regtsering the specic message communication command

8. Parent : 
<!-- 
 console.log('[Synergy]:: BridgyService initialization initaing');
    this.bridge = new Bridger.Bridgy({
      role: 'parent',
      origins: ['http://localhost:4500'],
      timeout: 1000 * 20
    });
    console.log('[Synergy]:: BridgyService initialization inititated');

    this.bridge.handle('get-new-access-token', async (payload : any) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          return resolve("dasdsad");
      }, 1000 * 5);
      
    });
  }) -->