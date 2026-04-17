'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDocumentation } = require('../../src/validators/documentation');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(paths, extra = {}) {
  return Object.assign({ openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths }, extra);
}

// DOC110 parameters have descriptions
test('DOC110 passes when all params have descriptions', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'q', in: 'query', description: 'Search query', schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC110').passed, true);
});

test('DOC110 fails when param has no description', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC110').passed, false);
});

// DOC112 schemas have examples
test('DOC112 passes when most props have examples', () => {
  const s = spec({}, {
    components: {
      schemas: {
        Item: {
          properties: {
            id: { type: 'string', example: 'abc123' },
            name: { type: 'string', example: 'Widget' },
          },
        },
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC112').passed, true);
});

test('DOC112 fails when fewer than 50% of props have examples', () => {
  const s = spec({}, {
    components: {
      schemas: {
        Item: {
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            desc: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC112').passed, false);
});

// DOC115 deprecated ops have x-sunset-date
test('DOC115 passes when deprecated op has x-sunset-date', () => {
  const s = spec({
    '/items': {
      get: {
        deprecated: true,
        'x-sunset-date': '2025-12-31',
        responses: {},
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC115').passed, true);
});

test('DOC115 fails when deprecated op has no x-sunset-date', () => {
  const s = spec({
    '/items': { get: { deprecated: true, responses: {} } },
  });
  assert.equal(check(validateDocumentation(s), 'DOC115').passed, false);
});

// DOC116 tags have descriptions
test('DOC116 passes when used tag has description', () => {
  const s = spec(
    { '/items': { get: { tags: ['Items'], responses: {} } } },
    { tags: [{ name: 'Items', description: 'Item operations' }] }
  );
  assert.equal(check(validateDocumentation(s), 'DOC116').passed, true);
});

test('DOC116 fails when used tag has no description', () => {
  const s = spec(
    { '/items': { get: { tags: ['Items'], responses: {} } } },
    { tags: [{ name: 'Items' }] }
  );
  assert.equal(check(validateDocumentation(s), 'DOC116').passed, false);
});

// DOC117 response examples
test('DOC117 passes when response has example', () => {
  const s = spec({
    '/items': {
      get: {
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                example: [{ id: '1', name: 'Widget' }],
                schema: { type: 'array', items: {} },
              },
            },
          },
        },
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC117').passed, true);
});

test('DOC117 fails when no response examples defined', () => {
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
  assert.equal(check(validateDocumentation(s), 'DOC117').passed, false);
});

// DOC118 request body examples
test('DOC118 passes when request body has example', () => {
  const s = spec({
    '/items': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              example: { name: 'Widget' },
              schema: { type: 'object' },
            },
          },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC118').passed, true);
});

test('DOC118 fails when request body has no example', () => {
  const s = spec({
    '/items': {
      post: {
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateDocumentation(s), 'DOC118').passed, false);
});
