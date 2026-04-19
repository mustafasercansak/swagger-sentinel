import type { OpenAPISpec, ValidationResult, OpenAPIParameter, OpenAPISchema } from "../types.js";
import { getAllOperations, type OperationEntry } from "../utils/loader.js";

/**
 * Category: Documentation (10 checks, 6 automated)
 */
export function validateDocumentation(spec: OpenAPISpec): ValidationResult[] {
	const results: ValidationResult[] = [];
	const ops = getAllOperations(spec);

	// DOC110: All parameters have description
	let totalParams = 0;
	let describedParams = 0;
	for (const op of ops) {
		const params: OpenAPIParameter[] = (op.operation.parameters || []).concat(
			op.pathItem.parameters || [],
		);
		totalParams += params.length;
		describedParams += params.filter((p) => !!p.description).length;
	}
	results.push({
		id: "DOC110",
		category: "Documentation",
		severity: "warning",
		passed: totalParams === 0 || describedParams === totalParams,
		message: "All parameters have descriptions",
		details:
			describedParams < totalParams
				? `${describedParams}/${totalParams} parameters have descriptions`
				: null,
	});

	// DOC112: Schemas have examples
	const schemasWithoutExamples: string[] = [];
	for (const [schemaName, schema] of Object.entries(
		spec.components?.schemas || {},
	)) {
		if (schema.properties) {
			const propsWithExamples = Object.values(schema.properties).filter(
				(p) => p.example !== undefined,
			).length;
			const totalProps = Object.keys(schema.properties).length;
			if (propsWithExamples < totalProps * 0.5) {
				// At least 50% should have examples
				schemasWithoutExamples.push(schemaName);
			}
		}
	}
	results.push({
		id: "DOC112",
		category: "Documentation",
		severity: "warning",
		passed: schemasWithoutExamples.length === 0,
		message: "Schemas include example values",
		details:
			schemasWithoutExamples.length > 0
				? `Low examples: ${schemasWithoutExamples.join(", ")}`
				: null,
	});

	// DOC115: Deprecated operations have x-sunset-date
	const deprecatedNoSunset: string[] = [];
	for (const op of ops) {
		if (op.operation.deprecated && !op.operation["x-sunset-date"]) {
			deprecatedNoSunset.push(`${op.method} ${op.path}`);
		}
	}
	results.push({
		id: "DOC115",
		category: "Documentation",
		severity: "warning",
		passed: deprecatedNoSunset.length === 0,
		message: "Deprecated operations have x-sunset-date",
		details:
			deprecatedNoSunset.length > 0
				? `No sunset date: ${deprecatedNoSunset.join(", ")}`
				: null,
	});

	// DOC116: Tags have descriptions
	const tagsUsed = new Set<string>();
	for (const op of ops) {
		for (const tag of op.operation.tags || []) {
			tagsUsed.add(tag);
		}
	}
	const tagDefs = (spec.tags || []).reduce((acc: Record<string, any>, t) => {
		acc[t.name] = t;
		return acc;
	}, {});
	const tagsNoDesc = [...tagsUsed].filter(
		(t) => !tagDefs[t] || !tagDefs[t].description,
	);
	results.push({
		id: "DOC116",
		category: "Documentation",
		severity: "suggestion",
		passed: tagsNoDesc.length === 0,
		message: "Tags have descriptions",
		details:
			tagsNoDesc.length > 0 ? `No description: ${tagsNoDesc.join(", ")}` : null,
	});

	// DOC117: Operations include at least one response example
	const noExamples: string[] = [];
	for (const op of ops) {
		let hasExample = false;
		const responses = op.operation.responses || {};
		for (const [code, resp] of Object.entries(responses)) {
			// 204 No Content shouldn't require an example
			if (code === "204") continue;

			// Check for inline example
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

			// Check for example in referenced component response
			if (resp.$ref) {
				const refName = resp.$ref.split("/").pop() || "";
				const componentResp = spec.components?.responses?.[refName];
				if (componentResp) {
					const cContent = componentResp.content || {};
					for (const cMt of Object.values(cContent) as any[]) {
						if (
							cMt.example !== undefined ||
							cMt.examples !== undefined ||
							(cMt.schema && cMt.schema.example !== undefined)
						) {
							hasExample = true;
							break;
						}
					}
				}
			}
			if (hasExample) break;
		}

		if (
			!hasExample &&
			Object.keys(responses).filter((c) => c !== "204").length > 0
		) {
			noExamples.push(`${op.method} ${op.path}`);
		}
	}
	results.push({
		id: "DOC117",
		category: "Documentation",
		severity: "suggestion",
		passed: noExamples.length === 0,
		message: "Operations include at least one response example",
		details:
			noExamples.length > 0
				? `No examples: ${noExamples.slice(0, 3).join(", ")}${noExamples.length > 3 ? ` (+${noExamples.length - 3} more)` : ""}`
				: null,
	});

	// DOC118: Request bodies include an example
	const bodyNoExamples: string[] = [];
	for (const op of ops) {
		if (!op.operation.requestBody) continue;

		let content = op.operation.requestBody.content || {};

		// Resolve $ref if present
		if (op.operation.requestBody.$ref) {
			const refName = op.operation.requestBody.$ref.split("/").pop() || "";
			const componentBody = spec.components?.requestBodies?.[refName];
			if (componentBody) {
				content = componentBody.content || {};
			}
		}

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
		id: "DOC118",
		category: "Documentation",
		severity: "suggestion",
		passed: bodyNoExamples.length === 0,
		message: "Request bodies include an example",
		details:
			bodyNoExamples.length > 0
				? `No body example: ${bodyNoExamples.slice(0, 3).join("; ")}${bodyNoExamples.length > 3 ? ` (+${bodyNoExamples.length - 3} more)` : ""}`
				: null,
	});

	// DOC119: API description is detailed
	const description = spec.info?.description || "";
	results.push({
		id: "DOC119",
		category: "Documentation",
		severity: "warning",
		passed: description.length > 20,
		message: "The API info block has a detailed description (>20 characters)",
		details:
			description.length <= 20
				? `Current description is too short (${description.length} chars)`
				: null,
	});

	// DOC120: Every property in components.schemas should have a description
	const propsNoDesc: string[] = [];
	for (const [schemaName, schema] of Object.entries(
		spec.components?.schemas || {},
	)) {
		if (schema.properties) {
			for (const [propName, p] of Object.entries(schema.properties)) {
				const propSchema = p as OpenAPISchema;
				if (!propSchema.description) {
					propsNoDesc.push(`${schemaName}.${propName}`);
				}
			}
		}
	}
	results.push({
		id: "DOC120",
		category: "Documentation",
		severity: "warning",
		passed: propsNoDesc.length === 0,
		message: "All schema properties have descriptions",
		details:
			propsNoDesc.length > 0
				? `Missing: ${propsNoDesc.slice(0, 3).join(", ")}${propsNoDesc.length > 3 ? ` (+${propsNoDesc.length - 3} more)` : ""}`
				: null,
	});

	return results;
}
