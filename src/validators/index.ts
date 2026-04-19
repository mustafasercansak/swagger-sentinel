import type {
	OpenAPISpec,
	SentinelConfig,
	ValidationResult,
	ValidatorFunction,
} from "../types.js";
import { validateDocumentation } from "./documentation.js";
import { validateOperations } from "./operations.js";
import { validatePaths } from "./paths.js";
import { validateRequests } from "./request.js";
import { validateResponses } from "./response.js";
import { validateSecurity } from "./security.js";
import { validateStructure } from "./structure.js";

/**
 * Run all validation categories against a spec.
 * Returns a flat array of check results.
 */
export async function validate(
	spec: OpenAPISpec,
	options: {
		category?: string;
		config?: SentinelConfig;
		customRules?: any[];
	} = {},
): Promise<ValidationResult[]> {
	const categoryFilter = options.category
		? options.category.toLowerCase()
		: null;
	const config = options.config || {};
	const customRules = options.customRules || [];

	const categories: Record<string, ValidatorFunction> = {
		structure: validateStructure,
		paths: validatePaths,
		operations: validateOperations,
		request: validateRequests,
		response: validateResponses,
		security: validateSecurity,
		documentation: validateDocumentation,
	};

	let rawResults: ValidationResult[] = [];

	for (const [name, validator] of Object.entries(categories)) {
		if (categoryFilter && !name.startsWith(categoryFilter)) continue;
		try {
			const checks = validator(spec);
			rawResults = rawResults.concat(checks);
		} catch (err: any) {
			rawResults.push({
				id: `${name.toUpperCase()}_ERR`,
				category: name,
				severity: "error",
				passed: false,
				message: `${name} validation crashed: ${err.message}`,
			});
		}
	}

	// Inject Custom Rules
	if (customRules.length > 0) {
		const { runCustomRules } = await import("../rules/manager.js");
		const customResults = await runCustomRules(spec, customRules);
		rawResults.push(...customResults);
	}

	// Apply configuration (ignores and overrides)
	const ignoreList = config.ignore || [];
	const overrides = config.overrides || {};

	return rawResults
		.filter((r) => !ignoreList.includes(r.id))
		.map((r) => {
			if (overrides[r.id]) {
				return { ...r, severity: overrides[r.id] };
			}
			return r;
		});
}
