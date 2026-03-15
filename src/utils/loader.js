const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load and parse an OpenAPI spec from YAML or JSON file
 */
async function loadSpec(filePath) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const content = fs.readFileSync(resolved, 'utf-8');
  const ext = path.extname(resolved).toLowerCase();

  let spec;
  if (ext === '.json') {
    spec = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    spec = yaml.load(content);
  } else {
    // Try YAML first, then JSON
    try {
      spec = yaml.load(content);
    } catch {
      spec = JSON.parse(content);
    }
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('Failed to parse spec — not a valid YAML or JSON document');
  }

  if (!spec.openapi) {
    throw new Error('Missing "openapi" field — is this an OpenAPI 3.x document?');
  }

  const majorMinor = spec.openapi.split('.').slice(0, 2).join('.');
  if (!majorMinor.startsWith('3.')) {
    throw new Error(`Unsupported OpenAPI version: ${spec.openapi}. Only 3.x is supported.`);
  }

  return spec;
}

/**
 * Resolve $ref within a spec (simple single-file resolution)
 */
function resolveRef(spec, ref) {
  if (!ref || !ref.startsWith('#/')) return null;
  const parts = ref.replace('#/', '').split('/');
  let current = spec;
  for (const part of parts) {
    current = current?.[part];
  }
  return current;
}

/**
 * Get all operations from a spec as a flat list
 */
function getAllOperations(spec) {
  const operations = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    for (const method of methods) {
      const op = pathItem[method];
      if (op) {
        operations.push({
          path: pathStr,
          method: method.toUpperCase(),
          operation: op,
          pathItem,
        });
      }
    }
  }

  return operations;
}

module.exports = { loadSpec, resolveRef, getAllOperations };
