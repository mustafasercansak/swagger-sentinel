'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateResponses } = require('../../src/validators/response');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(paths, components = {}) {
  return { openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths, components };
}

// R70 consistent error schema
test('R70 passes when one error schema ref used', () => {
  const s = spec({
    '/a': { get: { responses: { '400': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } } },
    '/b': { get: { responses: { '400': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } } },
  });
  assert.equal(check(validateResponses(s), 'R70').passed, true);
});

test('R70 fails when 3+ different error schemas used', () => {
  const s = spec({
    '/a': { get: { responses: { '400': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Err1' } } } } } } },
    '/b': { get: { responses: { '400': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Err2' } } } } } } },
    '/c': { get: { responses: { '400': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Err3' } } } } } } },
  });
  assert.equal(check(validateResponses(s), 'R70').passed, false);
});

// R73 all operations have responses
test('R73 fails when operation has no responses', () => {
  const s = spec({ '/items': { get: { responses: {} } } });
  assert.equal(check(validateResponses(s), 'R73').passed, false);
  assert.equal(check(validateResponses(s), 'R73').severity, 'error');
});

test('R73 passes when operation has at least one response', () => {
  const s = spec({ '/items': { get: { responses: { '200': { description: 'ok' } } } } });
  assert.equal(check(validateResponses(s), 'R73').passed, true);
});

// R74 success responses have content
test('R74 fails when 200 response has no content', () => {
  const s = spec({ '/items': { get: { responses: { '200': { description: 'ok' } } } } });
  assert.equal(check(validateResponses(s), 'R74').passed, false);
});

test('R74 passes for 204 with no content', () => {
  const s = spec({ '/items/{id}': { delete: { responses: { '204': { description: 'deleted' } } } } });
  assert.equal(check(validateResponses(s), 'R74').passed, true);
});

test('R74 passes when 200 has content', () => {
  const s = spec({
    '/items': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R74').passed, true);
});

// R75 429 has rate-limit headers
test('R75 passes when 429 has X-RateLimit-Limit header', () => {
  const s = spec({
    '/items': {
      get: {
        responses: {
          '429': {
            description: 'too many',
            headers: { 'X-RateLimit-Limit': { schema: { type: 'integer' } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R75').passed, true);
});

test('R75 fails when 429 has no rate-limit headers', () => {
  const s = spec({
    '/items': { get: { responses: { '429': { description: 'too many' } } } },
  });
  assert.equal(check(validateResponses(s), 'R75').passed, false);
});

// R77 201 includes Location header
test('R77 passes when 201 has Location header', () => {
  const s = spec({
    '/items': {
      post: {
        responses: {
          '201': {
            description: 'created',
            headers: { Location: { schema: { type: 'string' } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R77').passed, true);
});

test('R77 fails when 201 has no Location header', () => {
  const s = spec({
    '/items': { post: { responses: { '201': { description: 'created' } } } },
  });
  assert.equal(check(validateResponses(s), 'R77').passed, false);
  assert.equal(check(validateResponses(s), 'R77').severity, 'suggestion');
});

// R78 list responses have total count
test('R78 passes when array response has x-total-count header', () => {
  const s = spec({
    '/items': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'array', items: {} } } },
            headers: { 'X-Total-Count': { schema: { type: 'integer' } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R78').passed, true);
});

test('R78 fails when array response has no total count', () => {
  const s = spec({
    '/items': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'array', items: {} } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R78').passed, false);
});

// R79 single-resource GET has ETag
test('R79 passes when single resource GET has ETag header', () => {
  const s = spec({
    '/items/{id}': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'object' } } },
            headers: { ETag: { schema: { type: 'string' } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R79').passed, true);
});

test('R79 fails when single resource GET has no ETag', () => {
  const s = spec({
    '/items/{id}': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  });
  assert.equal(check(validateResponses(s), 'R79').passed, false);
});
