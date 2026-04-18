import { getAllOperations, resolveRef } from '../utils/loader.js';
import { OpenAPISpec, ValidationResult } from '../types.js';

/**
 * Category: Request Validation (16 checks, 10 automated)
 */
// field name fragments → expected format value
const FORMAT_HINTS = [
  { fragments: ['email'], format: 'email' },
  { fragments: ['url', 'uri', 'href', 'link', 'website'], format: 'uri' },
  { fragments: ['date_of_birth', 'dob', 'birth_date', 'birthdate'], format: 'date' },
  { fragments: ['created_at', 'updated_at', 'deleted_at', 'timestamp'], format: 'date-time' },
  { fragments: ['uuid', '_id'], format: 'uuid' },
  { fragments: ['ipaddress', 'ip_address', 'ipv4', 'ipv6'], format: 'ipv4' },
  { fragments: ['hostname'], format: 'hostname' },
];

export function validateRequests(spec: OpenAPISpec): ValidationResult[] {
  const results: ValidationResult[] = [];
  const ops = getAllOperations(spec);

  // Collect all parameter schemas and request body schemas
  const stringParamsNoMax: string[] = [];
  const numParamsNoRange: string[] = [];
  const arrayParamsNoMax: string[] = [];
  const enumInconsistencies: string[] = [];

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
        const hasUpper = schema.enum.some((e: any) => typeof e === 'string' && e === e.toUpperCase() && e !== e.toLowerCase());
        const hasLower = schema.enum.some((e: any) => typeof e === 'string' && e === e.toLowerCase() && e !== e.toUpperCase());
        const hasMixed = schema.enum.some((e: any) => typeof e === 'string' && e !== e.toUpperCase() && e !== e.toLowerCase());
        if ((hasUpper && hasLower) || hasMixed) {
          enumInconsistencies.push(`${loc}: [${schema.enum.join(', ')}]`);
        }
      }
    }

    // Check request body schemas too
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mediaType of Object.values(content) as any[]) {
        let schema = mediaType.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties) as any[]) {
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
  const missingRequired: string[] = [];
  for (const op of ops) {
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mediaType of Object.values(content) as any[]) {
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
  const noContentType: string[] = [];
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
  const paramNoDesc: string[] = [];
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

  // R57: Fields whose names imply a format have the matching format keyword
  const formatMismatches: string[] = [];

  function checkFormatHints(propName: string, propSchema: any, loc: string) {
    if (propSchema.type !== 'string' || propSchema.format || propSchema.enum) return;
    const lower = propName.toLowerCase().replace(/-/g, '_');
    for (const hint of FORMAT_HINTS) {
      if (hint.fragments.some(f => lower.includes(f))) {
        formatMismatches.push(`${loc} (expected format: ${hint.format})`);
        break;
      }
    }
  }

  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
    for (const param of params) {
      checkFormatHints(param.name, param.schema || {}, `${op.method} ${op.path} → ${param.name}`);
    }
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mediaType of Object.values(content) as any[]) {
        let schema = mediaType.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            checkFormatHints(propName, propSchema, `${op.method} ${op.path} body.${propName}`);
          }
        }
      }
    }
  }
  // Also check component schemas
  for (const [schemaName, schema] of Object.entries(spec.components?.schemas || {})) {
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties as any)) {
        checkFormatHints(propName, propSchema, `${schemaName}.${propName}`);
      }
    }
  }

  results.push({
    id: 'R57', category: 'Request', severity: 'suggestion',
    passed: formatMismatches.length === 0,
    message: 'Fields with semantic names carry the matching format keyword',
    details: formatMismatches.length > 0 ? `Missing format: ${formatMismatches.slice(0, 3).join('; ')}${formatMismatches.length > 3 ? ` (+${formatMismatches.length - 3} more)` : ''}` : null,
  });

  // R58: File upload fields (binary/byte) are in multipart/form-data requests
  const binaryNotMultipart: string[] = [];
  for (const op of ops) {
    if (!op.operation.requestBody) continue;
    const content = op.operation.requestBody.content || {};
    for (const [mediaType, mtObj] of Object.entries(content) as any[]) {
      if (mediaType === 'multipart/form-data') continue;
      const schema = mtObj.schema || {};
      const hasBinary = schema.format === 'binary' || schema.format === 'byte' ||
        (schema.properties && Object.values(schema.properties).some((p: any) => p.format === 'binary' || p.format === 'byte'));
      if (hasBinary) {
        binaryNotMultipart.push(`${op.method} ${op.path} (${mediaType})`);
      }
    }
  }
  results.push({
    id: 'R58', category: 'Request', severity: 'warning',
    passed: binaryNotMultipart.length === 0,
    message: 'Binary/file upload fields use multipart/form-data',
    details: binaryNotMultipart.length > 0 ? `Binary outside multipart: ${binaryNotMultipart.join(', ')}` : null,
  });

  // R59: Parameters named id or uuid should define a format or pattern
  const idMissingFormat: string[] = [];
  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
    for (const param of params) {
      const name = param.name.toLowerCase();
      if ((name.includes('id') || name.includes('uuid')) && param.schema && !param.schema.format && !param.schema.pattern) {
        idMissingFormat.push(`${op.method} ${op.path} → ${param.name}`);
      }
    }
  }
  results.push({
    id: 'R59', category: 'Request', severity: 'warning',
    passed: idMissingFormat.length === 0,
    message: 'ID parameters should define a specific format (uuid) or pattern',
    details: idMissingFormat.length > 0 ? `Missing format/pattern: ${idMissingFormat.slice(0, 3).join('; ')}` : null,
  });

  // R60: Large objects should suggest maxProperties
  const largeObjectsNoMax: string[] = [];
  function checkLargeObject(schema: any, loc: string) {
    if (schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 10 && schema.maxProperties === undefined) {
      largeObjectsNoMax.push(loc);
    }
  }

  for (const op of ops) {
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mt of Object.values(content) as any[]) {
        let schema = mt.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        checkLargeObject(schema, `${op.method} ${op.path} body`);
      }
    }
  }
  // Also check component schemas
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    checkLargeObject(schema, `components.schemas.${name}`);
  }

  results.push({
    id: 'R60', category: 'Request', severity: 'suggestion',
    passed: largeObjectsNoMax.length === 0,
    message: 'Large request body objects should define maxProperties',
    details: largeObjectsNoMax.length > 0 ? `No maxProperties: ${largeObjectsNoMax.slice(0, 3).join(', ')}` : null,
  });

  // R61: Sensitive fields should not have example values
  const sensitiveFields = ['password', 'token', 'secret', 'apikey', 'api_key'];
  const sensitiveWithExample: string[] = [];
  function checkSensitiveExamples(schema: any, loc: string) {
    if (!schema.properties) return;
    for (const [name, prop] of Object.entries(schema.properties) as any[]) {
      if (sensitiveFields.some(f => name.toLowerCase().includes(f)) && prop.example !== undefined) {
        sensitiveWithExample.push(`${loc}.${name}`);
      }
    }
  }
  for (const op of ops) {
    if (op.operation.requestBody) {
      const content = op.operation.requestBody.content || {};
      for (const mt of Object.values(content) as any[]) {
        let schema = mt.schema || {};
        if (schema.$ref) schema = resolveRef(spec, schema.$ref) || schema;
        checkSensitiveExamples(schema, `${op.method} ${op.path} body`);
      }
    }
  }
  // Also check component schemas
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    checkSensitiveExamples(schema, `components.schemas.${name}`);
  }
  results.push({
    id: 'R61', category: 'Request', severity: 'warning',
    passed: sensitiveWithExample.length === 0,
    message: 'Sensitive fields (password, token, etc.) should not include example values',
    details: sensitiveWithExample.length > 0 ? `Found examples in: ${sensitiveWithExample.slice(0, 3).join(', ')}` : null,
  });

  return results;
}
