import type {
	OpenAPIResponse,
	OpenAPISpec,
	ValidationResult,
} from "../types.js";
import { getAllOperations, resolveRef } from "../utils/loader.js";

/**
 * Category: Response Design (20 checks, 10 automated)
 */
export function validateResponses(spec: OpenAPISpec): ValidationResult[] {
	const results: ValidationResult[] = [];
	const ops = getAllOperations(spec);

	// Collect error response schemas to check consistency
	const errorSchemaRefs = new Set<string>();
	const opsWithout4xxBody: string[] = [];
	const opsWithout5xx: string[] = [];
	const opsWithoutAnyResponse: string[] = [];

	for (const op of ops) {
		const responses = op.operation.responses || {};
		const label = `${op.method} ${op.path}`;

		// Check responses exist
		if (Object.keys(responses).length === 0) {
			opsWithoutAnyResponse.push(label);
			continue;
		}

		// Check 4xx have bodies
		for (const [code, resp] of Object.entries(responses)) {
			if (code.startsWith("4") || code.startsWith("5")) {
				const content =
					resp.content ||
					(resp.$ref
						? (resolveRef(spec, resp.$ref) as OpenAPIResponse)?.content
						: null);
				if (!content && code.startsWith("4") && code !== "404") {
					opsWithout4xxBody.push(`${label} → ${code}`);
				}

				// Track error schema refs
				if (content) {
					for (const mt of Object.values(content) as Array<{
						schema?: { $ref?: string };
					}>) {
						if (mt.schema?.$ref) {
							errorSchemaRefs.add(mt.schema.$ref);
						}
					}
				}
			}
		}

		// Check 5xx defined
		const has5xx = Object.keys(responses).some(
			(c) => c.startsWith("5") || c === "default",
		);
		if (!has5xx) {
			opsWithout5xx.push(label);
		}
	}

	// R70: Consistent error schema
	results.push({
		id: "R70",
		category: "Response",
		severity: "warning",
		passed: errorSchemaRefs.size <= 2, // Allow ErrorResponse + ValidationErrorResponse
		message: "Error responses use a consistent schema",
		details:
			errorSchemaRefs.size > 2
				? `Found ${errorSchemaRefs.size} different error schemas: ${[...errorSchemaRefs].join(", ")}`
				: null,
	});

	// R71: 4xx have response body
	results.push({
		id: "R71",
		category: "Response",
		severity: "warning",
		passed: opsWithout4xxBody.length === 0,
		message: "All 4xx responses have a response body",
		details:
			opsWithout4xxBody.length > 0
				? `No body: ${opsWithout4xxBody.slice(0, 3).join("; ")}`
				: null,
	});

	// R72: 5xx responses defined
	results.push({
		id: "R72",
		category: "Response",
		severity: "suggestion",
		passed: opsWithout5xx.length === 0,
		message: "5xx or default error responses are defined",
		details:
			opsWithout5xx.length > 0
				? `No 5xx: ${opsWithout5xx.slice(0, 3).join(", ")}`
				: null,
	});

	// R73: All operations have at least one response
	results.push({
		id: "R73",
		category: "Response",
		severity: "error",
		passed: opsWithoutAnyResponse.length === 0,
		message: "All operations define at least one response",
		details:
			opsWithoutAnyResponse.length > 0
				? `No responses: ${opsWithoutAnyResponse.join(", ")}`
				: null,
	});

	// R74: Successful responses have content defined (except 204)
	const successNoContent: string[] = [];
	for (const op of ops) {
		const responses = op.operation.responses || {};
		for (const [code, resp] of Object.entries(responses)) {
			if (code.startsWith("2") && code !== "204") {
				if (!resp.content && !resp.$ref) {
					successNoContent.push(`${op.method} ${op.path} → ${code}`);
				}
			}
		}
	}
	results.push({
		id: "R74",
		category: "Response",
		severity: "warning",
		passed: successNoContent.length === 0,
		message: "Success responses (except 204) have content defined",
		details:
			successNoContent.length > 0
				? `No content: ${successNoContent.slice(0, 3).join("; ")}`
				: null,
	});

	// R75: 429 has rate-limit headers
	const ops429: string[] = [];
	for (const op of ops) {
		const resp429 = op.operation.responses?.["429"];
		if (resp429) {
			let headers = resp429.headers || {};
			if (resp429.$ref) {
				const refResp = resolveRef(spec, resp429.$ref);
				if (refResp) headers = (refResp as OpenAPIResponse).headers || {};
			}
			const hasRateHeaders = [
				"Retry-After",
				"X-RateLimit-Limit",
				"X-RateLimit-Remaining",
				"X-RateLimit-Reset",
			].some((h) =>
				Object.keys(headers).some((k) => k.toLowerCase() === h.toLowerCase()),
			);
			if (!hasRateHeaders) {
				ops429.push(`${op.method} ${op.path}`);
			}
		}
	}
	results.push({
		id: "R75",
		category: "Response",
		severity: "warning",
		passed: ops429.length === 0,
		message: "429 responses include rate-limit headers",
		details: ops429.length > 0 ? `Missing headers: ${ops429.join(", ")}` : null,
	});

	// R76: Response schemas define required fields
	const schemasNoRequired: string[] = [];
	for (const [schemaName, schema] of Object.entries(
		spec.components?.schemas || {},
	)) {
		if (
			schema.type === "object" &&
			schema.properties &&
			(!schema.required || schema.required.length === 0)
		) {
			schemasNoRequired.push(schemaName);
		}
	}
	results.push({
		id: "R76",
		category: "Response",
		severity: "warning",
		passed: schemasNoRequired.length === 0,
		message: "All schemas define required fields",
		details:
			schemasNoRequired.length > 0
				? `No required: ${schemasNoRequired.join(", ")}`
				: null,
	});

	// R77: 201 Created responses include a Location header
	const created201NoLocation: string[] = [];
	for (const op of ops) {
		const resp201 = op.operation.responses?.["201"];
		if (resp201) {
			let headers = resp201.headers || {};
			if (resp201.$ref) {
				const refResp = resolveRef(spec, resp201.$ref);
				if (refResp) headers = (refResp as OpenAPIResponse).headers || {};
			}
			const hasLocation = Object.keys(headers).some(
				(h) => h.toLowerCase() === "location",
			);
			if (!hasLocation) {
				created201NoLocation.push(`${op.method} ${op.path}`);
			}
		}
	}
	results.push({
		id: "R77",
		category: "Response",
		severity: "suggestion",
		passed: created201NoLocation.length === 0,
		message: "201 Created responses include a Location header",
		details:
			created201NoLocation.length > 0
				? `Missing Location: ${created201NoLocation.join(", ")}`
				: null,
	});

	// R78: List GET responses have total count (x-total-count header or wrapper object)
	const listNoCount: string[] = [];
	for (const op of ops) {
		if (op.method !== "GET") continue;
		const resp200 = op.operation.responses?.["200"];
		if (!resp200) continue;
		const content = resp200.content || {};
		for (const mediaType of Object.values(content)) {
			const schema = mediaType.schema || {};
			if (schema.type === "array") {
				let headers = resp200.headers || {};
				if (resp200.$ref) {
					const refResp = resolveRef(spec, resp200.$ref);
					if (refResp) headers = (refResp as OpenAPIResponse).headers || {};
				}
				const hasTotalCount = Object.keys(headers).some(
					(h) =>
						h.toLowerCase() === "x-total-count" ||
						h.toLowerCase() === "x-pagination-total",
				);
				const hasWrapperCount =
					schema.properties?.total !== undefined ||
					schema.properties?.count !== undefined;
				if (!hasTotalCount && !hasWrapperCount) {
					listNoCount.push(`${op.method} ${op.path}`);
				}
			}
		}
	}
	results.push({
		id: "R78",
		category: "Response",
		severity: "suggestion",
		passed: listNoCount.length === 0,
		message: "List responses include total count (header or wrapper)",
		details:
			listNoCount.length > 0
				? `No total count: ${listNoCount.join(", ")}`
				: null,
	});

	// R79: GET responses for single resources define ETag or Last-Modified header
	const getNoEtag: string[] = [];
	for (const op of ops) {
		if (op.method !== "GET") continue;
		const pathHasParam = op.path.endsWith("}");
		if (!pathHasParam) continue;
		const resp200 = op.operation.responses?.["200"];
		if (!resp200) continue;

		let headers = resp200.headers || {};
		if (resp200.$ref) {
			const refResp = resolveRef(spec, resp200.$ref);
			if (refResp) headers = (refResp as OpenAPIResponse).headers || {};
		}
		const hasEtag = Object.keys(headers).some(
			(h) => h.toLowerCase() === "etag" || h.toLowerCase() === "last-modified",
		);
		if (!hasEtag) {
			getNoEtag.push(`${op.method} ${op.path}`);
		}
	}
	results.push({
		id: "R79",
		category: "Response",
		severity: "suggestion",
		passed: getNoEtag.length === 0,
		message: "Single-resource GET responses define ETag or Last-Modified",
		details:
			getNoEtag.length > 0
				? `Missing cache headers: ${getNoEtag.join(", ")}`
				: null,
	});

	// R80: 406 Not Acceptable suggested for multiple content types
	const missing406: string[] = [];
	for (const op of ops) {
		const responses = op.operation.responses || {};
		for (const resp of Object.values(responses)) {
			const content = resp.content || {};
			if (Object.keys(content).length > 1 && !responses["406"]) {
				missing406.push(`${op.method} ${op.path}`);
				break;
			}
		}
	}
	results.push({
		id: "R80",
		category: "Response",
		severity: "suggestion",
		passed: missing406.length === 0,
		message:
			"Operations supporting multiple response content types should define 406 Not Acceptable",
		details:
			missing406.length > 0 ? `Missing 406 on: ${missing406.join(", ")}` : null,
	});

	// R81: 415 Unsupported Media Type suggested for operations with requestBody
	const missing415: string[] = [];
	for (const op of ops) {
		if (op.operation.requestBody && !op.operation.responses?.["415"]) {
			missing415.push(`${op.method} ${op.path}`);
		}
	}
	results.push({
		id: "R81",
		category: "Response",
		severity: "suggestion",
		passed: missing415.length === 0,
		message:
			"Operations with request bodies should define 415 Unsupported Media Type",
		details:
			missing415.length > 0 ? `Missing 415 on: ${missing415.join(", ")}` : null,
	});

	return results;
}
