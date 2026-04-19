import type {
	OpenAPIOperation,
	OpenAPIPathItem,
	OpenAPISpec,
} from "../types.js";

export type DiffType = "breaking" | "non-breaking" | "informative";

export interface DiffChange {
	id: string;
	path: string; // e.g., "GET /users"
	message: string;
	type: DiffType;
}

/**
 * Compare two OpenAPI specs and return a list of changes,
 * specifically highlighting breaking changes.
 */
export function compareSpecs(
	oldSpec: OpenAPISpec,
	newSpec: OpenAPISpec,
): DiffChange[] {
	const changes: DiffChange[] = [];

	const oldPaths = oldSpec.paths || {};
	const newPaths = newSpec.paths || {};

	// 1. Check for removed/added paths
	for (const path of Object.keys(oldPaths)) {
		if (!newPaths[path]) {
			changes.push({
				id: "PATH_REMOVED",
				path,
				message: `Path ${path} was removed`,
				type: "breaking",
			});
		} else {
			// Compare Path Items (methods)
			comparePathItems(path, oldPaths[path], newPaths[path], changes);
		}
	}

	for (const path of Object.keys(newPaths)) {
		if (!oldPaths[path]) {
			changes.push({
				id: "PATH_ADDED",
				path,
				message: `New path ${path} was added`,
				type: "non-breaking",
			});
		}
	}

	return changes;
}

function comparePathItems(
	path: string,
	oldItem: OpenAPIPathItem,
	newItem: OpenAPIPathItem,
	changes: DiffChange[],
) {
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
		const oldOp = oldItem[method];
		const newOp = newItem[method];

		if (oldOp && !newOp) {
			changes.push({
				id: "METHOD_REMOVED",
				path: `${method.toUpperCase()} ${path}`,
				message: `Method ${method.toUpperCase()} was removed from ${path}`,
				type: "breaking",
			});
		} else if (!oldOp && newOp) {
			changes.push({
				id: "METHOD_ADDED",
				path: `${method.toUpperCase()} ${path}`,
				message: `New method ${method.toUpperCase()} was added to ${path}`,
				type: "non-breaking",
			});
		} else if (oldOp && newOp) {
			compareOperations(path, method, oldOp, newOp, changes);
		}
	}
}

function compareOperations(
	path: string,
	method: string,
	oldOp: OpenAPIOperation,
	newOp: OpenAPIOperation,
	changes: DiffChange[],
) {
	const opPath = `${method.toUpperCase()} ${path}`;

	// 1. Parameters
	const oldParams = oldOp.parameters || [];
	const newParams = newOp.parameters || [];

	for (const oldP of oldParams) {
		const newP = newParams.find(
			(p) => p.name === oldP.name && p.in === oldP.in,
		);
		if (!newP) {
			changes.push({
				id: "PARAMETER_REMOVED",
				path: opPath,
				message: `Parameter "${oldP.name}" (${oldP.in}) was removed`,
				type: "breaking",
			});
		} else {
			if (!oldP.required && newP.required) {
				changes.push({
					id: "PARAMETER_REQUIRED_CHANGED",
					path: opPath,
					message: `Parameter "${oldP.name}" is now required`,
					type: "breaking",
				});
			}
			// Simple type check (very basic)
			if (
				JSON.stringify(oldP.schema || {}) !== JSON.stringify(newP.schema || {})
			) {
				changes.push({
					id: "PARAMETER_TYPE_CHANGED",
					path: opPath,
					message: `Parameter "${oldP.name}" schema changed`,
					type: "breaking",
				});
			}
		}
	}

	for (const newP of newParams) {
		const oldP = oldParams.find(
			(p) => p.name === newP.name && p.in === newP.in,
		);
		if (!oldP && newP.required) {
			changes.push({
				id: "PARAMETER_ADDED_REQUIRED",
				path: opPath,
				message: `New required parameter "${newP.name}" was added`,
				type: "breaking",
			});
		}
	}

	// 2. Request Body
	if (oldOp.requestBody && !newOp.requestBody) {
		changes.push({
			id: "REQUEST_BODY_REMOVED",
			path: opPath,
			message: "Request body was removed",
			type: "breaking",
		});
	} else if (
		!oldOp.requestBody &&
		newOp.requestBody &&
		newOp.requestBody.required
	) {
		changes.push({
			id: "REQUEST_BODY_ADDED_REQUIRED",
			path: opPath,
			message: "A required request body was added",
			type: "breaking",
		});
	} else if (oldOp.requestBody && newOp.requestBody) {
		if (
			JSON.stringify(oldOp.requestBody.content) !==
			JSON.stringify(newOp.requestBody.content)
		) {
			changes.push({
				id: "REQUEST_BODY_TYPE_CHANGED",
				path: opPath,
				message: "Request body content type or schema changed",
				type: "breaking",
			});
		}
	}

	// 3. Responses (Focus on Success 2xx)
	const oldResponses = oldOp.responses || {};
	const newResponses = newOp.responses || {};

	for (const code of Object.keys(oldResponses)) {
		if (code.startsWith("2")) {
			if (!newResponses[code]) {
				changes.push({
					id: "RESPONSE_REMOVED",
					path: opPath,
					message: `Success response ${code} was removed`,
					type: "breaking",
				});
			} else {
				// Compare schemas
				if (
					JSON.stringify(oldResponses[code].content || {}) !==
					JSON.stringify(newResponses[code].content || {})
				) {
					changes.push({
						id: "RESPONSE_TYPE_CHANGED",
						path: opPath,
						message: `Schema for response ${code} changed`,
						type: "breaking",
					});
				}
			}
		}
	}

	// 4. Operation ID
	if (oldOp.operationId !== newOp.operationId) {
		changes.push({
			id: "OPERATION_ID_CHANGED",
			path: opPath,
			message: `operationId changed from "${oldOp.operationId}" to "${newOp.operationId}"`,
			type: "informative",
		});
	}
}
