#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { loadSpec } = require('./utils/loader');
const { validate } = require('./validators/index');
const { generate } = require('./generators/index');
const { formatResults } = require('./utils/formatter');
const pkg = require('../package.json');

const program = new Command();

program
  .name('swagger-sentinel')
  .description('Opinionated OpenAPI 3.x validator and test generator')
  .version(pkg.version);

// =====================================================
// VALIDATE
// =====================================================
program
  .command('validate <specFile>')
  .description('Validate an OpenAPI spec against the 130-point checklist')
  .option('--strict', 'Treat warnings as errors')
  .option('--format <format>', 'Output format: text, json', 'text')
  .option('--category <category>', 'Validate only a specific category')
  .action((specFile, options) => {
    try {
      const spec = loadSpec(specFile);
      const results = validate(spec, options);
      const output = formatResults(results, options.format);

      if (options.format === 'json') {
        console.log(JSON.stringify(output, null, 2));
      } else {
        printResults(results, options.strict);
      }

      const hasErrors = results.some(r => r.severity === 'error' && !r.passed);
      const hasWarnings = results.some(r => r.severity === 'warning' && !r.passed);

      process.exit(hasErrors || (options.strict && hasWarnings) ? 1 : 0);
    } catch (err) {
      console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
      process.exit(1);
    }
  });

// =====================================================
// GENERATE
// =====================================================
program
  .command('generate <specFile>')
  .description('Generate Vitest TypeScript tests from an OpenAPI spec')
  .option('--output <dir>', 'Output directory for generated tests', './tests')
  .option('--tag <tag>', 'Generate tests for a specific tag only')
  .option('--base-url <url>', 'Base URL for API requests', 'http://localhost:3000')
  .action((specFile, options) => {
    try {
      const spec = loadSpec(specFile);
      const files = generate(spec, options);

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      for (const file of files) {
        const filePath = path.join(options.output, file.name);
        fs.writeFileSync(filePath, file.content, 'utf-8');
        console.log(chalk.green(`  ✓ ${filePath}`));
      }

      console.log(chalk.green(`\n✓ Generated ${files.length} test file(s) in ${options.output}\n`));
    } catch (err) {
      console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
      process.exit(1);
    }
  });

// =====================================================
// WATCH
// =====================================================
program
  .command('watch <specFile>')
  .description('Watch spec file and re-validate on changes')
  .option('--strict', 'Treat warnings as errors')
  .action((specFile, options) => {
    const chokidar = require('chokidar');

    console.log(chalk.cyan(`\n👁  Watching ${specFile} for changes...\n`));

    const runValidation = () => {
      try {
        delete require.cache[require.resolve(path.resolve(specFile))];
        const spec = loadSpec(specFile);
        const results = validate(spec, options);
        console.log(chalk.gray(`\n--- ${new Date().toLocaleTimeString()} ---`));
        printResults(results, options.strict);
      } catch (err) {
        console.error(chalk.red(`\n✗ ${err.message}`));
      }
    };

    runValidation();

    chokidar.watch(specFile, { ignoreInitial: true }).on('change', () => {
      runValidation();
    });
  });

// =====================================================
// UTILITY: syntax check
// =====================================================
program
  .command('syntax <specFile>')
  .alias('validate-only')
  .description('Quick syntax/structure check only')
  .action((specFile) => {
    try {
      const spec = loadSpec(specFile);

      if (!spec.openapi) throw new Error('Missing "openapi" field — not a valid OpenAPI document');
      if (!spec.info) throw new Error('Missing "info" field');
      if (!spec.paths || Object.keys(spec.paths).length === 0) throw new Error('No paths defined');

      const pathCount = Object.keys(spec.paths).length;
      let opCount = 0;
      for (const p of Object.values(spec.paths)) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          if (p[method]) opCount++;
        }
      }

      console.log(chalk.green(`\n✓ Valid OpenAPI ${spec.openapi} spec`));
      console.log(chalk.gray(`  ${pathCount} paths, ${opCount} operations\n`));
    } catch (err) {
      console.error(chalk.red(`\n✗ Invalid spec: ${err.message}\n`));
      process.exit(1);
    }
  });

// =====================================================
// UTILITY: list tags
// =====================================================
program
  .command('tags <specFile>')
  .alias('list-tags')
  .description('List all operation tags in the spec')
  .action((specFile) => {
    try {
      const spec = loadSpec(specFile);
      const tags = new Map();

      for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          const op = pathItem[method];
          if (op && op.tags) {
            for (const tag of op.tags) {
              if (!tags.has(tag)) tags.set(tag, []);
              tags.get(tag).push(`${method.toUpperCase()} ${pathStr}`);
            }
          }
        }
      }

      if (tags.size === 0) {
        console.log(chalk.yellow('\n⚠ No tags found in spec\n'));
        return;
      }

      console.log(chalk.cyan(`\nTags in spec:\n`));
      for (const [tag, ops] of tags.entries()) {
        console.log(chalk.white(`  ${tag} (${ops.length} operations)`));
        for (const op of ops) console.log(chalk.gray(`    ${op}`));
      }
      console.log('');
    } catch (err) {
      console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
      process.exit(1);
    }
  });

// =====================================================
// PRINT HELPERS
// =====================================================
function printResults(results, strict) {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed && r.severity === 'error');
  const warnings = results.filter(r => !r.passed && r.severity === 'warning');
  const suggestions = results.filter(r => !r.passed && r.severity === 'suggestion');

  console.log('');
  for (const r of results) {
    if (r.passed) {
      console.log(chalk.green(`  ✓ ${r.message}`));
    } else if (r.severity === 'error') {
      console.log(chalk.red(`  ✗ ${r.message}`));
    } else if (r.severity === 'warning') {
      console.log(chalk.yellow(`  ⚠ ${r.message}`));
    } else {
      console.log(chalk.blue(`  ℹ ${r.message}`));
    }
    if (r.details && !r.passed) {
      console.log(chalk.gray(`    → ${r.details}`));
    }
  }

  const total = results.length;
  const passCount = passed.length;
  console.log('');

  if (failed.length === 0 && (!strict || warnings.length === 0)) {
    console.log(chalk.green(`✓ Validation passed: ${passCount}/${total} checks passed`));
  } else {
    console.log(chalk.red(`✗ Validation failed: ${passCount}/${total} checks passed`));
  }

  if (failed.length > 0) console.log(chalk.red(`  ${failed.length} error(s)`));
  if (warnings.length > 0) console.log(chalk.yellow(`  ${warnings.length} warning(s)`));
  if (suggestions.length > 0) console.log(chalk.blue(`  ${suggestions.length} suggestion(s)`));
  console.log('');
}

program.parse();
