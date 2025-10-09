const test = require('node:test');
const assert = require('node:assert/strict');

const { checkCertificate } = require('../cert-checker');

test('checkCertificate requires a URL', async () => {
  await assert.rejects(checkCertificate(), {
    message: 'URL is required'
  });
});

test('checkCertificate rejects invalid URLs', async () => {
  await assert.rejects(checkCertificate('notaurl'), {
    message: 'Invalid URL'
  });
});

test('checkCertificate rejects unsupported protocols', async () => {
  await assert.rejects(checkCertificate('ftp://example.com'), {
    message: 'Only HTTP/HTTPS URLs are supported'
  });
});
