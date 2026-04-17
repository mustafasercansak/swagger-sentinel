const { getAllOperations } = require('../utils/loader');

/**
 * Category: Documentation (10 checks, 6 automated)
 */
function validateDocumentation(spec) {
  const results = [];
  const ops = getAllOperations(spec);

  // DOC110: All parameters have description
  let totalParams = 0;
  let describedParams = 0;
  for (const op of ops) {
    const params = (op.operation.parameters || []).concat(op.pathItem.parameters || []);
    totalParams += params.length;
    describedParams += params.filter(p => !!p.description).length;
  }
  results.push({
    id: 'DOC110', category: 'Documentation', severity: 'warning',
    passed: totalParams === 0 || describedParams === totalParams,
    message: 'All parameters have descriptions',
    details: describedParams < totalParams ? `${describedParams}/${totalParams} parameters have descriptions` : null,
  });

  // DOC112: Schemas have examples
  const schemasWithoutExamples = [];
  for (const schemaName in (spec.components?.schemas || {})) {
    const schema = spec.components.schemas[schemaName];
    if (schema.properties) {
      const propsWithExamples = Object.values(schema.properties).filter(p => p.example !== undefined).length;
      const totalProps = Object.keys(schema.properties).length;
      if (propsWithExamples < totalProps * 0.5) {  // At least 50% should have examples
        schemasWithoutExamples.push(schemaName);
      }
    }
  }
  results.push({
    id: 'DOC112', category: 'Documentation', severity: 'warning',
    passed: schemasWithoutExamples.length === 0,
    message: 'Schemas include example values',
    details: schemasWithoutExamples.length > 0 ? `Low examples: ${schemasWithoutExamples.join(', ')}` : null,
  });

  // DOC115: Deprecated operations have x-sunset-date
  const deprecatedNoSunset = [];
  for (const op of ops) {
    if (op.operation.deprecated && !op.operation['x-sunset-date']) {
      deprecatedNoSunset.push(`${op.method} ${op.path}`);
    }
  }
  results.push({
    id: 'DOC115', category: 'Documentation', severity: 'warning',
    passed: deprecatedNoSunset.length === 0,
    message: 'Deprecated operations have x-sunset-date',
    details: deprecatedNoSunset.length > 0 ? `No sunset date: ${deprecatedNoSunset.join(', ')}` : null,
  });

  // DOC116: Tags have descriptions
  const tagsUsed = new Set();
  for (const op of ops) {
    for (const tag of (op.operation.tags || [])) {
      tagsUsed.add(tag);
    }
  }
  const tagDefs = (spec.tags || []).reduce((acc, t) => { acc[t.name] = t; return acc; }, {});
  const tagsNoDesc = [...tagsUsed].filter(t => !tagDefs[t] || !tagDefs[t].description);
  results.push({
    id: 'DOC116', category: 'Documentation', severity: 'suggestion',
    passed: tagsNoDesc.length === 0,
    message: 'Tags have descriptions',
    details: tagsNoDesc.length > 0 ? `No description: ${tagsNoDesc.join(', ')}` : null,
  });

  // DOC117: Operations include at least one response example
  const noExamples = [];
  for (const op of ops) {
    let hasExample = false;
    for (const resp of Object.values(op.operation.responses || {})) {
      const content = resp.content || {};
      for (const mt of Object.values(content)) {
        if (mt.example !== undefined || mt.examples !== undefined) {
          hasExample = true;
          break;
        }
        const schema = mt.schema || {};
        if (schema.example !== undefined) {
          hasExample = true;
          break;
        }
      }
      if (hasExample) break;
    }
    if (!hasExample && Object.keys(op.operation.responses || {}).length > 0) {
      noExamples.push(`${op.method} ${op.path}`);
    }
  }
  results.push({
    id: 'DOC117', category: 'Documentation', severity: 'suggestion',
    passed: noExamples.length === 0,
    message: 'Operations include at least one response example',
    details: noExamples.length > 0 ? `No examples: ${noExamples.slice(0, 3).join(', ')}${noExamples.length > 3 ? ` (+${noExamples.length - 3} more)` : ''}` : null,
  });

  // DOC118: Request bodies include an example
  const bodyNoExamples = [];
  for (const op of ops) {
    if (!op.operation.requestBody) continue;
    const content = op.operation.requestBody.content || {};
    let hasExample = false;
    for (const mt of Object.values(content)) {
      if (mt.example !== undefined || mt.examples !== undefined) {
        hasExample = true;
        break;
      }
      const schema = mt.schema || {};
      if (schema.example !== undefined) {
        hasExample = true;
        break;
      }
    }
    if (!hasExample) {
      bodyNoExamples.push(`${op.method} ${op.path}`);
    }
  }
  results.push({
    id: 'DOC118', category: 'Documentation', severity: 'suggestion',
    passed: bodyNoExamples.length === 0,
    message: 'Request bodies include an example',
    details: bodyNoExamples.length > 0 ? `No body example: ${bodyNoExamples.slice(0, 3).join(', ')}${bodyNoExamples.length > 3 ? ` (+${bodyNoExamples.length - 3} more)` : ''}` : null,
  });

  return results;
}

module.exports = { validateDocumentation };
