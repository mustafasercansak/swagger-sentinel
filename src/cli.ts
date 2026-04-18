#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { loadSpec } from './utils/loader.js';
import { validate } from './validators/index.js';
import { generate } from './generators/index.js';
import { formatResults } from './utils/formatter.js';
import { loadConfig } from './utils/config.js';
import { ValidationResult, SentinelConfig } from './types.js';
import { RULE_REGISTRY, getRulesByCategory, getRuleExtendedInfo } from './rules/registry.js';


import { fileURLToPath } from 'url';

// Load package.json for versioning
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const program = new Command();

program
  .name('swagger-sentinel')
  .description('Opinionated OpenAPI 3.x validator and test generator')
  .version(pkg.version);

program
  .command('validate <specFile>')
  .description('Validate an OpenAPI spec against the 130-point checklist')
  .option('--strict', 'Treat warnings as errors')
  .option('--format <format>', 'Output format: text, json', 'text')
  .option('--category <category>', 'Validate only a specific category')
  .option('--rules <path>', 'Path to custom rules directory')
  .action(async (specFile: string, options: any) => {

    try {
      const config = loadConfig();
      const mergedOptions = { 
        ...options, 
        strict: options.strict || config.strict || false 
      };
      
      let customRules: any[] = [];
      if (options.rules) {
        const { loadCustomRules } = await import('./rules/manager.js');
        customRules = await loadCustomRules(options.rules);
      }

      const spec = loadSpec(specFile);
      const results = await validate(spec, { ...mergedOptions, config, customRules });
      const output = formatResults(results, options.format);

      if (options.format === 'json') {
        console.log(JSON.stringify(output, null, 2));
      } else {
        printResults(results, mergedOptions.strict);
      }

      const hasErrors = results.some(r => r.severity === 'error' && !r.passed);
      const hasWarnings = results.some(r => r.severity === 'warning' && !r.passed);

      process.exit(hasErrors || (mergedOptions.strict && hasWarnings) ? 1 : 0);
    } catch (err: any) {
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
  .option('--seed <number>', 'Seed for Faker.js consistency', '42')
  .action((specFile: string, options: any) => {
    try {
      const config = loadConfig();
      const genConfig = config.generate || {};
      
      const mergedOptions = {
        ...options,
        output: options.output !== './tests' ? options.output : (genConfig.output || './tests'),
        baseUrl: options.baseUrl !== 'http://localhost:3000' ? options.baseUrl : (genConfig.baseUrl || 'http://localhost:3000'),
        seed: options.seed !== '42' ? options.seed : (genConfig.seed || '42')
      };

      const spec = loadSpec(specFile);
      const files = generate(spec, mergedOptions);

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      for (const file of files) {
        const filePath = path.join(options.output, file.name);
        fs.writeFileSync(filePath, file.content, 'utf-8');
        console.log(chalk.green(`  ✓ ${filePath}`));
      }

      console.log(chalk.green(`\n✓ Generated ${files.length} test file(s) in ${options.output}\n`));
    } catch (err: any) {
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
  .action(async (specFile: string, options: any) => {
    const chokidar = await import('chokidar');
    const config = loadConfig();
    const mergedOptions = { 
      ...options, 
      strict: options.strict || config.strict || false 
    };

    console.log(chalk.cyan(`\n👁  Watching ${specFile} for changes...\n`));

    const runValidation = async () => {
      try {
        const spec = loadSpec(specFile);
        const results = await validate(spec, { ...mergedOptions, config });
        console.log(chalk.gray(`\n--- ${new Date().toLocaleTimeString()} ---`));
        printResults(results, mergedOptions.strict);
      } catch (err: any) {
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
  .action((specFile: string) => {
    try {
      const spec = loadSpec(specFile);

      if (!spec.openapi) throw new Error('Missing "openapi" field — not a valid OpenAPI document');
      if (!spec.info) throw new Error('Missing "info" field');
      if (!spec.paths || Object.keys(spec.paths).length === 0) throw new Error('No paths defined');

      const pathCount = Object.keys(spec.paths).length;
      let opCount = 0;
      for (const p of Object.values(spec.paths)) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          if ((p as any)[method]) opCount++;
        }
      }

      console.log(chalk.green(`\n✓ Valid OpenAPI ${spec.openapi} spec`));
      console.log(chalk.gray(`  ${pathCount} paths, ${opCount} operations\n`));
    } catch (err: any) {
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
  .action((specFile: string) => {
    try {
      const spec = loadSpec(specFile);
      const tags = new Map<string, string[]>();

      for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
        for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
          const op = (pathItem as any)[method];
          if (op && op.tags) {
            for (const tag of op.tags) {
              if (!tags.has(tag)) tags.set(tag, []);
              tags.get(tag)!.push(`${method.toUpperCase()} ${pathStr}`);
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
    } catch (err: any) {
      console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
      process.exit(1);
    }
  });

// =====================================================
// PRINT HELPERS
// =====================================================
function printResults(results: ValidationResult[], strict: boolean) {
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

// =====================================================
// RULES REGISTRY
// =====================================================
program
  .command('rules [id]')
  .description('List and explore the 130-point validation checklist')
  .option('--category <name>', 'Filter rules by category')
  .action((id: string | undefined, options: any) => {
    if (id) {
      const info = getRuleExtendedInfo(id);
      if (info) {
        console.log(`\n${info}\n`);
      } else {
        console.error(chalk.red(`\n✗ Rule not found: ${id}\n`));
        process.exit(1);
      }
      return;
    }

    const categories = ['Structure', 'Paths', 'Operations', 'Request', 'Response', 'Security', 'Documentation'];
    const filterCat = options.category;

    console.log(chalk.cyan(`\nOpenAPI 130-Point Checklist:\n`));

    for (const cat of categories) {
      if (filterCat && cat.toLowerCase() !== filterCat.toLowerCase()) continue;
      
      const rules = getRulesByCategory(cat);
      console.log(chalk.white.bold(`  ${cat} (${rules.length} checks)`));
      
      for (const rule of rules) {
        const symbol = rule.isAutomated ? chalk.green('✅') : chalk.blue('👁 ');
        const sevColor = rule.severity === 'error' ? chalk.red : (rule.severity === 'warning' ? chalk.yellow : chalk.blue);
        console.log(`    ${symbol} ${chalk.gray(rule.id.padEnd(6))} ${rule.title.padEnd(45)} ${sevColor(`(${rule.severity})`)}`);
      }
      console.log('');
    }

    if (!id) {
      console.log(chalk.gray(`Use 'swagger-sentinel rules <ID>' to see full descriptions.\n`));
    }
  });

// =====================================================
// SPECTRAL EXPORT
// =====================================================
program
  .command('export-spectral')
  .description('Export automated rules as a Spectral YAML ruleset')
  .action(async () => {
    const { generateSpectralRuleset } = await import('./rules/spectral.js');
    console.log(generateSpectralRuleset());
  });

program.parse();
