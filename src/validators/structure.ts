import type { OpenAPISpec, ValidationResult } from "../types.js";

/**
 * Category: Structure & Metadata (12 checks, 11 automated)
 */
export function validateStructure(spec: OpenAPISpec): ValidationResult[] {
	const results: ValidationResult[] = [];
	const info = spec.info || {};

	results.push({
		id: "S01",
		category: "Structure",
		severity: "error",
		passed: !!info.contact,
		message: "Info block must include contact information",
		details: !info.contact ? "Add info.contact with name and email" : null,
	});

	results.push({
		id: "S02",
		category: "Structure",
		severity: "error",
		passed: !!info.version && /^\d+\.\d+\.\d+/.test(info.version),
		message: "API version follows semver format",
		details:
			info.version && !/^\d+\.\d+\.\d+/.test(info.version)
				? `Found "${info.version}" — use semver (e.g., 1.2.0)`
				: null,
	});

	results.push({
		id: "S03",
		category: "Structure",
		severity: "warning",
		passed: !!(spec.servers && spec.servers.length > 0),
		message: "Servers array is defined",
		details: !(spec.servers && spec.servers.length > 0)
			? "Without servers, generated SDKs have no base URL"
			: null,
	});

	results.push({
		id: "S04",
		category: "Structure",
		severity: "error",
		passed: !!(spec.paths && Object.keys(spec.paths).length > 0),
		message: "At least one path is defined",
	});

	const version = spec.openapi || "";
	results.push({
		id: "S05",
		category: "Structure",
		severity: "error",
		passed: version.startsWith("3.0") || version.startsWith("3.1"),
		message: `OpenAPI version is 3.0.x or 3.1.x (found: ${version})`,
	});

	results.push({
		id: "S06",
		category: "Structure",
		severity: "warning",
		passed: !!info.description,
		message: "Info block has a description",
	});

	results.push({
		id: "S07",
		category: "Structure",
		severity: "suggestion",
		passed: !!info.license,
		message: "License field is specified",
		details: !info.license
			? "Important for public APIs — consumers need legal clarity"
			: null,
	});

	results.push({
		id: "S08",
		category: "Structure",
		severity: "warning",
		passed: !!info.title && info.title.length > 3,
		message: "Info title is descriptive (>3 chars)",
	});

	// Check for external docs
	results.push({
		id: "S09",
		category: "Structure",
		severity: "suggestion",
		passed: !!spec.externalDocs,
		message: "External documentation link is provided",
	});

	// Check components exist if there are responses with $ref
	const hasRefs = JSON.stringify(spec.paths || {}).includes("$ref");
	results.push({
		id: "S10",
		category: "Structure",
		severity: "error",
		passed: !hasRefs || !!spec.components,
		message: "Components section exists when $ref is used",
	});

	// S11: Terms of service specified (required for public APIs)
	results.push({
		id: "S11",
		category: "Structure",
		severity: "suggestion",
		passed: !!info.termsOfService,
		message: "Terms of service URL is specified",
		details: !info.termsOfService
			? "Add info.termsOfService for public APIs"
			: null,
	});

	return results;
}
