import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settings } from './deployed/verify.mjs';

test('deployed checks require explicit synthetic settings and a clean HTTPS origin', () => {
  const valid = { AUTH_VERIFY_ORIGIN: 'https://example.com', AUTH_VERIFY_SYNTHETIC: 'yes', AUTH_VERIFY_CREDENTIALS: 'private.json', AUTH_VERIFY_IDLE_SECONDS: '300' };
  assert.deepEqual(settings(valid), { origin: 'https://example.com', idle: 300 });
  for (const override of [
    { AUTH_VERIFY_SYNTHETIC: '' }, { AUTH_VERIFY_CREDENTIALS: '' },
    { AUTH_VERIFY_ORIGIN: 'http://example.com' }, { AUTH_VERIFY_ORIGIN: 'https://user:secret@example.com' },
    { AUTH_VERIFY_ORIGIN: 'https://example.com/path' }, { AUTH_VERIFY_IDLE_SECONDS: '0' },
    { AUTH_VERIFY_IDLE_SECONDS: '1.5' }, { AUTH_VERIFY_IDLE_SECONDS: '3601' },
  ]) assert.throws(() => settings({ ...valid, ...override }));
});
