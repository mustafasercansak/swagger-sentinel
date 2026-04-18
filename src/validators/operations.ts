import { getAllOperations } from '../utils/loader.js';
import { OpenAPISpec, ValidationResult } from '../types.js';

/**
 * Category: Operations (22 checks, 13 automated)
 */
export function validateOperations(spec: OpenAPISpec): ValidationResult[] {
  const results: ValidationResult[] = [];
  const ops = getAllOperations(spec);

  // O31: Every operation has operationId
  const missingOpId = ops.filter(o => !o.operation.operationId);
  results.push({
    id: 'O31', category: 'Operations', severity: 'error',
    passed: missingOpId.length === 0,
    message: 'Every operation has operationId',
    details: missingOpId.length > 0 ? `Missing: ${missingOpId.map(o => `${o.method} ${o.path}`).slice(0, 3).join(', ')}` : null,
  });

  // O31b: operationIds are unique
  const opIds = ops.map(o => o.operation.operationId).filter(Boolean);
  const dupes = opIds.filter((id, i) => opIds.indexOf(id) !== i);
  results.push({
    id: 'O31b', category: 'Operations', severity: 'error',
    passed: dupes.length === 0,
    message: 'All operationIds are unique',
    details: dupes.length > 0 ? `Duplicates: ${[...new Set(dupes)].join(', ')}` : null,
  });

  // O32: POST returns 201 or 202, not 200
  const postOps = ops.filter(o => o.method === 'POST');
  const postWith200 = postOps.filter(o => {
    const responses = o.operation.responses || {};
    return responses['200'] && !responses['201'] && !responses['202'];
  });
  results.push({
    id: 'O32', category: 'Operations', severity: 'warning',
    passed: postWith200.length === 0,
    message: 'POST operations return 201 or 202, not 200',
    details: postWith200.length > 0 ? `Found 200 on: ${postWith200.map(o => o.path).join(', ')}` : null,
  });

  // O33: DELETE returns 204
  const deleteOps = ops.filter(o => o.method === 'DELETE');
  const deleteNon204 = deleteOps.filter(o => {
    const responses = o.operation.responses || {};
    return !responses['204'] && (responses['200'] || responses['202']);
  });
  results.push({
    id: 'O33', category: 'Operations', severity: 'warning',
    passed: deleteNon204.length === 0,
    message: 'DELETE operations return 204, not 200',
    details: deleteNon204.length > 0 ? `Non-204: ${deleteNon204.map(o => o.path).join(', ')}` : null,
  });

  // O34: All operations have at least one tag
  const untagged = ops.filter(o => !o.operation.tags || o.operation.tags.length === 0);
  results.push({
    id: 'O34', category: 'Operations', severity: 'warning',
    passed: untagged.length === 0,
    message: 'All operations have at least one tag',
    details: untagged.length > 0 ? `Untagged: ${untagged.map(o => `${o.method} ${o.path}`).slice(0, 3).join(', ')}` : null,
  });

  // O35: GET operations that return arrays support pagination
  const listOpsWithoutPagination: string[] = [];
  const getOps = ops.filter(o => o.method === 'GET');
  for (const op of getOps) {
    const responses = op.operation.responses || {};
    const success = responses['200'] || responses['201'];
    if (!success) continue;

    const content = success.content || {};
    for (const mediaType of Object.values(content) as any[]) {
      const schema = mediaType.schema || {};
      if (schema.type === 'array' || (schema.properties && schema.properties.items && schema.properties.items.type === 'array')) {
        const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
        const hasPagination = params.some((p: any) => ['page', 'limit', 'offset', 'cursor', 'pageSize', 'page_size'].includes(p.name));
        if (!hasPagination) {
          listOpsWithoutPagination.push(`${op.method} ${op.path}`);
        }
      }
    }
  }
  results.push({
    id: 'O35', category: 'Operations', severity: 'warning',
    passed: listOpsWithoutPagination.length === 0,
    message: 'List operations support pagination',
    details: listOpsWithoutPagination.length > 0 ? `No pagination: ${listOpsWithoutPagination.join(', ')}` : null,
  });

  // O36: All operations have summary or description
  const undescribed = ops.filter(o => !o.operation.summary && !o.operation.description);
  results.push({
    id: 'O36', category: 'Operations', severity: 'warning',
    passed: undescribed.length === 0,
    message: 'All operations have summary or description',
    details: undescribed.length > 0 ? `Missing: ${undescribed.map(o => `${o.method} ${o.path}`).slice(0, 3).join(', ')}` : null,
  });

  // O37: PUT/PATCH have request body
  const putPatch = ops.filter(o => o.method === 'PUT' || o.method === 'PATCH');
  const noBody = putPatch.filter(o => !o.operation.requestBody);
  results.push({
    id: 'O37', category: 'Operations', severity: 'warning',
    passed: noBody.length === 0,
    message: 'PUT/PATCH operations have request body defined',
    details: noBody.length > 0 ? `No body: ${noBody.map(o => `${o.method} ${o.path}`).join(', ')}` : null,
  });

  // O38: No operation uses both query and body for same data
  const postWithQuery = postOps.filter(o => {
    const params = (o.operation.parameters || []).filter((p: any) => p.in === 'query');
    return params.length > 0 && o.operation.requestBody;
  });
  results.push({
    id: 'O38', category: 'Operations', severity: 'suggestion',
    passed: postWithQuery.length === 0,
    message: 'POST/PUT operations prefer body over query parameters',
    details: postWithQuery.length > 0 ? `Mixed: ${postWithQuery.map(o => o.path).join(', ')}` : null,
  });

  // O39: HEAD method defined wherever GET is defined
  const getPathsWithoutHead: string[] = [];
  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    if (pathItem.get && !pathItem.head) {
      getPathsWithoutHead.push(pathStr);
    }
  }
  results.push({
    id: 'O39', category: 'Operations', severity: 'suggestion',
    passed: getPathsWithoutHead.length === 0,
    message: 'HEAD method defined wherever GET is defined',
    details: getPathsWithoutHead.length > 0 ? `Missing HEAD: ${getPathsWithoutHead.slice(0, 3).join(', ')}${getPathsWithoutHead.length > 3 ? ` (+${getPathsWithoutHead.length - 3} more)` : ''}` : null,
  });

  // O40: PATCH uses application/merge-patch+json or application/json-patch+json
  const patchOps = ops.filter(o => o.method === 'PATCH');
  const patchWrongType = patchOps.filter(o => {
    const content = o.operation.requestBody?.content || {};
    const types = Object.keys(content);
    if (types.length === 0) return false;
    return !types.some(t => ['application/merge-patch+json', 'application/json-patch+json', 'application/json'].includes(t));
  });
  results.push({
    id: 'O40', category: 'Operations', severity: 'suggestion',
    passed: patchWrongType.length === 0,
    message: 'PATCH operations use JSON merge-patch or JSON patch content type',
    details: patchWrongType.length > 0 ? `Unexpected content type: ${patchWrongType.map(o => o.path).join(', ')}` : null,
  });

  // O41: No verb names in operationIds that duplicate HTTP method
  const verbInId: string[] = [];
  for (const op of ops) {
    if (!op.operation.operationId) continue;
    const id = op.operation.operationId.toLowerCase();
    const method = op.method.toLowerCase();
    if (id.startsWith(method) && method !== 'get') {
      verbInId.push(`${op.method} ${op.path} → "${op.operation.operationId}"`);
    }
  }
  results.push({
    id: 'O41', category: 'Operations', severity: 'suggestion',
    passed: verbInId.length === 0,
    message: 'operationIds do not redundantly prefix the HTTP method',
    details: verbInId.length > 0 ? `Redundant prefix: ${verbInId.slice(0, 3).join('; ')}` : null,
  });

  // O42: GET operations should not have a requestBody
  const getWithBody = ops.filter(o => o.method === 'GET' && o.operation.requestBody);
  results.push({
    id: 'O42', category: 'Operations', severity: 'error',
    passed: getWithBody.length === 0,
    message: 'GET operations do not have a requestBody',
    details: getWithBody.length > 0 ? `Found body on: ${getWithBody.map(o => o.path).join(', ')}` : null,
  });

  // O43: 429 Too Many Requests include rate-limit headers
  const rateLimitMissingHeaders: string[] = [];
  for (const op of ops) {
    const responses = op.operation.responses || {};
    const resp429 = responses['429'];
    if (resp429) {
      const headers = resp429.headers || {};
      const hasRateLimit = Object.keys(headers).some(h =>
        ['retry-after', 'x-ratelimit-limit', 'ratelimit-limit'].includes(h.toLowerCase())
      );
      if (!hasRateLimit) {
        rateLimitMissingHeaders.push(`${op.method} ${op.path}`);
      }
    }
  }
  results.push({
    id: 'O43', category: 'Operations', severity: 'warning',
    passed: rateLimitMissingHeaders.length === 0,
    message: '429 Too Many Requests responses include rate-limit or retry headers',
    details: rateLimitMissingHeaders.length > 0 ? `Missing headers: ${rateLimitMissingHeaders.join(', ')}` : null,
  });

  // O44: 202 Accepted include Location or Link header
  const acceptedMissingHeaders: string[] = [];
  for (const op of ops) {
    const responses = op.operation.responses || {};
    const resp202 = responses['202'];
    if (resp202) {
      const headers = resp202.headers || {};
      const hasLocation = Object.keys(headers).some(h =>
        ['location', 'link'].includes(h.toLowerCase())
      );
      if (!hasLocation) {
        acceptedMissingHeaders.push(`${op.method} ${op.path}`);
      }
    }
  }
  results.push({
    id: 'O44', category: 'Operations', severity: 'suggestion',
    passed: acceptedMissingHeaders.length === 0,
    message: '202 Accepted responses include a Location or Link header for status polling',
    details: acceptedMissingHeaders.length > 0 ? `Missing headers: ${acceptedMissingHeaders.join(', ')}` : null,
  });

  return results;
}
