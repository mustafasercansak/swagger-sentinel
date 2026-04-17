'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateSecurity } = require('../../src/validators/security');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(overrides = {}) {
  return Object.assign({
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {},
  }, overrides);
}

// SEC90
test('SEC90 passes when securitySchemes defined', () => {
  const s = spec({ components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } } });
  assert.equal(check(validateSecurity(s), 'SEC90').passed, true);
});

test('SEC90 fails when no securitySchemes', () => {
  const r = check(validateSecurity(spec()), 'SEC90');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'warning');
});

// SEC91
test('SEC91 passes when apiKey is in header', () => {
  const s = spec({ components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } } });
  assert.equal(check(validateSecurity(s), 'SEC91').passed, true);
});

test('SEC91 fails when apiKey is in query', () => {
  const s = spec({ components: { securitySchemes: { apiKey: { type: 'apiKey', in: 'query', name: 'api_key' } } } });
  const r = check(validateSecurity(s), 'SEC91');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

// SEC93
test('SEC93 passes when password field is writeOnly', () => {
  const s = spec({
    components: {
      schemas: { User: { properties: { password: { type: 'string', writeOnly: true } } } },
    },
  });
  assert.equal(check(validateSecurity(s), 'SEC93').passed, true);
});

test('SEC93 fails when password field is not writeOnly', () => {
  const s = spec({
    components: {
      schemas: { User: { properties: { password: { type: 'string' } } } },
    },
  });
  assert.equal(check(validateSecurity(s), 'SEC93').passed, false);
});

// SEC95
test('SEC95 passes for https server', () => {
  const s = spec({ servers: [{ url: 'https://api.example.com' }] });
  assert.equal(check(validateSecurity(s), 'SEC95').passed, true);
});

test('SEC95 passes for localhost http', () => {
  const s = spec({ servers: [{ url: 'http://localhost:3000' }] });
  assert.equal(check(validateSecurity(s), 'SEC95').passed, true);
});

test('SEC95 fails for plain http production server', () => {
  const s = spec({ servers: [{ url: 'http://api.example.com' }] });
  const r = check(validateSecurity(s), 'SEC95');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

// SEC96
test('SEC96 passes when OAuth2 flow has scopes', () => {
  const s = spec({
    components: {
      securitySchemes: {
        oauth: {
          type: 'oauth2',
          flows: { clientCredentials: { tokenUrl: '/token', scopes: { 'read:items': 'Read items' } } },
        },
      },
    },
  });
  assert.equal(check(validateSecurity(s), 'SEC96').passed, true);
});

test('SEC96 fails when OAuth2 flow has no scopes', () => {
  const s = spec({
    components: {
      securitySchemes: {
        oauth: {
          type: 'oauth2',
          flows: { clientCredentials: { tokenUrl: '/token', scopes: {} } },
        },
      },
    },
  });
  assert.equal(check(validateSecurity(s), 'SEC96').passed, false);
});

// SEC97
test('SEC97 passes when secured op has 401', () => {
  const s = spec({
    security: [{ bearer: [] }],
    paths: { '/items': { get: { responses: { '200': { description: 'ok' }, '401': { description: 'unauth' } } } } },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  });
  assert.equal(check(validateSecurity(s), 'SEC97').passed, true);
});

test('SEC97 fails when secured op missing 401', () => {
  const s = spec({
    security: [{ bearer: [] }],
    paths: { '/items': { get: { responses: { '200': { description: 'ok' } } } } },
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
  });
  assert.equal(check(validateSecurity(s), 'SEC97').passed, false);
});

// SEC99
test('SEC99 passes for normal server URL', () => {
  const s = spec({ servers: [{ url: 'https://api.example.com' }] });
  assert.equal(check(validateSecurity(s), 'SEC99').passed, true);
});

test('SEC99 fails when credentials in server URL', () => {
  const s = spec({ servers: [{ url: 'https://user:pass@api.example.com' }] });
  const r = check(validateSecurity(s), 'SEC99');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

// SEC100
test('SEC100 passes when no basic auth scheme', () => {
  const s = spec({ components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } } });
  assert.equal(check(validateSecurity(s), 'SEC100').passed, true);
});

test('SEC100 fails when basic auth scheme is used', () => {
  const s = spec({ components: { securitySchemes: { basic: { type: 'http', scheme: 'basic' } } } });
  const r = check(validateSecurity(s), 'SEC100');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'warning');
});
