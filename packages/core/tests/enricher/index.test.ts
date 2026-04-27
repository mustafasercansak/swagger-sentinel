import { beforeEach, describe, expect, it, vi } from "vitest";
import { enrichSpec } from "../../src/enricher/index.js";
import type { OpenAPISpec } from "../../src/types.js";

const mockEnrichBatch = vi.fn();

vi.mock("../../src/enricher/llm.js", () => {
	return {
		createLLMProvider: vi.fn().mockImplementation(() => {
			return {
				enrichBatch: mockEnrichBatch,
			};
		}),
	};
});

describe("AI Enricher", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should not call LLM if spec has no missing docs", async () => {
		const spec: OpenAPISpec = {
			openapi: "3.0.0",
			info: { title: "Test", version: "1.0.0" },
			paths: {
				"/test": {
					get: {
						summary: "Get test",
						description: "Gets the test item",
						responses: { "200": { description: "OK" } },
					},
				},
			},
			components: {
				schemas: {
					TestItem: {
						type: "object",
						description: "A test item schema",
					},
				},
			},
		};

		const result = await enrichSpec(spec, {
			provider: "gemini",
			apiKey: "test",
			lang: "en",
		});

		expect(result.enrichedCount).toBe(0);
		expect(mockEnrichBatch).not.toHaveBeenCalled();
	});

	it("should detect missing docs and patch the spec", async () => {
		const spec: OpenAPISpec = {
			openapi: "3.0.0",
			info: { title: "Test", version: "1.0.0" },
			paths: {
				"/test": {
					get: {
						responses: { "200": { description: "OK" } },
					},
				},
			},
			components: {
				schemas: {
					TestItem: {
						type: "object",
					},
				},
			},
		};

		mockEnrichBatch.mockResolvedValueOnce([
			{
				id: "op:get:/test",
				summary: "New summary",
				description: "New description",
			},
			{
				id: "schema:TestItem",
				description: "New schema description",
			},
		]);

		const result = await enrichSpec(spec, {
			provider: "gemini",
			apiKey: "test",
			lang: "en",
		});

		expect(result.enrichedCount).toBe(3); // summary + description + schema description
		expect(mockEnrichBatch).toHaveBeenCalledTimes(1);

		// Assert it was patched correctly
		// biome-ignore lint/suspicious/noExplicitAny: testing purposes
		const operation = (result.spec.paths as Record<string, any>)["/test"].get;
		expect(operation.summary).toBe("New summary");
		expect(operation.description).toBe("New description");

		// biome-ignore lint/suspicious/noExplicitAny: testing purposes
		const schema = (result.spec.components?.schemas as Record<string, any>)
			.TestItem;
		expect(schema.description).toBe("New schema description");
	});

	it("should handle missing paths and components objects gracefully", async () => {
		const spec = {
			openapi: "3.0.0",
			info: { title: "Test", version: "1.0.0" },
		} as unknown as OpenAPISpec;

		const result = await enrichSpec(spec, {
			provider: "gemini",
			apiKey: "test",
			lang: "en",
		});

		expect(result.enrichedCount).toBe(0);
		expect(mockEnrichBatch).not.toHaveBeenCalled();
	});
});
