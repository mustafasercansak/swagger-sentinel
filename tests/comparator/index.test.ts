import { describe, expect, it } from "vitest";
import { compareSpecs } from "../../src/comparator/index.js";
import type { OpenAPISpec } from "../../src/types.js";

function spec(paths: any): OpenAPISpec {
	return {
		openapi: "3.0.3",
		info: { title: "Test", version: "1.0.0" },
		paths,
	};
}

describe("comparator", () => {
	it("detects removed path", () => {
		const oldSpec = spec({ "/pets": { get: { responses: {} } } });
		const newSpec = spec({});
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({ id: "PATH_REMOVED", type: "breaking" }),
		);
	});

	it("detects removed method", () => {
		const oldSpec = spec({ "/pets": { get: {}, post: {} } });
		const newSpec = spec({ "/pets": { get: {} } });
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({
				id: "METHOD_REMOVED",
				path: "POST /pets",
				type: "breaking",
			}),
		);
	});

	it("detects added path as non-breaking", () => {
		const oldSpec = spec({});
		const newSpec = spec({ "/pets": { get: {} } });
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({ id: "PATH_ADDED", type: "non-breaking" }),
		);
	});

	it("detects removed parameter", () => {
		const oldSpec = spec({
			"/pets": {
				get: {
					parameters: [{ name: "id", in: "query", required: true }],
					responses: {},
				},
			},
		});
		const newSpec = spec({
			"/pets": {
				get: {
					parameters: [],
					responses: {},
				},
			},
		});
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({ id: "PARAMETER_REMOVED", type: "breaking" }),
		);
	});

	it("detects parameter becoming required", () => {
		const oldSpec = spec({
			"/pets": {
				get: {
					parameters: [{ name: "id", in: "query", required: false }],
					responses: {},
				},
			},
		});
		const newSpec = spec({
			"/pets": {
				get: {
					parameters: [{ name: "id", in: "query", required: true }],
					responses: {},
				},
			},
		});
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({
				id: "PARAMETER_REQUIRED_CHANGED",
				type: "breaking",
			}),
		);
	});

	it("detects removed response", () => {
		const oldSpec = spec({
			"/pets": {
				get: {
					responses: { "200": { description: "ok" }, "201": { description: "c" } },
				},
			},
		});
		const newSpec = spec({
			"/pets": {
				get: {
					responses: { "201": { description: "c" } },
				},
			},
		});
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({ id: "RESPONSE_REMOVED", type: "breaking" }),
		);
	});

	it("detects operationId change as informative", () => {
		const oldSpec = spec({
			"/pets": { get: { operationId: "old", responses: {} } },
		});
		const newSpec = spec({
			"/pets": { get: { operationId: "new", responses: {} } },
		});
		const changes = compareSpecs(oldSpec, newSpec);
		expect(changes).toContainEqual(
			expect.objectContaining({ id: "OPERATION_ID_CHANGED", type: "informative" }),
		);
	});
});
