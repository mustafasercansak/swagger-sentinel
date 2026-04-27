import { describe, expect, it } from "vitest";
import { applyFixes } from "../../src/fixer/index.js";
import type { OpenAPIPathItem, OpenAPISpec } from "../../src/types.js";

function spec(paths: Record<string, OpenAPIPathItem>): OpenAPISpec {
	return {
		openapi: "3.0.3",
		info: { title: "Test", version: "1.0.0" },
		paths,
	};
}

describe("fixer", () => {
	it("adds missing operationId", () => {
		const s = spec({ "/pets": { get: { responses: {} } } });
		const count = applyFixes(s);
		expect(count).toBeGreaterThan(0);
		expect(s.paths["/pets"].get?.operationId).toBeDefined();
		expect(s.paths["/pets"].get?.operationId).toBe("getPets");
	});

	it("adds missing description", () => {
		const s = spec({ "/pets": { get: { responses: {} } } });
		applyFixes(s);
		expect(s.paths["/pets"].get?.description).toBe("GET /pets operation");
	});

	it("adds missing 400 and 500 responses", () => {
		const s = spec({
			"/pets": { get: { responses: { "200": { description: "ok" } } } },
		});
		applyFixes(s);
		expect(s.paths["/pets"].get?.responses["400"]).toBeDefined();
		expect(s.paths["/pets"].get?.responses["500"]).toBeDefined();
	});

	it("does not overwrite existing fields", () => {
		const s = spec({
			"/pets": {
				get: {
					operationId: "keepMe",
					description: "already here",
					responses: { "400": { description: "custom" } },
				},
			},
		});
		applyFixes(s);
		expect(s.paths["/pets"].get?.operationId).toBe("keepMe");
		expect(s.paths["/pets"].get?.description).toBe("already here");
		expect(s.paths["/pets"].get?.responses["400"].description).toBe("custom");
	});

	it("handles path parameters in operationId generation", () => {
		const s = spec({
			"/users/{id}/orders/{orderId}": { get: { responses: {} } },
		});
		applyFixes(s);
		expect(s.paths["/users/{id}/orders/{orderId}"].get?.operationId).toBe(
			"getUsersIdOrdersOrderId",
		);
	});
});
