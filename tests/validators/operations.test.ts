import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../../src/types.js";
import { validateOperations } from "../../src/validators/operations.js";

function check(results: ValidationResult[], id: string) {
	return results.find((r) => r.id === id);
}

function spec(paths: any, extra: any = {}) {
	return Object.assign(
		{ openapi: "3.0.3", info: { title: "T", version: "1.0.0" }, paths },
		extra,
	);
}

describe("validateOperations", () => {
	// O31 operationId required
	it("O31 passes when operationId present", () => {
		const s = spec({
			"/items": { get: { operationId: "listItems", responses: {} } },
		});
		expect(check(validateOperations(s), "O31")?.passed).toBe(true);
	});

	it("O31 fails when operationId missing", () => {
		const s = spec({ "/items": { get: { responses: {} } } });
		expect(check(validateOperations(s), "O31")?.passed).toBe(false);
	});

	// O31b duplicate operationIds
	it("O31b passes for unique operationIds", () => {
		const s = spec({
			"/items": { get: { operationId: "listItems", responses: {} } },
			"/items/{id}": { get: { operationId: "getItem", responses: {} } },
		});
		expect(check(validateOperations(s), "O31b")?.passed).toBe(true);
	});

	it("O31b fails for duplicate operationIds", () => {
		const s = spec({
			"/items": { get: { operationId: "getItems", responses: {} } },
			"/items/{id}": { get: { operationId: "getItems", responses: {} } },
		});
		expect(check(validateOperations(s), "O31b")?.passed).toBe(false);
	});

	// O32 POST should not return 200
	it("O32 passes when POST returns 201", () => {
		const s = spec({
			"/items": {
				post: {
					operationId: "createItem",
					responses: { "201": { description: "created" } },
				},
			},
		});
		expect(check(validateOperations(s), "O32")?.passed).toBe(true);
	});

	it("O32 fails when POST returns only 200", () => {
		const s = spec({
			"/items": {
				post: {
					operationId: "createItem",
					responses: { "200": { description: "ok" } },
				},
			},
		});
		expect(check(validateOperations(s), "O32")?.passed).toBe(false);
	});

	// O33 DELETE should return 204
	it("O33 passes when DELETE returns 204", () => {
		const s = spec({
			"/items/{id}": {
				delete: {
					operationId: "removeItem",
					responses: { "204": { description: "no content" } },
				},
			},
		});
		expect(check(validateOperations(s), "O33")?.passed).toBe(true);
	});

	it("O33 fails when DELETE returns 200", () => {
		const s = spec({
			"/items/{id}": {
				delete: {
					operationId: "removeItem",
					responses: { "200": { description: "ok" } },
				},
			},
		});
		expect(check(validateOperations(s), "O33")?.passed).toBe(false);
	});

	// O34 all operations tagged
	it("O34 passes when operation has tag", () => {
		const s = spec({
			"/items": {
				get: { operationId: "listItems", tags: ["Items"], responses: {} },
			},
		});
		expect(check(validateOperations(s), "O34")?.passed).toBe(true);
	});

	it("O34 fails when operation has no tags", () => {
		const s = spec({
			"/items": { get: { operationId: "listItems", responses: {} } },
		});
		expect(check(validateOperations(s), "O34")?.passed).toBe(false);
	});

	// O36 operations have summary
	it("O36 passes when summary present", () => {
		const s = spec({
			"/items": { get: { summary: "List items", responses: {} } },
		});
		expect(check(validateOperations(s), "O36")?.passed).toBe(true);
	});

	it("O36 fails when no summary or description", () => {
		const s = spec({ "/items": { get: { responses: {} } } });
		expect(check(validateOperations(s), "O36")?.passed).toBe(false);
	});

	// O37 PUT/PATCH have request body
	it("O37 passes when PUT has requestBody", () => {
		const s = spec({
			"/items/{id}": {
				put: {
					requestBody: {
						content: { "application/json": { schema: { type: "object" } } },
					},
					responses: { "200": { description: "ok" } },
				},
			},
		});
		expect(check(validateOperations(s), "O37")?.passed).toBe(true);
	});

	it("O37 fails when PATCH has no requestBody", () => {
		const s = spec({
			"/items/{id}": { patch: { responses: { "200": { description: "ok" } } } },
		});
		expect(check(validateOperations(s), "O37")?.passed).toBe(false);
	});

	// O39 HEAD where GET exists
	it("O39 passes when HEAD defined alongside GET", () => {
		const s = spec({
			"/items": { get: { responses: {} }, head: { responses: {} } },
		});
		expect(check(validateOperations(s), "O39")?.passed).toBe(true);
	});

	it("O39 fails when GET has no HEAD", () => {
		const s = spec({ "/items": { get: { responses: {} } } });
		expect(check(validateOperations(s), "O39")?.passed).toBe(false);
		expect(check(validateOperations(s), "O39")?.severity).toBe("suggestion");
	});

	// O41 operationId redundant verb prefix
	it("O41 passes when operationId does not start with http method", () => {
		const s = spec({
			"/items/{id}": { delete: { operationId: "removeItem", responses: {} } },
		});
		expect(check(validateOperations(s), "O41")?.passed).toBe(true);
	});

	it('O41 flags when DELETE operationId starts with "delete"', () => {
		const s = spec({
			"/items/{id}": { delete: { operationId: "deleteItem", responses: {} } },
		});
		expect(check(validateOperations(s), "O41")?.passed).toBe(false);
	});

	// O42 GET operations do not have a requestBody
	it("O42 passes when GET has no requestBody", () => {
		const s = spec({
			"/items": { get: { responses: { "200": { description: "ok" } } } },
		});
		expect(check(validateOperations(s), "O42")?.passed).toBe(true);
	});

	it("O42 fails when GET has requestBody", () => {
		const s = spec({
			"/items": {
				get: {
					requestBody: { content: { "application/json": {} } },
					responses: { "200": { description: "ok" } },
				},
			},
		});
		expect(check(validateOperations(s), "O42")?.passed).toBe(false);
	});

	// O43 429 Too Many Requests responses include rate-limit or retry headers
	it("O43 passes when 429 has Retry-After", () => {
		const s = spec({
			"/items": {
				get: {
					responses: {
						"429": {
							description: "too many",
							headers: { "Retry-After": { schema: { type: "integer" } } },
						},
					},
				},
			},
		});
		expect(check(validateOperations(s), "O43")?.passed).toBe(true);
	});

	it("O43 fails when 429 missing rate-limit headers", () => {
		const s = spec({
			"/items": { get: { responses: { "429": { description: "too many" } } } },
		});
		expect(check(validateOperations(s), "O43")?.passed).toBe(false);
	});

	// O44 202 Accepted responses include a Location or Link header
	it("O44 passes when 202 has Location", () => {
		const s = spec({
			"/jobs": {
				post: {
					responses: {
						"202": {
							description: "queued",
							headers: { Location: { schema: { type: "string" } } },
						},
					},
				},
			},
		});
		expect(check(validateOperations(s), "O44")?.passed).toBe(true);
	});

	it("O44 fails when 202 missing Location/Link", () => {
		const s = spec({
			"/jobs": { post: { responses: { "202": { description: "queued" } } } },
		});
		expect(check(validateOperations(s), "O44")?.passed).toBe(false);
	});
});
