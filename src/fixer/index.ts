import type { OpenAPISpec, OpenAPIOperation } from "../types.js";

/**
 * Apply safe auto-fixes to an OpenAPI spec.
 * Returns the number of fixes applied.
 */
export function applyFixes(spec: OpenAPISpec): number {
	let fixCount = 0;

	if (!spec.paths) return 0;

	for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
		const methods = [
			"get",
			"post",
			"put",
			"delete",
			"patch",
			"head",
			"options",
		] as const;

		for (const method of methods) {
			const op = pathItem[method] as OpenAPIOperation | undefined;
			if (!op) continue;

			// 1. Missing operationId
			if (!op.operationId) {
				op.operationId = generateOperationId(pathStr, method);
				fixCount++;
			}

			// 2. Missing/Empty description
			if (!op.description || op.description.trim() === "") {
				op.description = `${method.toUpperCase()} ${pathStr} operation`;
				fixCount++;
			}

			// 3. Missing 400/500 responses
			if (!op.responses["400"]) {
				op.responses["400"] = {
					description: "Bad Request",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									message: { type: "string" },
									code: { type: "string" },
								},
							},
						},
					},
				};
				fixCount++;
			}

			if (!op.responses["500"]) {
				op.responses["500"] = {
					description: "Internal Server Error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									message: { type: "string" },
								},
							},
						},
					},
				};
				fixCount++;
			}
		}
	}

	return fixCount;
}

/**
 * Generate a camelCase operationId from path and method.
 * e.g., GET /users -> getUsers
 *       POST /users/{id}/orders -> postUsersIdOrders
 */
function generateOperationId(path: string, method: string): string {
	const cleanPath = path
		.replace(/\{/g, "")
		.replace(/\}/g, "")
		.split("/")
		.filter((p) => p !== "")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join("");

	return method.toLowerCase() + cleanPath;
}
