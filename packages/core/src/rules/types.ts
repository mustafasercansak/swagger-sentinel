import type { OpenAPISpec, Severity, ValidationResult } from "../types.js";

export type RuleCategory =
	| "Structure"
	| "Paths"
	| "Operations"
	| "Request"
	| "Response"
	| "Security"
	| "Documentation";

export interface RuleDefinition {
	id: string;
	category: RuleCategory;
	title: string;
	description: string;
	severity: Severity;
	isAutomated: boolean;
	/**
	 * Context is a short string helping users find where the fix should be applied.
	 */
	context?: string;
}

export type CustomValidatorFunction = (
	spec: OpenAPISpec,
) => ValidationResult[] | Promise<ValidationResult[]>;
