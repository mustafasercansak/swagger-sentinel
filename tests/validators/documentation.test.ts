import { describe, it, expect } from 'vitest';
import { validateDocumentation } from '../../src/validators/documentation.js';
import { ValidationResult } from '../../src/types.js';

function check(results: ValidationResult[], id: string) {
  return results.find(r => r.id === id);
}

function spec(paths: any, extra: any = {}) {
  return Object.assign({ openapi: '3.0.3', info: { title: 'T', version: '1.0.0' }, paths }, extra);
}

describe('validateDocumentation', () => {
  // DOC110 parameters have descriptions
  it('DOC110 passes when all params have descriptions', () => {
    const s = spec({
      '/items': {
        get: {
          parameters: [{ name: 'q', in: 'query', description: 'Search query', schema: { type: 'string' } }],
          responses: {},
        },
      },
    });
    expect(check(validateDocumentation(s as any), 'DOC110')?.passed).toBe(true);
  });

  it('DOC110 fails when param has no description', () => {
    const s = spec({
      '/items': {
        get: {
          parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
          responses: {},
        },
      },
    });
    expect(check(validateDocumentation(s as any), 'DOC110')?.passed).toBe(false);
  });

  // DOC112 schemas have examples
  it('DOC112 passes when most props have examples', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC112')?.passed).toBe(true);
  });

  it('DOC112 fails when fewer than 50% of props have examples', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC112')?.passed).toBe(false);
  });

  // DOC115 deprecated ops have x-sunset-date
  it('DOC115 passes when deprecated op has x-sunset-date', () => {
    const s = spec({
      '/items': {
        get: {
          deprecated: true,
          'x-sunset-date': '2025-12-31',
          responses: {},
        },
      },
    });
    expect(check(validateDocumentation(s as any), 'DOC115')?.passed).toBe(true);
  });

  it('DOC115 fails when deprecated op has no x-sunset-date', () => {
    const s = spec({
      '/items': { get: { deprecated: true, responses: {} } },
    });
    expect(check(validateDocumentation(s as any), 'DOC115')?.passed).toBe(false);
  });

  // DOC116 tags have descriptions
  it('DOC116 passes when used tag has description', () => {
    const s = spec(
      { '/items': { get: { tags: ['Items'], responses: {} } } },
      { tags: [{ name: 'Items', description: 'Item operations' }] }
    );
    expect(check(validateDocumentation(s as any), 'DOC116')?.passed).toBe(true);
  });

  it('DOC116 fails when used tag has no description', () => {
    const s = spec(
      { '/items': { get: { tags: ['Items'], responses: {} } } },
      { tags: [{ name: 'Items' }] }
    );
    expect(check(validateDocumentation(s as any), 'DOC116')?.passed).toBe(false);
  });

  // DOC117 response examples
  it('DOC117 passes when response has example', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC117')?.passed).toBe(true);
  });

  it('DOC117 fails when no response examples defined', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC117')?.passed).toBe(false);
  });

  // DOC118 request body examples
  it('DOC118 passes when request body has example', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC118')?.passed).toBe(true);
  });

  it('DOC118 fails when request body has no example', () => {
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
    expect(check(validateDocumentation(s as any), 'DOC118')?.passed).toBe(false);
  });

  // DOC119 API info block has detailed description
  it('DOC119 passes when description is long enough', () => {
    const s = spec({}, { info: { title: 'T', version: '1', description: 'This is a long enough description (> 20 chars).' } });
    expect(check(validateDocumentation(s as any), 'DOC119')?.passed).toBe(true);
  });

  it('DOC119 fails when description is too short', () => {
    const s = spec({}, { info: { title: 'T', version: '1', description: 'Too short' } });
    expect(check(validateDocumentation(s as any), 'DOC119')?.passed).toBe(false);
  });

  // DOC120 Schema properties have descriptions
  it('DOC120 passes when all properties have descriptions', () => {
    const s = spec({}, {
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The user name' },
            },
          },
        },
      },
    });
    expect(check(validateDocumentation(s as any), 'DOC120')?.passed).toBe(true);
  });

  it('DOC120 fails when nested property missing description', () => {
    const s = spec({}, {
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              address: {
                type: 'object',
                properties: {
                  city: { type: 'string' }, // missing description
                },
              },
            },
          },
        },
      },
    });
    expect(check(validateDocumentation(s as any), 'DOC120')?.passed).toBe(false);
  });
});
