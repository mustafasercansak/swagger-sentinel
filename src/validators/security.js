const { getAllOperations } = require('../utils/loader');

/**
 * Category: Security (14 checks, 4 automated)
 */
function validateSecurity(spec) {
  const results = [];
  const ops = getAllOperations(spec);

  // SEC90: Security schemes defined
  const hasSecuritySchemes = !!(spec.components?.securitySchemes && Object.keys(spec.components.securitySchemes).length > 0);
  results.push({
    id: 'SEC90', category: 'Security', severity: 'warning',
    passed: hasSecuritySchemes,
    message: 'Security schemes are defined',
    details: !hasSecuritySchemes ? 'Every production API needs authentication — add components.securitySchemes' : null,
  });

  // SEC91: No API keys in query parameters
  const queryApiKeys = [];
  if (spec.components?.securitySchemes) {
    for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
      if (scheme.type === 'apiKey' && scheme.in === 'query') {
        queryApiKeys.push(name);
      }
    }
  }
  results.push({
    id: 'SEC91', category: 'Security', severity: 'error',
    passed: queryApiKeys.length === 0,
    message: 'No API keys in query parameters',
    details: queryApiKeys.length > 0 ? `Keys in query: ${queryApiKeys.join(', ')} — move to header. Query params leak into logs, browser history, referrer headers.` : null,
  });

  // SEC93: Sensitive fields marked writeOnly
  const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'api_key', 'creditCard', 'ssn'];
  const notWriteOnly = [];
  for (const schemaName in (spec.components?.schemas || {})) {
    const schema = spec.components.schemas[schemaName];
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (sensitiveFields.some(f => propName.toLowerCase().includes(f.toLowerCase())) && !propSchema.writeOnly) {
          notWriteOnly.push(`${schemaName}.${propName}`);
        }
      }
    }
  }
  results.push({
    id: 'SEC93', category: 'Security', severity: 'warning',
    passed: notWriteOnly.length === 0,
    message: 'Sensitive fields are marked writeOnly',
    details: notWriteOnly.length > 0 ? `Not writeOnly: ${notWriteOnly.join(', ')}` : null,
  });

  // SEC94: Global security is defined or per-operation
  const hasGlobalSecurity = !!(spec.security && spec.security.length > 0);
  const allOpsHaveSecurity = ops.every(o => o.operation.security !== undefined);
  results.push({
    id: 'SEC94', category: 'Security', severity: 'suggestion',
    passed: hasGlobalSecurity || allOpsHaveSecurity,
    message: 'Security is applied globally or per-operation',
    details: !(hasGlobalSecurity || allOpsHaveSecurity) ? 'Add top-level security or per-operation security' : null,
  });

  return results;
}

module.exports = { validateSecurity };
