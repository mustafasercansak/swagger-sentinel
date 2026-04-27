import { describe, expect, it } from "vitest";
import type { OpenAPISpec, ValidationResult } from "../../src/types.js";
import { validatePaths } from "../../src/validators/paths.js";

function check(results: ValidationResult[], id: string) {
	return results.find((r) => r.id === id);
}

function spec(
	paths: OpenAPISpec["paths"],
	extra: Partial<OpenAPISpec> = {},
): OpenAPISpec {
	return Object.assign(
		{ openapi: "3.0.3", info: { title: "T", version: "1.0.0" }, paths },
		extra,
	) as unknown as OpenAPISpec;
}

describe("validatePaths", () => {
	// P15 kebab-case
	it("P15 passes for kebab-case paths", () => {
		const r = check(validatePaths(spec({ "/api/v1/user-items": {} })), "P15");
		expect(r?.passed).toBe(true);
	});

	it("P15 fails for camelCase path segment", () => {
		const r = check(validatePaths(spec({ "/api/v1/userItems": {} })), "P15");
		expect(r?.passed).toBe(false);
	});

	it("P15 fails for snake_case path segment", () => {
		const r = check(validatePaths(spec({ "/api/v1/user_items": {} })), "P15");
		expect(r?.passed).toBe(false);
	});

	// P16 trailing slashes
	it("P16 passes when no trailing slash", () => {
		const r = check(validatePaths(spec({ "/items": {} })), "P16");
		expect(r?.passed).toBe(true);
	});

	it("P16 fails when trailing slash present", () => {
		const r = check(validatePaths(spec({ "/items/": {} })), "P16");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("error");
	});

	// P17 plural naming
	it("P17 passes for plural resource", () => {
		const r = check(validatePaths(spec({ "/items/{itemId}": {} })), "P17");
		expect(r?.passed).toBe(true);
	});

	it("P17 flags singular resource before path param", () => {
		const r = check(validatePaths(spec({ "/item/{itemId}": {} })), "P17");
		expect(r?.passed).toBe(false);
	});

	// P18 nesting depth
	it("P18 passes for shallow nesting", () => {
		const r = check(validatePaths(spec({ "/a/{id}/b/{bid}": {} })), "P18");
		expect(r?.passed).toBe(true);
	});

	it("P18 fails for deep nesting (4 path params)", () => {
		const r = check(
			validatePaths(spec({ "/a/{aId}/b/{bId}/c/{cId}/d/{dId}": {} })),
			"P18",
		);
		expect(r?.passed).toBe(false);
	});

	// P22 empty segments
	it("P22 fails for double slash", () => {
		const r = check(validatePaths(spec({ "/items//sub": {} })), "P22");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("error");
	});

	// P23 path params documented
	it("P23 passes when path param is documented", () => {
		const s = spec({
			"/items/{id}": {
				get: {
					parameters: [
						{
							name: "id",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validatePaths(s), "P23")?.passed).toBe(true);
	});

	it("P23 fails when path param is not documented", () => {
		const s = spec({
			"/items/{id}": { get: { parameters: [], responses: {} } },
		});
		expect(check(validatePaths(s), "P23")?.passed).toBe(false);
	});

	// P24 no verb in path
	it("P24 passes when no verb in path segments", () => {
		const r = check(validatePaths(spec({ "/api/v1/items": {} })), "P24");
		expect(r?.passed).toBe(true);
	});

	it("P24 fails when verb segment present", () => {
		const r = check(validatePaths(spec({ "/api/v1/create": {} })), "P24");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("warning");
	});

	it('P24 fails for "list" segment', () => {
		const r = check(validatePaths(spec({ "/api/v1/list": {} })), "P24");
		expect(r?.passed).toBe(false);
	});

	// P25 consistent param casing
	it("P25 passes when all params are camelCase", () => {
		const s = spec({
			"/items/{itemId}": {
				get: {
					parameters: [
						{
							name: "itemId",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validatePaths(s), "P25")?.passed).toBe(true);
	});

	it("P25 fails when camelCase and snake_case mixed", () => {
		const s = spec({
			"/a/{itemId}": {
				get: {
					parameters: [
						{
							name: "itemId",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
			"/b/{item_id}": {
				get: {
					parameters: [
						{
							name: "item_id",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validatePaths(s), "P25")?.passed).toBe(false);
	});

	// P26 sensitive keywords in path params
	it("P26 passes for normal path params", () => {
		const s = spec({
			"/users/{userId}": {
				get: {
					parameters: [
						{
							name: "userId",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validatePaths(s), "P26")?.passed).toBe(true);
	});

	it('P26 fails for "token" path param', () => {
		const s = spec({
			"/users/{token}": {
				get: {
					parameters: [
						{
							name: "token",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validatePaths(s), "P26")?.passed).toBe(false);
	});

	// P27 trailing dots in path segments
	it("P27 passes for normal segments", () => {
		const r = check(validatePaths(spec({ "/api/v1/users": {} })), "P27");
		expect(r?.passed).toBe(true);
	});

	it("P27 fails when a segment ends with a dot", () => {
		const r = check(validatePaths(spec({ "/api/v1./users": {} })), "P27");
		expect(r?.passed).toBe(false);
	});
});
