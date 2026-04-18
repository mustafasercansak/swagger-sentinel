import { getAllOperations } from '../utils/loader.js';
import { OpenAPISpec, ValidationResult } from '../types.js';

/**
 * Category: Path Design (18 checks, 11 automated)
 */
export function validatePaths(spec: OpenAPISpec): ValidationResult[] {
  const results: ValidationResult[] = [];
  const paths = Object.keys(spec.paths || {});

  // P15: kebab-case paths
  const nonKebab = paths.filter(p => {
    const segments = p.split('/').filter(s => s && !s.startsWith('{'));
    return segments.some(s => s !== s.toLowerCase() || s.includes('_'));
  });
  results.push({
    id: 'P15', category: 'Paths', severity: 'warning',
    passed: nonKebab.length === 0,
    message: 'All paths use kebab-case',
    details: nonKebab.length > 0 ? `Non-kebab paths: ${nonKebab.join(', ')}` : null,
  });

  // P16: No trailing slashes
  const trailingSlash = paths.filter(p => p.length > 1 && p.endsWith('/'));
  results.push({
    id: 'P16', category: 'Paths', severity: 'error',
    passed: trailingSlash.length === 0,
    message: 'No trailing slashes in paths',
    details: trailingSlash.length > 0 ? `Found: ${trailingSlash.join(', ')}` : null,
  });

  // P17: Plural resource naming
  const singularSuspects: string[] = [];
  for (const p of paths) {
    const segments = p.split('/').filter(s => s && !s.startsWith('{'));
    for (const seg of segments) {
      // Skip version segments and common non-plural words
      if (/^v\d+$/.test(seg) || ['api', 'auth', 'health', 'status', 'login', 'logout', 'me', 'search', 'firmware'].includes(seg)) continue;
      // Basic heuristic: if a segment doesn't end in s/es and is followed by a path param, it might be singular
      const idx = p.indexOf(seg);
      const after = p.substring(idx + seg.length);
      if (after.startsWith('/{') && !seg.endsWith('s') && !seg.endsWith('data') && !seg.endsWith('info')) {
        singularSuspects.push(seg);
      }
    }
  }
  results.push({
    id: 'P17', category: 'Paths', severity: 'warning',
    passed: singularSuspects.length === 0,
    message: 'Resource naming uses plural form',
    details: singularSuspects.length > 0 ? `Possibly singular: ${[...new Set(singularSuspects)].join(', ')}` : null,
  });

  // P18: Path nesting <= 3 levels
  const deepPaths = paths.filter(p => {
    const params = (p.match(/\{[^}]+\}/g) || []).length;
    return params > 3;
  });
  results.push({
    id: 'P18', category: 'Paths', severity: 'warning',
    passed: deepPaths.length === 0,
    message: 'Path nesting does not exceed 3 levels',
    details: deepPaths.length > 0 ? `Deep paths: ${deepPaths.join(', ')}` : null,
  });

  // P19: Versioned paths
  const hasVersionedPaths = paths.some(p => /\/v\d+\//.test(p));
  const hasServerVersioning = (spec.servers || []).some(s => /\/v\d+/.test(s.url || ''));
  results.push({
    id: 'P19', category: 'Paths', severity: 'suggestion',
    passed: hasVersionedPaths || hasServerVersioning,
    message: 'API versioning is present (path or server URL)',
  });

  // P20: No file extensions in paths
  const extPaths = paths.filter(p => /\.\w{2,4}$/.test(p.replace(/\{[^}]+\}/g, '')));
  results.push({
    id: 'P20', category: 'Paths', severity: 'warning',
    passed: extPaths.length === 0,
    message: 'No file extensions in paths (.json, .xml)',
    details: extPaths.length > 0 ? `Found: ${extPaths.join(', ')}` : null,
  });

  // P21: Consistent path prefix
  const prefixes = paths.map(p => p.split('/')[1]).filter(Boolean);
  const uniquePrefixes = [...new Set(prefixes)];
  results.push({
    id: 'P21', category: 'Paths', severity: 'suggestion',
    passed: uniquePrefixes.length <= 3,
    message: 'Paths share a consistent prefix structure',
    details: uniquePrefixes.length > 3 ? `Found ${uniquePrefixes.length} different prefixes` : null,
  });

  // P22: No empty path segments
  const emptySegments = paths.filter(p => p.includes('//'));
  results.push({
    id: 'P22', category: 'Paths', severity: 'error',
    passed: emptySegments.length === 0,
    message: 'No empty path segments (double slashes)',
    details: emptySegments.length > 0 ? `Found: ${emptySegments.join(', ')}` : null,
  });

  // P23: Path parameters are documented
  const ops = getAllOperations(spec);
  let undocumentedParams: string[] = [];
  for (const op of ops) {
    const pathParams = (op.path.match(/\{(\w+)\}/g) || []).map((p: string) => p.replace(/[{}]/g, ''));
    const definedParams = (op.operation.parameters || [])
      .concat(op.pathItem.parameters || [])
      .filter((p: any) => p.in === 'path')
      .map((p: any) => p.name);
    
    for (const pp of pathParams) {
      if (!definedParams.includes(pp)) {
        undocumentedParams.push(`${op.method} ${op.path} → {${pp}}`);
      }
    }
  }
  results.push({
    id: 'P23', category: 'Paths', severity: 'error',
    passed: undocumentedParams.length === 0,
    message: 'All path parameters are defined in parameters',
    details: undocumentedParams.length > 0 ? `Missing: ${undocumentedParams.slice(0, 3).join('; ')}` : null,
  });

  // P24: No HTTP verb names in static path segments
  const verbsInPaths: string[] = [];
  const httpVerbWords = ['get', 'post', 'put', 'patch', 'delete', 'create', 'update', 'remove', 'fetch', 'list', 'retrieve'];
  for (const p of paths) {
    const segments = p.split('/').filter(s => s && !s.startsWith('{'));
    for (const seg of segments) {
      if (httpVerbWords.includes(seg.toLowerCase())) {
        verbsInPaths.push(`${p} (segment: "${seg}")`);
        break;
      }
    }
  }
  results.push({
    id: 'P24', category: 'Paths', severity: 'warning',
    passed: verbsInPaths.length === 0,
    message: 'Path segments do not contain HTTP verb names',
    details: verbsInPaths.length > 0 ? `Verb in path: ${verbsInPaths.slice(0, 3).join(', ')}` : null,
  });

  // P25: Path parameter names use consistent casing (no mixing camelCase and snake_case)
  const allParamNames: string[] = [];
  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || [])
      .filter((p: any) => p.in === 'path');
    allParamNames.push(...params.map((p: any) => p.name));
  }
  const hasCamel = allParamNames.some(n => /[a-z][A-Z]/.test(n));
  const hasSnake = allParamNames.some(n => n.includes('_'));
  results.push({
    id: 'P25', category: 'Paths', severity: 'suggestion',
    passed: !(hasCamel && hasSnake),
    message: 'Path parameter names use consistent casing (not mixed camelCase and snake_case)',
    details: hasCamel && hasSnake ? `Mixed casing detected in: ${[...new Set(allParamNames)].join(', ')}` : null,
  });

  // P26: No sensitive keywords in path parameters
  const sensitiveKeywords = ['key', 'token', 'secret', 'auth', 'password'];
  const sensitiveParams: string[] = [];
  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || [])
      .filter((p: any) => p.in === 'path');
    for (const p of params) {
      if (sensitiveKeywords.some(k => p.name.toLowerCase().includes(k))) {
        sensitiveParams.push(`${op.method} ${op.path} → {${p.name}}`);
      }
    }
  }
  results.push({
    id: 'P26', category: 'Paths', severity: 'warning',
    passed: sensitiveParams.length === 0,
    message: 'Path parameters should not contain sensitive keywords (key, token, secret, auth, password)',
    details: sensitiveParams.length > 0 ? `Sensitive params: ${sensitiveParams.slice(0, 3).join('; ')}` : null,
  });

  // P27: Avoid trailing dots in path segments
  const dotSegments = paths.filter(p => {
    const segments = p.split('/').filter(Boolean);
    return segments.some(s => s.endsWith('.'));
  });
  results.push({
    id: 'P27', category: 'Paths', severity: 'warning',
    passed: dotSegments.length === 0,
    message: 'Path segments should not end with a trailing dot',
    details: dotSegments.length > 0 ? `Found trailing dots in: ${dotSegments.join(', ')}` : null,
  });

  return results;
}
