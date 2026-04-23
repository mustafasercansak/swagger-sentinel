import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validate } from "../../src/validators/index.js";

vi.mock("../../src/validators/structure.js", () => ({
	validateStructure: vi.fn(),
}));

import type { OpenAPISpec } from "../../src/types.js";
import { validateStructure } from "../../src/validators/structure.js";

describe("validators/index.ts", () => {
	const spec = {
		openapi: "3.0.0",
		info: { title: "Test", version: "1.0.0" },
		paths: {
			"/test": {
				get: { responses: { "200": { description: "OK" } } },
			},
		},
	} as unknown as OpenAPISpec;

	beforeEach(() => {
		// Default: make validateStructure return empty so other tests aren't polluted
		vi.mocked(validateStructure).mockReturnValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should run all validators", async () => {
		const results = await validate(spec);
		expect(results.length).toBeGreaterThan(0);
		const categories = new Set(results.map((r) => r.category));
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

	it("should apply config overrides to severity", async () => {
		const initialResults = await validate(spec);
		const ruleId = initialResults[0].id;

		const overriddenResults = await validate(spec, {
			config: { overrides: { [ruleId]: "suggestion" } },
		});
		const overridden = overriddenResults.find((r) => r.id === ruleId);
		expect(overridden?.severity).toBe("suggestion");
	});

	it("should run custom rules and include their results", async () => {
		const customRule = vi.fn().mockResolvedValue([
			{
				id: "CUSTOM_1",
				category: "Custom",
				severity: "error",
				passed: false,
				message: "Custom rule fired",
			},
		]);

		const results = await validate(spec, { customRules: [customRule] });
		const customResult = results.find((r) => r.id === "CUSTOM_1");
		expect(customResult).toBeDefined();
		expect(customResult?.message).toBe("Custom rule fired");
	});

	it("should handle a crashing validator category gracefully", async () => {
		vi.mocked(validateStructure).mockImplementation(() => {
			throw new Error("validator crashed");
		});
		const results = await validate(spec, { category: "structure" });
		const errResult = results.find((r) => r.id === "STRUCTURE_ERR");
		expect(errResult).toBeDefined();
		expect(errResult?.passed).toBe(false);
		expect(errResult?.message).toContain("validator crashed");
	});
});
