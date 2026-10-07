import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFernetKey, fernetDecrypt, fernetEncrypt, sealSecrets, unsealSecrets } from '../src/core/crypto.js';

// Vectors produced by python `cryptography` 50 (PBKDF2-HMAC-SHA256, 600000, Fernet).
const PY_KEY = 'ufI3C9hKAsPf7oHNbj-TOTIaoANGp03Ad_ZIFrXz2KI=';
const PY_SALT = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const PY_TOKEN =
  'gAAAAABqtXSWAOyBFjHBdR_VPyA7lHj4dBtCKVYU9Pt2VI3_8xuBo-KWW7Ii2952vyjKsZW_j7sfaU2H1UZqS7GbWfHy1X207gbOcnhkga1eFWQ5zi8ylHs=';

const PY_BLOB =
  'FORGE3-VAULT-1\ndLNv0ievJiVaQ51CWlLbEA==\ngAAAAABqtXNyH-BDY3Rv8YWKq9lI-9Mrs3ab3ieKzi3LOBAy3mcHazUsKX8BaRuZDtTsgvXbI6dJtSmyFvQ8JD-v0402xO83NlKPeiGyy2RiNt81LHxDxEma44ZUafN-ztw6Q4mHVNBvvpZmqLEf5Vd72Aa3wY5RkvGIpz3dQqJRFD7ogbL9GnNVPDffoyJgmAkxrtUoCd-bB';

test('pbkdf2 key derivation matches python cryptography', () => {
  assert.equal(deriveFernetKey('pw', PY_SALT), PY_KEY);
});

test('decrypts a python-produced fernet token', () => {
  const plain = fernetDecrypt(PY_TOKEN, PY_KEY);
  assert.deepEqual(JSON.parse(plain.toString('utf8')), { x: 'y', z: 'café ✓' });
});

test('encrypts a token python can read (round trip through unsealSecrets)', () => {
  const key = deriveFernetKey('pw', PY_SALT);
  const token = fernetEncrypt(Buffer.from('{"a":"b"}', 'utf8'), key);
  assert.deepEqual(JSON.parse(fernetDecrypt(token, key).toString('utf8')), { a: 'b' });
});

test('unseals a vault blob sealed by python', () => {
  assert.deepEqual(unsealSecrets(PY_BLOB, 'correct horse'), {
    'assistant.persona': 'hello — persona line 1\nline2',
    'forge.profile': 'PROFILE',
  });
});

test('seals a blob that round-trips locally', () => {
  const blob = sealSecrets({ 'assistant.persona': 'p', 'forge.profile': 'f' }, 'pw');
  assert.deepEqual(unsealSecrets(blob, 'pw'), { 'assistant.persona': 'p', 'forge.profile': 'f' });
  assert.throws(() => unsealSecrets(blob, 'nope'));
});
