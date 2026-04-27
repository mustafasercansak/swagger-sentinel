import { describe, expect, it } from "vitest";
import { formatResults } from "../../src/utils/formatter.js";

describe("formatter.ts", () => {
	const results = [
		{
			id: "T1",
			category: "Test",
			severity: "error" as const,
			passed: false,
			message: "Error",
		},
		{
			id: "T2",
			category: "Test",
			severity: "warning" as const,
			passed: true,
			message: "OK",
		},
	];

	it("should return raw results for text format", () => {
		expect(formatResults(results, "text")).toEqual(results);
	});

	it("should format for JSON with summary", () => {
		const formatted = formatResults(results, "json") as {
			summary: {
				total: number;
				passed: number;
				failed: number;
				errors: number;
			};
			results: Array<{ id: string }>;
		};
		expect(formatted.summary.total).toBe(2);
		expect(formatted.summary.passed).toBe(1);
		expect(formatted.summary.failed).toBe(1);
		expect(formatted.summary.errors).toBe(1);
		expect(formatted.results).toHaveLength(2);
		expect(formatted.results[0].id).toBe("T1");
	});
});
