/*
 * ONE-TIME LOCAL MANUAL SCRIPT ONLY.
 * Edit the placeholder ONLY in a temporary local copy on your iPhone.
 * Never commit a real API Key, upload this edited file, or put the key in a URL.
 * Stop if your Shadowrocket version has no verified local script execution UI.
 */
'use strict';
(function () {
  var key = 'REPLACE_WITH_YOUR_DEEPSEEK_API_KEY';
  if (key.indexOf('REPLACE_WITH') >= 0 || key.length < 12) {
    throw new Error('Replace placeholder ONLY in a local temporary copy');
  }
  if (typeof $persistentStore === 'undefined' || !$persistentStore ||
      typeof $persistentStore.write !== 'function') {
    throw new Error('Shadowrocket persistent store not available');
  }
  if (!$persistentStore.write(key, 'SAIRS_DEEPSEEK_API_KEY')) {
    throw new Error('Persistent store write failed');
  }
  if (typeof $done === 'function') $done(); // do not log or notify the key
})();
