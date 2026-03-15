/**
 * Format validation results for different output formats
 */
function formatResults(results, format) {
  if (format === 'json') {
    const passed = results.filter(r => r.passed);
    const failed = results.filter(r => !r.passed);

    return {
      summary: {
        total: results.length,
        passed: passed.length,
        failed: failed.length,
        errors: failed.filter(r => r.severity === 'error').length,
        warnings: failed.filter(r => r.severity === 'warning').length,
        suggestions: failed.filter(r => r.severity === 'suggestion').length,
      },
      results: results.map(r => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        passed: r.passed,
        message: r.message,
        details: r.details || null,
      })),
    };
  }

  return results;
}

module.exports = { formatResults };
