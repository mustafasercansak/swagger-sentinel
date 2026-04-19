import { describe, expect, it, vi } from "vitest";
import { validate } from "../../src/validators/index.js";

describe("validators/index.ts", () => {
	const spec = {
		openapi: "3.0.0",
		info: { title: "Test", version: "1.0.0" },
		paths: {
			"/test": {
				get: { responses: { "200": { description: "OK" } } },
			},
		},
	} as any;

	it("should run all validators", async () => {
		const results = await validate(spec);
		expect(results.length).toBeGreaterThan(0);
		// Check if it includes results from multiple categories (e.g., Structure and Paths)
		const categories = new Set(results.map((r) => r.category));
		expect(categories.has("Structure")).toBe(true);
		expect(categories.has("Paths")).toBe(true);
	});

	it("should filter by category", async () => {
		const results = await validate(spec, { category: "Paths" });
		const categories = new Set(results.map((r) => r.category));
		expect(categories.has("Paths")).toBe(true);
		expect(categories.has("Structure")).toBe(false);
	});

	it("should apply ignores", async () => {
		const initialResults = await validate(spec);
		const ruleToIgnore = initialResults[0].id;

		const filteredResults = await validate(spec, {
			config: { ignore: [ruleToIgnore] },
		});
		expect(filteredResults.some((r) => r.id === ruleToIgnore)).toBe(false);
	});
});
