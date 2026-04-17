'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePaths } = require('../../src/validators/paths');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(paths, extra = {}) {
  return Object.assign({ openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths }, extra);
}

// P15 kebab-case
test('P15 passes for kebab-case paths', () => {
  const r = check(validatePaths(spec({ '/api/v1/user-items': {} })), 'P15');
  assert.equal(r.passed, true);
});

test('P15 fails for camelCase path segment', () => {
  const r = check(validatePaths(spec({ '/api/v1/userItems': {} })), 'P15');
  assert.equal(r.passed, false);
});

test('P15 fails for snake_case path segment', () => {
  const r = check(validatePaths(spec({ '/api/v1/user_items': {} })), 'P15');
  assert.equal(r.passed, false);
});

// P16 trailing slashes
test('P16 passes when no trailing slash', () => {
  const r = check(validatePaths(spec({ '/items': {} })), 'P16');
  assert.equal(r.passed, true);
});

test('P16 fails when trailing slash present', () => {
  const r = check(validatePaths(spec({ '/items/': {} })), 'P16');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

// P17 plural naming
test('P17 passes for plural resource', () => {
  const r = check(validatePaths(spec({ '/items/{itemId}': {} })), 'P17');
  assert.equal(r.passed, true);
});

test('P17 flags singular resource before path param', () => {
  const r = check(validatePaths(spec({ '/item/{itemId}': {} })), 'P17');
  assert.equal(r.passed, false);
});

// P18 nesting depth
test('P18 passes for shallow nesting', () => {
  const r = check(validatePaths(spec({ '/a/{id}/b/{bid}': {} })), 'P18');
  assert.equal(r.passed, true);
});

test('P18 fails for deep nesting (4 path params)', () => {
  const r = check(validatePaths(spec({ '/a/{aId}/b/{bId}/c/{cId}/d/{dId}': {} })), 'P18');
  assert.equal(r.passed, false);
});

// P22 empty segments
test('P22 fails for double slash', () => {
  const r = check(validatePaths(spec({ '/items//sub': {} })), 'P22');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

// P23 path params documented
test('P23 passes when path param is documented', () => {
  const s = spec({
    '/items/{id}': {
      get: {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validatePaths(s), 'P23').passed, true);
});

test('P23 fails when path param is not documented', () => {
  const s = spec({ '/items/{id}': { get: { parameters: [], responses: {} } } });
  assert.equal(check(validatePaths(s), 'P23').passed, false);
});

// P24 no verb in path
test('P24 passes when no verb in path segments', () => {
  const r = check(validatePaths(spec({ '/api/v1/items': {} })), 'P24');
  assert.equal(r.passed, true);
});

test('P24 fails when verb segment present', () => {
  const r = check(validatePaths(spec({ '/api/v1/create': {} })), 'P24');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'warning');
});

test('P24 fails for "list" segment', () => {
  const r = check(validatePaths(spec({ '/api/v1/list': {} })), 'P24');
  assert.equal(r.passed, false);
});

// P25 consistent param casing
test('P25 passes when all params are camelCase', () => {
  const s = spec({
    '/items/{itemId}': {
      get: {
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validatePaths(s), 'P25').passed, true);
});

test('P25 fails when camelCase and snake_case mixed', () => {
  const s = spec({
    '/a/{itemId}': {
      get: {
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
    '/b/{item_id}': {
      get: {
        parameters: [{ name: 'item_id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validatePaths(s), 'P25').passed, false);
});
