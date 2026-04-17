'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateOperations } = require('../../src/validators/operations');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(paths, extra = {}) {
  return Object.assign({ openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths }, extra);
}

// O31 operationId required
test('O31 passes when operationId present', () => {
  const s = spec({ '/items': { get: { operationId: 'listItems', responses: {} } } });
  assert.equal(check(validateOperations(s), 'O31').passed, true);
});

test('O31 fails when operationId missing', () => {
  const s = spec({ '/items': { get: { responses: {} } } });
  assert.equal(check(validateOperations(s), 'O31').passed, false);
});

// O31b duplicate operationIds
test('O31b passes for unique operationIds', () => {
  const s = spec({
    '/items': { get: { operationId: 'listItems', responses: {} } },
    '/items/{id}': { get: { operationId: 'getItem', responses: {} } },
  });
  assert.equal(check(validateOperations(s), 'O31b').passed, true);
});

test('O31b fails for duplicate operationIds', () => {
  const s = spec({
    '/items': { get: { operationId: 'getItems', responses: {} } },
    '/items/{id}': { get: { operationId: 'getItems', responses: {} } },
  });
  assert.equal(check(validateOperations(s), 'O31b').passed, false);
});

// O32 POST should not return 200
test('O32 passes when POST returns 201', () => {
  const s = spec({ '/items': { post: { operationId: 'createItem', responses: { '201': { description: 'created' } } } } });
  assert.equal(check(validateOperations(s), 'O32').passed, true);
});

test('O32 fails when POST returns only 200', () => {
  const s = spec({ '/items': { post: { operationId: 'createItem', responses: { '200': { description: 'ok' } } } } });
  assert.equal(check(validateOperations(s), 'O32').passed, false);
});

// O33 DELETE should return 204
test('O33 passes when DELETE returns 204', () => {
  const s = spec({ '/items/{id}': { delete: { operationId: 'removeItem', responses: { '204': { description: 'no content' } } } } });
  assert.equal(check(validateOperations(s), 'O33').passed, true);
});

test('O33 fails when DELETE returns 200', () => {
  const s = spec({ '/items/{id}': { delete: { operationId: 'removeItem', responses: { '200': { description: 'ok' } } } } });
  assert.equal(check(validateOperations(s), 'O33').passed, false);
});

// O34 all operations tagged
test('O34 passes when operation has tag', () => {
  const s = spec({ '/items': { get: { operationId: 'listItems', tags: ['Items'], responses: {} } } });
  assert.equal(check(validateOperations(s), 'O34').passed, true);
});

test('O34 fails when operation has no tags', () => {
  const s = spec({ '/items': { get: { operationId: 'listItems', responses: {} } } });
  assert.equal(check(validateOperations(s), 'O34').passed, false);
});

// O36 operations have summary
test('O36 passes when summary present', () => {
  const s = spec({ '/items': { get: { summary: 'List items', responses: {} } } });
  assert.equal(check(validateOperations(s), 'O36').passed, true);
});

test('O36 fails when no summary or description', () => {
  const s = spec({ '/items': { get: { responses: {} } } });
  assert.equal(check(validateOperations(s), 'O36').passed, false);
});

// O37 PUT/PATCH have request body
test('O37 passes when PUT has requestBody', () => {
  const s = spec({
    '/items/{id}': {
      put: {
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'ok' } },
      },
    },
  });
  assert.equal(check(validateOperations(s), 'O37').passed, true);
});

test('O37 fails when PATCH has no requestBody', () => {
  const s = spec({ '/items/{id}': { patch: { responses: { '200': { description: 'ok' } } } } });
  assert.equal(check(validateOperations(s), 'O37').passed, false);
});

// O39 HEAD where GET exists
test('O39 passes when HEAD defined alongside GET', () => {
  const s = spec({ '/items': { get: { responses: {} }, head: { responses: {} } } });
  assert.equal(check(validateOperations(s), 'O39').passed, true);
});

test('O39 fails when GET has no HEAD', () => {
  const s = spec({ '/items': { get: { responses: {} } } });
  assert.equal(check(validateOperations(s), 'O39').passed, false);
  assert.equal(check(validateOperations(s), 'O39').severity, 'suggestion');
});

// O41 operationId redundant verb prefix
test('O41 passes when operationId does not start with http method', () => {
  const s = spec({ '/items/{id}': { delete: { operationId: 'removeItem', responses: {} } } });
  assert.equal(check(validateOperations(s), 'O41').passed, true);
});

test('O41 flags when DELETE operationId starts with "delete"', () => {
  const s = spec({ '/items/{id}': { delete: { operationId: 'deleteItem', responses: {} } } });
  assert.equal(check(validateOperations(s), 'O41').passed, false);
});
