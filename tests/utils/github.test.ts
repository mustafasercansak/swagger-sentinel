import { describe, it, expect } from "vitest";
import { formatGitHubAnnotation, generateGitHubSummary } from "../../src/utils/github.js";

describe("github.ts", () => {
	describe("formatGitHubAnnotation", () => {
		it("should return empty string for passed results", () => {
			const result = { id: "T1", category: "Test", severity: "error" as const, passed: true, message: "OK" };
			expect(formatGitHubAnnotation(result, "spec.yaml")).toBe("");
		});

		it("should format error annotation", () => {
			const result = { id: "T1", category: "Test", severity: "error" as const, passed: false, message: "Error msg", line: 10 };
			expect(formatGitHubAnnotation(result, "spec.yaml")).toBe("::error file=spec.yaml,line=10::[T1] Error msg");
		});

		it("should format warning annotation with details", () => {
			const result = { id: "T2", category: "Test", severity: "warning" as const, passed: false, message: "Warn msg", details: "Some detail" };
			expect(formatGitHubAnnotation(result, "spec.yaml")).toBe("::warning file=spec.yaml,line=1::[T2] Warn msg - Some detail");
		});
	});

	describe("generateGitHubSummary", () => {
		it("should generate a success summary", () => {
			const results = [
				{ id: "T1", category: "Test", severity: "error" as const, passed: true, message: "OK" }
			];
			const summary = generateGitHubSummary(results, "spec.yaml");
			expect(summary).toContain("Perfect Score!");
			expect(summary).toContain("100.0%");
		});

		it("should generate a failure summary", () => {
			const results = [
				{ id: "T1", category: "Test", severity: "error" as const, passed: false, message: "Failed" }
			];
			const summary = generateGitHubSummary(results, "spec.yaml");
			expect(summary).toContain("Issues Found");
			expect(summary).toContain("| T1 | 🔴 error | Test | Failed |");
		});
	});
});
