'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequests } = require('../../src/validators/request');

function check(results, id) {
  return results.find(r => r.id === id);
}

function spec(paths, components = {}) {
  return { openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths, components };
}

// R50 string maxLength
test('R50 passes when query string param has maxLength', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R50').passed, true);
});

test('R50 fails when query string param has no maxLength', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R50').passed, false);
});

// R51 numeric min/max
test('R51 fails when numeric query param has no range', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R51').passed, false);
});

test('R51 passes when numeric param has minimum', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R51').passed, true);
});

// R53 request body required fields
test('R53 fails when request body object schema has no required', () => {
  const s = spec({
    '/items': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } },
            },
          },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R53').passed, false);
});

test('R53 passes when required fields defined', () => {
  const s = spec({
    '/items': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
            },
          },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R53').passed, true);
});

// R54 content-type required
test('R54 fails when requestBody has no content', () => {
  const s = spec({
    '/items': {
      post: {
        requestBody: { content: {} },
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R54').passed, false);
  assert.equal(check(validateRequests(s), 'R54').severity, 'error');
});

// R55 enum casing
test('R55 passes when enum values are consistently cased', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R55').passed, true);
});

test('R55 fails when enum mixes upper and lower case', () => {
  const s = spec({
    '/items': {
      get: {
        parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['ACTIVE', 'inactive'] } }],
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R55').passed, false);
});

// R57 format hints
test('R57 passes when email field has format: email', () => {
  const s = spec({}, {
    schemas: { User: { properties: { email: { type: 'string', format: 'email' } } } },
  });
  assert.equal(check(validateRequests(s), 'R57').passed, true);
});

test('R57 fails when email field has no format', () => {
  const s = spec({}, {
    schemas: { User: { properties: { email: { type: 'string' } } } },
  });
  assert.equal(check(validateRequests(s), 'R57').passed, false);
  assert.equal(check(validateRequests(s), 'R57').severity, 'suggestion');
});

// R58 binary in multipart
test('R58 passes when binary field is in multipart/form-data', () => {
  const s = spec({
    '/upload': {
      post: {
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R58').passed, true);
});

test('R58 fails when binary field is in application/json', () => {
  const s = spec({
    '/upload': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: {},
      },
    },
  });
  assert.equal(check(validateRequests(s), 'R58').passed, false);
});
