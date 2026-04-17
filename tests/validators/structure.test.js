'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateStructure } = require('../../src/validators/structure');

function check(results, id) {
  return results.find(r => r.id === id);
}

const BASE = {
  openapi: '3.0.3',
  info: { title: 'Test API', version: '1.0.0', description: 'desc', contact: { name: 'dev' } },
  paths: { '/items': { get: { responses: { '200': { description: 'ok' } } } } },
};

function spec(overrides) {
  return Object.assign({}, BASE, overrides);
}

test('S01 passes when contact is present', () => {
  const r = check(validateStructure(spec()), 'S01');
  assert.equal(r.passed, true);
});

test('S01 fails when contact is missing', () => {
  const r = check(validateStructure(spec({ info: { ...BASE.info, contact: undefined } })), 'S01');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'error');
});

test('S02 passes for semver version', () => {
  const r = check(validateStructure(spec()), 'S02');
  assert.equal(r.passed, true);
});

test('S02 fails for non-semver version', () => {
  const r = check(validateStructure(spec({ info: { ...BASE.info, version: 'v1' } })), 'S02');
  assert.equal(r.passed, false);
});

test('S03 passes when servers is defined', () => {
  const r = check(validateStructure(spec({ servers: [{ url: 'https://api.example.com' }] })), 'S03');
  assert.equal(r.passed, true);
});

test('S03 fails when servers is absent', () => {
  const r = check(validateStructure(spec({ servers: undefined })), 'S03');
  assert.equal(r.passed, false);
});

test('S04 passes when paths has entries', () => {
  const r = check(validateStructure(spec()), 'S04');
  assert.equal(r.passed, true);
});

test('S04 fails when paths is empty', () => {
  const r = check(validateStructure(spec({ paths: {} })), 'S04');
  assert.equal(r.passed, false);
});

test('S05 passes for openapi 3.0.x', () => {
  const r = check(validateStructure(spec()), 'S05');
  assert.equal(r.passed, true);
});

test('S05 fails for openapi 2.x', () => {
  const r = check(validateStructure(spec({ openapi: '2.0.0' })), 'S05');
  assert.equal(r.passed, false);
});

test('S06 passes when description present', () => {
  const r = check(validateStructure(spec()), 'S06');
  assert.equal(r.passed, true);
});

test('S06 fails when description absent', () => {
  const r = check(validateStructure(spec({ info: { ...BASE.info, description: undefined } })), 'S06');
  assert.equal(r.passed, false);
});

test('S08 fails for short title', () => {
  const r = check(validateStructure(spec({ info: { ...BASE.info, title: 'API' } })), 'S08');
  assert.equal(r.passed, false);
});

test('S09 passes when externalDocs present', () => {
  const r = check(validateStructure(spec({ externalDocs: { url: 'https://docs.example.com' } })), 'S09');
  assert.equal(r.passed, true);
});

test('S10 passes when $ref used and components exist', () => {
  const s = spec({
    paths: { '/items': { get: { responses: { '200': { $ref: '#/components/responses/OK' } } } } },
    components: { responses: { OK: { description: 'ok' } } },
  });
  const r = check(validateStructure(s), 'S10');
  assert.equal(r.passed, true);
});

test('S10 fails when $ref used and no components', () => {
  const s = spec({
    paths: { '/items': { get: { responses: { '200': { $ref: '#/components/responses/OK' } } } } },
    components: undefined,
  });
  const r = check(validateStructure(s), 'S10');
  assert.equal(r.passed, false);
});

test('S11 passes when termsOfService present', () => {
  const r = check(validateStructure(spec({ info: { ...BASE.info, termsOfService: 'https://example.com/tos' } })), 'S11');
  assert.equal(r.passed, true);
});

test('S11 fails when termsOfService absent', () => {
  const r = check(validateStructure(spec()), 'S11');
  assert.equal(r.passed, false);
  assert.equal(r.severity, 'suggestion');
});
