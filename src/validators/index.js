const { validateStructure } = require('./structure');
const { validatePaths } = require('./paths');
const { validateOperations } = require('./operations');
const { validateRequests } = require('./request');
const { validateResponses } = require('./response');
const { validateSecurity } = require('./security');
const { validateDocumentation } = require('./documentation');

/**
 * Run all validation categories against a spec.
 * Returns a flat array of check results.
 */
function validate(spec, options = {}) {
  const categoryFilter = options.category ? options.category.toLowerCase() : null;

  const categories = {
    structure: validateStructure,
    paths: validatePaths,
    operations: validateOperations,
    request: validateRequests,
    response: validateResponses,
    security: validateSecurity,
    documentation: validateDocumentation,
  };

  let results = [];

  for (const [name, validator] of Object.entries(categories)) {
    if (categoryFilter && !name.startsWith(categoryFilter)) continue;
    try {
      const checks = validator(spec);
      results = results.concat(checks);
    } catch (err) {
      results.push({
        id: `${name.toUpperCase()}_ERR`,
        category: name,
        severity: 'error',
        passed: false,
        message: `${name} validation crashed: ${err.message}`,
      });
    }
  }

  return results;
}

module.exports = { validate };
