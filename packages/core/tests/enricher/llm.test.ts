import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createLLMProvider,
	GeminiProvider,
	OpenAIProvider,
} from "../../src/enricher/llm.js";
import type { MissingItem } from "../../src/enricher/types.js";

// Use vi.hoisted so these are available inside vi.mock factory (which is hoisted to top of file)
const { generateContentMock } = vi.hoisted(() => ({
	generateContentMock: vi.fn(),
}));

vi.mock("@google/generative-ai", () => {
	class GoogleGenerativeAI {
		getGenerativeModel() {
			return { generateContent: generateContentMock };
		}
	}
	return { GoogleGenerativeAI };
});

// Mock global fetch for OpenAI
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("LLM Providers", () => {
	const mockItems: MissingItem[] = [
		{ id: "op:get:/users", type: "operation", path: "GET /users", context: {} },
		{ id: "schema:User", type: "schema", path: "User", context: {} },
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createLLMProvider", () => {
		it("should create GeminiProvider", () => {
			const provider = createLLMProvider("gemini", "test-key");
			expect(provider).toBeInstanceOf(GeminiProvider);
			expect(provider.name).toBe("gemini");
		});

		it("should create OpenAIProvider", () => {
			const provider = createLLMProvider("openai", "test-key");
			expect(provider).toBeInstanceOf(OpenAIProvider);
			expect(provider.name).toBe("openai");
		});

		it("should throw for unsupported provider", () => {
			expect(() => createLLMProvider("anthropic", "test-key")).toThrowError(
				/Unsupported LLM provider/,
			);
		});
	});

	describe("GeminiProvider", () => {
		it("should parse valid JSON response", async () => {
			generateContentMock.mockResolvedValueOnce({
				response: {
					text: () =>
						'```json\n[{"id":"op:get:/users","summary":"Get users","description":"Retrieves users"}]\n```',
				},
			});

			const provider = new GeminiProvider("test-key");
			const result = await provider.enrichBatch(mockItems, "en");

			expect(result).toHaveLength(1);
			expect(result[0].summary).toBe("Get users");
		});

		it("should throw on invalid JSON response", async () => {
			generateContentMock.mockResolvedValueOnce({
				response: {
					text: () => "This is not JSON",
				},
			});

			const provider = new GeminiProvider("test-key");
			await expect(provider.enrichBatch(mockItems, "en")).rejects.toThrowError(
				/Failed to parse Gemini response/,
			);
		});
	});

	describe("OpenAIProvider", () => {
		it("should parse valid JSON response", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content:
									'[{"id":"schema:User","summary":"User schema","description":"Represents a user"}]',
							},
						},
					],
				}),
			});

			const provider = new OpenAIProvider("test-key");
			const result = await provider.enrichBatch(mockItems, "en");

			expect(result).toHaveLength(1);
			expect(result[0].summary).toBe("User schema");
			expect(fetchMock).toHaveBeenCalledWith(
				"https://api.openai.com/v1/chat/completions",
				expect.any(Object),
			);
		});

		it("should throw on fetch error", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: false,
				status: 401,
				text: async () => "Unauthorized",
			});

			const provider = new OpenAIProvider("test-key");
			await expect(provider.enrichBatch(mockItems, "en")).rejects.toThrowError(
				/OpenAI API error: 401 Unauthorized/,
			);
		});

		it("should throw on invalid JSON response", async () => {
			fetchMock.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: "Invalid JSON" } }],
				}),
			});

			const provider = new OpenAIProvider("test-key");
			await expect(provider.enrichBatch(mockItems, "en")).rejects.toThrowError(
				/Failed to parse OpenAI response/,
			);
		});
	});
});
