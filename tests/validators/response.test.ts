import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../../src/types.js";
import { validateResponses } from "../../src/validators/response.js";

function check(results: ValidationResult[], id: string) {
	return results.find((r) => r.id === id);
}

function spec(paths: any, components: any = {}) {
	return {
		openapi: "3.0.3",
		info: { title: "T", version: "1.0.0" },
		paths,
		components,
	};
}

describe("validateResponses", () => {
	// R70 consistent error schema
	it("R70 passes when one error schema ref used", () => {
		const s = spec({
			"/a": {
				get: {
					responses: {
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
						},
					},
				},
			},
			"/b": {
				get: {
					responses: {
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R70")?.passed).toBe(true);
	});

	it("R70 fails when 3+ different error schemas used", () => {
		const s = spec({
			"/a": {
				get: {
					responses: {
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Err1" },
								},
							},
						},
					},
				},
			},
			"/b": {
				get: {
					responses: {
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Err2" },
								},
							},
						},
					},
				},
			},
			"/c": {
				get: {
					responses: {
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Err3" },
								},
							},
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R70")?.passed).toBe(false);
	});

	// R73 all operations have responses
	it("R73 fails when operation has no responses", () => {
		const s = spec({ "/items": { get: { responses: {} } } });
		expect(check(validateResponses(s as any), "R73")?.passed).toBe(false);
		expect(check(validateResponses(s as any), "R73")?.severity).toBe("error");
	});

	it("R73 passes when operation has at least one response", () => {
		const s = spec({
			"/items": { get: { responses: { "200": { description: "ok" } } } },
		});
		expect(check(validateResponses(s as any), "R73")?.passed).toBe(true);
	});

	// R74 success responses have content
	it("R74 fails when 200 response has no content", () => {
		const s = spec({
			"/items": { get: { responses: { "200": { description: "ok" } } } },
		});
		expect(check(validateResponses(s as any), "R74")?.passed).toBe(false);
	});

	it("R74 passes for 204 with no content", () => {
		const s = spec({
			"/items/{id}": {
				delete: { responses: { "204": { description: "deleted" } } },
			},
		});
		expect(check(validateResponses(s as any), "R74")?.passed).toBe(true);
	});

	it("R74 passes when 200 has content", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"200": {
							description: "ok",
							content: {
								"application/json": {
									schema: { type: "array", items: { type: "object" } },
								},
							},
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R74")?.passed).toBe(true);
	});

	// R75 429 has rate-limit headers
	it("R75 passes when 429 has X-RateLimit-Limit header", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"429": {
							description: "too many",
							headers: { "X-RateLimit-Limit": { schema: { type: "integer" } } },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R75")?.passed).toBe(true);
	});

	it("R75 fails when 429 has no rate-limit headers", () => {
		const s = spec({
			"/items": { get: { responses: { "429": { description: "too many" } } } },
		});
		expect(check(validateResponses(s as any), "R75")?.passed).toBe(false);
	});

	// R77 201 includes Location header
	it("R77 passes when 201 has Location header", () => {
		const s = spec({
			"/items": {
				post: {
					responses: {
						"201": {
							description: "created",
							headers: { Location: { schema: { type: "string" } } },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R77")?.passed).toBe(true);
	});

	it("R77 fails when 201 has no Location header", () => {
		const s = spec({
			"/items": { post: { responses: { "201": { description: "created" } } } },
		});
		expect(check(validateResponses(s as any), "R77")?.passed).toBe(false);
		expect(check(validateResponses(s as any), "R77")?.severity).toBe(
			"suggestion",
		);
	});

	// R78 list responses have total count
	it("R78 passes when array response has x-total-count header", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"200": {
							description: "ok",
							content: {
								"application/json": { schema: { type: "array", items: {} } },
							},
							headers: { "X-Total-Count": { schema: { type: "integer" } } },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R78")?.passed).toBe(true);
	});

	it("R78 fails when array response has no total count", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"200": {
							description: "ok",
							content: {
								"application/json": { schema: { type: "array", items: {} } },
							},
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R78")?.passed).toBe(false);
	});

	// R79 single-resource GET has ETag
	it("R79 passes when single resource GET has ETag header", () => {
		const s = spec({
			"/items/{id}": {
				get: {
					responses: {
						"200": {
							description: "ok",
							content: { "application/json": { schema: { type: "object" } } },
							headers: { ETag: { schema: { type: "string" } } },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R79")?.passed).toBe(true);
	});

	it("R79 fails when single resource GET has no ETag", () => {
		const s = spec({
			"/items/{id}": {
				get: {
					responses: {
						"200": {
							description: "ok",
							content: { "application/json": { schema: { type: "object" } } },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R79")?.passed).toBe(false);
	});

	// R80 406 Not Acceptable defined for multiple content types
	it("R80 passes when multiple content types and 406 defined", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"200": {
							content: { "application/json": {}, "application/xml": {} },
						},
						"406": { description: "not acceptable" },
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R80")?.passed).toBe(true);
	});

	it("R80 fails when multiple content types and no 406", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"200": {
							content: { "application/json": {}, "application/xml": {} },
						},
					},
				},
			},
		});
		expect(check(validateResponses(s as any), "R80")?.passed).toBe(false);
	});

	// R81 415 Unsupported Media Type for requestBody
	it("R81 passes when requestBody and 415 defined", () => {
		const s = spec({
			"/items": {
				post: {
					requestBody: { content: { "application/json": {} } },
					responses: { "415": { description: "unsupported" } },
				},
			},
		});
		expect(check(validateResponses(s as any), "R81")?.passed).toBe(true);
	});

	it("R81 fails when requestBody and no 415", () => {
		const s = spec({
			"/items": {
				post: {
					requestBody: { content: { "application/json": {} } },
					responses: { "201": { description: "created" } },
				},
			},
		});
		expect(check(validateResponses(s as any), "R81")?.passed).toBe(false);
	});
});
