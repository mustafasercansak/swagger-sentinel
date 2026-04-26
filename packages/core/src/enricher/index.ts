import type { OpenAPISchema, OpenAPISpec } from "../types.js";
import { createLLMProvider } from "./llm.js";
import type { MissingItem } from "./types.js";

export interface EnrichOptions {
	provider: "gemini" | "openai";
	apiKey: string;
	lang: string;
}

export interface EnrichResult {
	enrichedCount: number;
	spec: OpenAPISpec;
	items: { id: string; path: string; summary?: string; description?: string }[];
}

export async function enrichSpec(
	spec: OpenAPISpec,
	options: EnrichOptions,
): Promise<EnrichResult> {
	const missingItems: MissingItem[] = [];

	// 1. Scan Operations
	if (spec.paths) {
		for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
			if (!pathItem) continue;
			for (const method of [
				"get",
				"post",
				"put",
				"patch",
				"delete",
				"options",
				"head",
			]) {
				const operation = (pathItem as Record<string, Record<string, unknown>>)[method];
				if (operation) {
					if (!operation.summary || !operation.description) {
						missingItems.push({
							id: `op:${method}:${pathStr}`,
							type: "operation",
							path: `${method.toUpperCase()} ${pathStr}`,
							context: {
								method,
								path: pathStr,
								parameters: operation.parameters,
								requestBody: operation.requestBody,
								responses: operation.responses
									? Object.keys(operation.responses)
									: [],
							},
						});
					}
				}
			}
		}
	}

	// 2. Scan Schemas
	if (spec.components?.schemas) {
		for (const [schemaName, _schemaObj] of Object.entries(
			spec.components.schemas,
		)) {
			const schemaObj = _schemaObj as OpenAPISchema;
			if (schemaObj && !schemaObj.description) {
				missingItems.push({
					id: `schema:${schemaName}`,
					type: "schema",
					path: schemaName,
					context: {
						name: schemaName,
						type: schemaObj.type,
						properties: schemaObj.properties
							? Object.keys(schemaObj.properties)
							: [],
					},
				});
			}
		}
	}

	if (missingItems.length === 0) {
		return { enrichedCount: 0, spec, items: [] };
	}

	// 3. Batch Call to LLM
	const llm = createLLMProvider(options.provider, options.apiKey);
	const enrichedItems = await llm.enrichBatch(missingItems, options.lang);

	const resultsForLog: { id: string; path: string; summary?: string; description?: string }[] = [];
	let count = 0;

	// 4. Merge results back into the spec
	for (const item of enrichedItems) {
		const missingItem = missingItems.find((m) => m.id === item.id);
		if (!missingItem) continue;

		let changed = false;
		if (item.id.startsWith("op:")) {
			// Extract method and path
			const parts = item.id.split(":");
			const method = parts[1];
			const pathStr = parts.slice(2).join(":"); // in case path has colons

			const operation = (spec.paths as Record<
				string,
				Record<string, Record<string, string>>
			>)?.[pathStr]?.[method];
			if (operation) {
				if (!operation.summary && item.summary) {
					operation.summary = item.summary;
					count++;
					changed = true;
				}
				if (!operation.description && item.description) {
					operation.description = item.description;
					count++;
					changed = true;
				}
			}
		} else if (item.id.startsWith("schema:")) {
			const schemaName = item.id.split(":")[1];
			const schemaObj = (spec.components?.schemas as Record<
				string,
				Record<string, string>
			>)?.[schemaName];
			if (schemaObj) {
				if (!schemaObj.description && item.description) {
					schemaObj.description = item.description;
					count++;
					changed = true;
				}
			}
		}

		if (changed) {
			resultsForLog.push({
				id: item.id,
				path: missingItem.path,
				summary: item.summary,
				description: item.description,
			});
		}
	}

	return { enrichedCount: count, spec, items: resultsForLog };
}
