import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { OpenAPISpec, ValidationResult } from '../types.js';
import { CustomValidatorFunction } from './types.js';

/**
 * Loads custom validator functions from a directory.
 */
export async function loadCustomRules(rulesPath: string): Promise<CustomValidatorFunction[]> {
  const absolutePath = path.resolve(process.cwd(), rulesPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Custom rules directory not found: ${absolutePath}`);
  }

  const files = fs.readdirSync(absolutePath).filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
  const customValidators: CustomValidatorFunction[] = [];

  for (const file of files) {
    const filePath = path.join(absolutePath, file);
    try {
      const module = await import(pathToFileURL(filePath).href);
      if (typeof module.default === 'function') {
        customValidators.push(module.default);
      } else if (typeof module.validate === 'function') {
        customValidators.push(module.validate);
      }
    } catch (err: any) {
      console.warn(`  ⚠ Failed to load custom rule ${file}: ${err.message}`);
    }
  }

  return customValidators;
}

/**
 * Runs a set of custom validators against a spec.
 */
export async function runCustomRules(spec: OpenAPISpec, validators: CustomValidatorFunction[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const validator of validators) {
    try {
      const res = await validator(spec);
      results.push(...res);
    } catch (err: any) {
      results.push({
        id: 'CUSTOM_ERR',
        category: 'Custom',
        severity: 'error',
        passed: false,
        message: `Custom validator failed: ${err.message}`
      });
    }
  }
  return results;
}
