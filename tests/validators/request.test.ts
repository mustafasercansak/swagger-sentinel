import { describe, expect, it } from "vitest";
import type { OpenAPISpec, ValidationResult } from "../../src/types.js";
import { validateRequests } from "../../src/validators/request.js";

function check(results: ValidationResult[], id: string) {
	return results.find((r) => r.id === id);
}

function spec(
	paths: OpenAPISpec["paths"],
	components: OpenAPISpec["components"] = {},
): OpenAPISpec {
	return {
		openapi: "3.0.3",
		info: { title: "T", version: "1.0.0" },
		paths,
		components,
	} as unknown as OpenAPISpec;
}

describe("validateRequests", () => {
	// R50 string maxLength
	it("R50 passes when query string param has maxLength", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [
						{
							name: "q",
							in: "query",
							schema: { type: "string", maxLength: 100 },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R50")?.passed).toBe(true);
	});

	it("R50 fails when query string param has no maxLength", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R50")?.passed).toBe(false);
	});

	// R51 numeric min/max
	it("R51 fails when numeric query param has no range", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [
						{ name: "limit", in: "query", schema: { type: "integer" } },
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R51")?.passed).toBe(false);
	});

	it("R51 passes when numeric param has minimum", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [
						{
							name: "limit",
							in: "query",
							schema: { type: "integer", minimum: 1, maximum: 100 },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R51")?.passed).toBe(true);
	});

	// R53 request body required fields
	it("R53 fails when request body object schema has no required", () => {
		const s = spec({
			"/items": {
				post: {
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { name: { type: "string" } },
								},
							},
						},
					},
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R53")?.passed).toBe(false);
	});

	it("R53 passes when required fields defined", () => {
		const s = spec({
			"/items": {
				post: {
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { name: { type: "string" } },
									required: ["name"],
								},
							},
						},
					},
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R53")?.passed).toBe(true);
	});

	// R54 content-type required
	it("R54 fails when requestBody has no content", () => {
		const s = spec({
			"/items": {
				post: {
					requestBody: { content: {} },
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R54")?.passed).toBe(false);
		expect(check(validateRequests(s), "R54")?.severity).toBe("error");
	});

	// R55 enum casing
	it("R55 passes when enum values are consistently cased", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [
						{
							name: "status",
							in: "query",
							schema: { type: "string", enum: ["active", "inactive"] },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R55")?.passed).toBe(true);
	});

	it("R55 fails when enum mixes upper and lower case", () => {
		const s = spec({
			"/items": {
				get: {
					parameters: [
						{
							name: "status",
							in: "query",
							schema: { type: "string", enum: ["ACTIVE", "inactive"] },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R55")?.passed).toBe(false);
	});

	// R57 format hints
	it("R57 passes when email field has format: email", () => {
		const s = spec(
			{},
			{
				schemas: {
					User: { properties: { email: { type: "string", format: "email" } } },
				},
			},
		);
		expect(check(validateRequests(s), "R57")?.passed).toBe(true);
	});

	it("R57 fails when email field has no format", () => {
		const s = spec(
			{},
			{
				schemas: { User: { properties: { email: { type: "string" } } } },
			},
		);
		expect(check(validateRequests(s), "R57")?.passed).toBe(false);
		expect(check(validateRequests(s), "R57")?.severity).toBe("suggestion");
	});

	// R58 binary in multipart
	it("R58 passes when binary field is in multipart/form-data", () => {
		const s = spec({
			"/upload": {
				post: {
					requestBody: {
						content: {
							"multipart/form-data": {
								schema: {
									type: "object",
									properties: { file: { type: "string", format: "binary" } },
								},
							},
						},
					},
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R58")?.passed).toBe(true);
	});

	it("R58 fails when binary field is in application/json", () => {
		const s = spec({
			"/upload": {
				post: {
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: { file: { type: "string", format: "binary" } },
								},
							},
						},
					},
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R58")?.passed).toBe(false);
	});

	// R59 ID parameters define format or pattern
	it("R59 passes when ID parameter has format: uuid", () => {
		const s = spec({
			"/users/{id}": {
				get: {
					parameters: [
						{
							name: "id",
							in: "path",
							required: true,
							schema: { type: "string", format: "uuid" },
						},
					],
					responses: {},
				},
			},
		});
		expect(check(validateRequests(s), "R59")?.passed).toBe(true);
	});

	it("R59 fails when ID parameter has no format", () => {
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
		expect(check(validateRequests(s), "R59")?.passed).toBe(false);
	});

	// R60 Large body objects define maxProperties
	it("R60 passes when large object has maxProperties", () => {
		const s = spec(
			{},
			{
				schemas: {
					Large: {
						type: "object",
						maxProperties: 50,
						properties: Object.fromEntries(
							Array.from({ length: 25 }, (_, i) => [
								`p${i}`,
								{ type: "string" },
							]),
						),
					},
				},
			},
		);
		expect(check(validateRequests(s), "R60")?.passed).toBe(true);
	});

	it("R60 fails when large object (20+ props) missing maxProperties", () => {
		const s = spec(
			{},
			{
				schemas: {
					Large: {
						type: "object",
						properties: Object.fromEntries(
							Array.from({ length: 25 }, (_, i) => [
								`p${i}`,
								{ type: "string" },
							]),
						),
					},
				},
			},
		);
		expect(check(validateRequests(s), "R60")?.passed).toBe(false);
	});

	// R61 No examples for sensitive fields
	it("R61 passes when sensitive field has no example", () => {
		const s = spec(
			{},
			{
				schemas: { User: { properties: { password: { type: "string" } } } },
			},
		);
		expect(check(validateRequests(s), "R61")?.passed).toBe(true);
	});

	it('R61 fails when "secret" field has an example', () => {
		const s = spec(
			{},
			{
				schemas: {
					Config: {
						properties: { apiSecret: { type: "string", example: "12345" } },
					},
				},
			},
		);
		expect(check(validateRequests(s), "R61")?.passed).toBe(false);
	});
});
