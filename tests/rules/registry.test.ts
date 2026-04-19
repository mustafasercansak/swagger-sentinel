import { describe, expect, it } from "vitest";
import { RULE_REGISTRY } from "../../src/rules/registry.js";

describe("registry.ts", () => {
	it("should have a non-empty rule registry", () => {
		expect(RULE_REGISTRY.length).toBeGreaterThan(100);
	});

	it("should have unique IDs for all rules", () => {
		const ids = RULE_REGISTRY.map((r) => r.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
	});

	it("should have valid categories for all rules", () => {
		const validCategories = [
			"Structure",
			"Paths",
			"Operations",
			"Request",
			"Response",
			"Security",
			"Documentation",
		];
		for (const rule of RULE_REGISTRY) {
			expect(validCategories).toContain(rule.category);
		}
	});
});
