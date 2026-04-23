import { describe, expect, it } from "vitest";
import { generate } from "../../src/generators/index.js";
import type { OpenAPISpec } from "../../src/types.js";

describe("Test Generator Engine", () => {
	const mockSpec: OpenAPISpec = {
		openapi: "3.0.0",
		info: {
			title: "Pet Store",
			version: "1.0.0",
			description: "A test spec",
		},
		paths: {
			"/pets": {
				get: {
					summary: "List pets",
					operationId: "pets_list",
					tags: ["Pets"],
					responses: {
						"200": {
							description: "Success",
							content: {
								"application/json": {
									schema: {
										type: "array",
										items: {
											type: "object",
											properties: {
												id: { type: "string", format: "uuid" },
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	};

	it("should generate a test file for each tag", () => {
		const options = {
			output: "./tests/gen",
			baseUrl: "http://api.test",
			seed: "42",
		};
		const result = generate(mockSpec, options);

		// It should have api-helper.ts, schemas.ts, and pets.test.ts
		expect(result).toHaveLength(3);
		const petTestFile = result.find((f) => f.name === "pets.test.ts");
		expect(petTestFile).toBeDefined();
		expect(petTestFile?.content).toContain(
			"import { describe, it, expect, beforeEach } from 'vitest'",
		);
		expect(petTestFile?.content).toContain("describe('GET /pets', () => {");
	});

	it("should include setSeed in operations for data consistency", () => {
		const result = generate(mockSpec, {
			output: "./tests/gen",
			baseUrl: "http://api.test",
			seed: "123",
		});
		const petTestFile = result.find((f) => f.name === "pets.test.ts");
		expect(petTestFile?.content).toContain("setSeed('GET-/pets')");
	});

	it("should return at least helper and schemas even if no tag matches", () => {
		const filtered = generate(mockSpec, {
			output: "./tests/gen",
			tag: "Other",
		});
		expect(filtered).toHaveLength(2); // helper + schemas
		expect(filtered.find((f) => f.name === "api-helper.ts")).toBeDefined();
		expect(filtered.find((f) => f.name === "schemas.ts")).toBeDefined();
		expect(filtered.find((f) => f.name.includes(".test.ts"))).toBeUndefined();
	});
});
