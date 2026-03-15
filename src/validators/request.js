const { getAllOperations, resolveRef } = require('../utils/loader');

/**
 * Category: Request Validation (16 checks, 10 automated)
 */
function validateRequests(spec) {
  const results = [];
  const ops = getAllOperations(spec);

  // Collect all parameter schemas and request body schemas
  const stringParamsNoMax = [];
  const numParamsNoRange = [];
  const arrayParamsNoMax = [];
  const enumInconsistencies = [];

  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
    
    for (const param of params) {
      const schema = param.schema || {};
      const loc = `${op.method} ${op.path} → ${param.name}`;

      // R50: String parameters have maxLength
      if (schema.type === 'string' && !schema.maxLength && !schema.format && !schema.enum && param.in === 'query') {
        stringParamsNoMax.push(loc);
      }

      // R51: Numeric parameters have min/max
      if ((schema.type === 'integer' || schema.type === 'number') && schema.minimum === undefined && schema.maximum === undefined && param.in === 'query') {
        numParamsNoRange.push(loc);
      }

      // R52: Array parameters have maxItems
      if (schema.type === 'array' && !schema.maxItems) {
        arrayParamsNoMax.push(loc);
      }

      // R55: Enum casing consistency
      if (schema.enum) {
        const hasUpper = schema.enum.some(e => typeof e === 'string' && e === e.toUpperCase() && e !== e.toLowerCase());
        const hasLower = schema.enum.some(e => typeof e === 'string' && e === e.toLowerCase() && e !== e.toUpperCase());
        const hasMixed = schema.enum.some(e => typeof e === 'string' && e !== e.toUpperCase() && e !== e.toLowerCase());
        if ((hasUpper && hasLower) || hasMixed) {
          enumInconsistencies.push(`${loc}: [${schema.enum.join(', ')}]`);
        }
      }
    }

    // Check request body schemas too
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mediaType of Object.values(content)) {
        let schema = mediaType.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            if (propSchema.type === 'string' && !propSchema.maxLength && !propSchema.format && !propSchema.enum) {
              // Only flag if no format (uuid, email, etc. have implicit limits)
              stringParamsNoMax.push(`${op.method} ${op.path} body.${propName}`);
            }
            if (propSchema.type === 'array' && !propSchema.maxItems) {
              arrayParamsNoMax.push(`${op.method} ${op.path} body.${propName}`);
            }
          }
        }
      }
    }
  }

  results.push({
    id: 'R50', category: 'Request', severity: 'warning',
    passed: stringParamsNoMax.length === 0,
    message: 'String parameters have maxLength defined',
    details: stringParamsNoMax.length > 0 ? `Missing maxLength: ${stringParamsNoMax.slice(0, 3).join('; ')}${stringParamsNoMax.length > 3 ? ` (+${stringParamsNoMax.length - 3} more)` : ''}` : null,
  });

  results.push({
    id: 'R51', category: 'Request', severity: 'warning',
    passed: numParamsNoRange.length === 0,
    message: 'Numeric parameters have minimum/maximum defined',
    details: numParamsNoRange.length > 0 ? `Missing range: ${numParamsNoRange.slice(0, 3).join('; ')}` : null,
  });

  results.push({
    id: 'R52', category: 'Request', severity: 'warning',
    passed: arrayParamsNoMax.length === 0,
    message: 'Array parameters have maxItems defined',
    details: arrayParamsNoMax.length > 0 ? `Missing maxItems: ${arrayParamsNoMax.slice(0, 3).join('; ')}` : null,
  });

  results.push({
    id: 'R55', category: 'Request', severity: 'warning',
    passed: enumInconsistencies.length === 0,
    message: 'Enums use consistent casing',
    details: enumInconsistencies.length > 0 ? `Inconsistent: ${enumInconsistencies.slice(0, 2).join('; ')}` : null,
  });

  // R53: Required fields are specified for request bodies
  const missingRequired = [];
  for (const op of ops) {
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mediaType of Object.values(content)) {
        let schema = mediaType.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        if (schema.type === 'object' && schema.properties && (!schema.required || schema.required.length === 0)) {
          missingRequired.push(`${op.method} ${op.path}`);
        }
      }
    }
  }
  results.push({
    id: 'R53', category: 'Request', severity: 'warning',
    passed: missingRequired.length === 0,
    message: 'Request body schemas define required fields',
    details: missingRequired.length > 0 ? `No required: ${missingRequired.join(', ')}` : null,
  });

  // R54: Content-Type is specified for request bodies
  const noContentType = [];
  for (const op of ops) {
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      if (Object.keys(content).length === 0) {
        noContentType.push(`${op.method} ${op.path}`);
      }
    }
  }
  results.push({
    id: 'R54', category: 'Request', severity: 'error',
    passed: noContentType.length === 0,
    message: 'Request bodies specify content type',
    details: noContentType.length > 0 ? `Missing content type: ${noContentType.join(', ')}` : null,
  });

  // R56: Path parameters have descriptions
  const paramNoDesc = [];
  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
    for (const param of params) {
      if (!param.description) {
        paramNoDesc.push(`${op.method} ${op.path} → ${param.name}`);
      }
    }
  }
  results.push({
    id: 'R56', category: 'Request', severity: 'warning',
    passed: paramNoDesc.length === 0,
    message: 'All parameters have descriptions',
    details: paramNoDesc.length > 0 ? `Missing: ${paramNoDesc.slice(0, 3).join('; ')}${paramNoDesc.length > 3 ? ` (+${paramNoDesc.length - 3} more)` : ''}` : null,
  });

  return results;
}

module.exports = { validateRequests };
