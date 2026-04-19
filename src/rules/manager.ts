import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { OpenAPISpec, ValidationResult } from "../types.js";
import type { CustomValidatorFunction } from "./types.js";

/**
 * Loads custom validator functions from a directory.
 */
export async function loadCustomRules(
	rulesPath: string,
): Promise<CustomValidatorFunction[]> {
	const absolutePath = path.resolve(process.cwd(), rulesPath);
	if (!fs.existsSync(absolutePath)) {
		throw new Error(`Custom rules directory not found: ${absolutePath}`);
	}

	const files = fs
		.readdirSync(absolutePath)
		.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
	const customValidators: CustomValidatorFunction[] = [];

	for (const file of files) {
		const filePath = path.join(absolutePath, file);
		try {
			const module = await import(pathToFileURL(filePath).href);
			if (typeof module.default === "function") {
				customValidators.push(module.default);
			} else if (typeof module.validate === "function") {
				customValidators.push(module.validate);
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(`  ⚠ Failed to load custom rule ${file}: ${message}`);
		}
	}

	return customValidators;
}

/**
 * Runs a set of custom validators against a spec.
 */
export async function runCustomRules(
	spec: OpenAPISpec,
	validators: CustomValidatorFunction[],
): Promise<ValidationResult[]> {
	const results: ValidationResult[] = [];
	for (const validator of validators) {
		try {
			const res = await validator(spec);
			results.push(...res);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			results.push({
				id: "CUSTOM_ERR",
				category: "Custom",
				severity: "error",
				passed: false,
				message: `Custom validator failed: ${message}`,
			});
		}
	}
	return results;
}
