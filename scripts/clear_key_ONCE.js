/* Execute locally to clear the stored DeepSeek Key. Never print it. */
'use strict';
(function () {
  if (typeof $persistentStore === 'undefined' || !$persistentStore ||
      typeof $persistentStore.write !== 'function') {
    throw new Error('Persistent store unavailable');
  }
  $persistentStore.write('', 'SAIRS_DEEPSEEK_API_KEY');
  if (typeof $done === 'function') $done();
})();
