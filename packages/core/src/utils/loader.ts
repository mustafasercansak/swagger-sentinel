import fs from "node:fs";
import path from "node:path";
import SwaggerParser from "@apidevtools/json-schema-ref-parser";
import type {
	OpenAPIOperation,
	OpenAPIPathItem,
	OpenAPISpec,
} from "../types.js";

/**
 * Load and parse an OpenAPI spec from YAML or JSON file.
 * Handles full $ref resolution (internal and external).
 */
export async function loadSpec(filePath: string): Promise<OpenAPISpec> {
	const resolved = path.resolve(filePath);

	if (!fs.existsSync(resolved)) {
		throw new Error(`File not found: ${resolved}`);
	}

	try {
		const parser = new SwaggerParser();
		const spec = (await parser.dereference(resolved)) as OpenAPISpec;

		if (!spec || typeof spec !== "object") {
			throw new Error(
				"Failed to parse spec — not a valid YAML or JSON document",
			);
		}

		const openapi = spec.openapi;
		if (!openapi) {
			throw new Error(
				'Missing "openapi" field — is this an OpenAPI 3.x document?',
			);
		}

		const majorMinor = String(openapi).split(".").slice(0, 2).join(".");
		if (!majorMinor.startsWith("3.")) {
			throw new Error(
				`Unsupported OpenAPI version: ${openapi}. Only 3.x is supported.`,
			);
		}

		return spec as OpenAPISpec;
	} catch (err: unknown) {
		const error = err as Error;
		throw new Error(`Failed to load OpenAPI spec: ${error.message}`);
	}
}

/**
 * Resolve $ref within a spec (fallback for cases where dereference wasn't used)
 */
export function resolveRef(
	spec: OpenAPISpec,
	ref: string | undefined,
): unknown {
	if (!ref) return null;
	if (ref.startsWith("#/")) {
		const parts = ref.replace("#/", "").split("/");
		let current: Record<string, unknown> | null | undefined =
			spec as unknown as Record<string, unknown>;
		for (const part of parts) {
			current = (current as Record<string, unknown>)?.[part] as
				| Record<string, unknown>
				| undefined;
		}
		return current;
	}
	// External refs should already be resolved if loadSpec was used
	return null;
}

export interface OperationEntry {
	path: string;
	method: string;
	operation: OpenAPIOperation;
	pathItem: OpenAPIPathItem;
}

/**
 * Get all operations from a spec as a flat list
 */
export function getAllOperations(spec: OpenAPISpec): OperationEntry[] {
	const operations: OperationEntry[] = [];
	const methods = [
		"get",
		"post",
		"put",
		"patch",
		"delete",
		"head",
		"options",
	] as const;

	for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
		for (const method of methods) {
			const op = pathItem[method];
			if (op) {
				operations.push({
					path: pathStr,
					method: method.toUpperCase(),
					operation: op,
					pathItem,
				});
			}
		}
	}

	return operations;
}
