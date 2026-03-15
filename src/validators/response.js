const { getAllOperations, resolveRef } = require('../utils/loader');

/**
 * Category: Response Design (20 checks, 8 automated)
 */
function validateResponses(spec) {
  const results = [];
  const ops = getAllOperations(spec);

  // Collect error response schemas to check consistency
  const errorSchemaRefs = new Set();
  const opsWithout4xxBody = [];
  const opsWithout5xx = [];
  const opsWithoutAnyResponse = [];

  for (const op of ops) {
    const responses = op.operation.responses || {};
    const label = `${op.method} ${op.path}`;

    // Check responses exist
    if (Object.keys(responses).length === 0) {
      opsWithoutAnyResponse.push(label);
      continue;
    }

    // Check 4xx have bodies
    for (const [code, resp] of Object.entries(responses)) {
      if (code.startsWith('4') || code.startsWith('5')) {
        const content = resp.content || (resp.$ref ? (resolveRef(spec, resp.$ref) || {}).content : null);
        if (!content && code.startsWith('4') && code !== '404') {
          opsWithout4xxBody.push(`${label} → ${code}`);
        }

        // Track error schema refs
        if (content) {
          for (const mt of Object.values(content)) {
            if (mt.schema && mt.schema.$ref) {
              errorSchemaRefs.add(mt.schema.$ref);
            }
          }
        }
      }
    }

    // Check 5xx defined
    const has5xx = Object.keys(responses).some(c => c.startsWith('5') || c === 'default');
    if (!has5xx) {
      opsWithout5xx.push(label);
    }
  }

  // R70: Consistent error schema
  results.push({
    id: 'R70', category: 'Response', severity: 'warning',
    passed: errorSchemaRefs.size <= 2,  // Allow ErrorResponse + ValidationErrorResponse
    message: 'Error responses use a consistent schema',
    details: errorSchemaRefs.size > 2 ? `Found ${errorSchemaRefs.size} different error schemas: ${[...errorSchemaRefs].join(', ')}` : null,
  });

  // R71: 4xx have response body
  results.push({
    id: 'R71', category: 'Response', severity: 'warning',
    passed: opsWithout4xxBody.length === 0,
    message: 'All 4xx responses have a response body',
    details: opsWithout4xxBody.length > 0 ? `No body: ${opsWithout4xxBody.slice(0, 3).join('; ')}` : null,
  });

  // R72: 5xx responses defined
  results.push({
    id: 'R72', category: 'Response', severity: 'suggestion',
    passed: opsWithout5xx.length === 0,
    message: '5xx or default error responses are defined',
    details: opsWithout5xx.length > 0 ? `No 5xx: ${opsWithout5xx.slice(0, 3).join(', ')}` : null,
  });

  // R73: All operations have at least one response
  results.push({
    id: 'R73', category: 'Response', severity: 'error',
    passed: opsWithoutAnyResponse.length === 0,
    message: 'All operations define at least one response',
    details: opsWithoutAnyResponse.length > 0 ? `No responses: ${opsWithoutAnyResponse.join(', ')}` : null,
  });

  // R74: Successful responses have content defined (except 204)
  const successNoContent = [];
  for (const op of ops) {
    const responses = op.operation.responses || {};
    for (const [code, resp] of Object.entries(responses)) {
      if (code.startsWith('2') && code !== '204') {
        if (!resp.content && !resp.$ref) {
          successNoContent.push(`${op.method} ${op.path} → ${code}`);
        }
      }
    }
  }
  results.push({
    id: 'R74', category: 'Response', severity: 'warning',
    passed: successNoContent.length === 0,
    message: 'Success responses (except 204) have content defined',
    details: successNoContent.length > 0 ? `No content: ${successNoContent.slice(0, 3).join('; ')}` : null,
  });

  // R75: 429 has rate-limit headers
  const ops429 = [];
  for (const op of ops) {
    const resp429 = (op.operation.responses || {})['429'];
    if (resp429) {
      const headers = resp429.headers || {};
      const hasRateHeaders = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        .some(h => Object.keys(headers).some(k => k.toLowerCase() === h.toLowerCase()));
      if (!hasRateHeaders) {
        ops429.push(`${op.method} ${op.path}`);
      }
    }
  }
  results.push({
    id: 'R75', category: 'Response', severity: 'warning',
    passed: ops429.length === 0,
    message: '429 responses include rate-limit headers',
    details: ops429.length > 0 ? `Missing headers: ${ops429.join(', ')}` : null,
  });

  // R76: Response schemas define required fields
  const schemasNoRequired = [];
  for (const schemaName in (spec.components?.schemas || {})) {
    const schema = spec.components.schemas[schemaName];
    if (schema.type === 'object' && schema.properties && (!schema.required || schema.required.length === 0)) {
      schemasNoRequired.push(schemaName);
    }
  }
  results.push({
    id: 'R76', category: 'Response', severity: 'warning',
    passed: schemasNoRequired.length === 0,
    message: 'All schemas define required fields',
    details: schemasNoRequired.length > 0 ? `No required: ${schemasNoRequired.join(', ')}` : null,
  });

  return results;
}

module.exports = { validateResponses };
