import { GoogleGenerativeAI } from "@google/generative-ai";
import type { EnrichedItem, LLMProvider, MissingItem } from "./types.js";

interface OpenAIChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

function getOpenAIMessageContent(payload: unknown): string {
	const data = payload as OpenAIChatCompletionResponse;
	const content = data.choices?.[0]?.message?.content;

	if (typeof content !== "string") {
		throw new Error(
			"OpenAI API error: response payload did not include content",
		);
	}

	return content;
}

function getPrompt(items: MissingItem[], lang: string): string {
	const languageStr = lang.toLowerCase() === "tr" ? "Turkish" : "English";
	return `You are an expert API designer. I have a list of OpenAPI operations and schemas that are missing their 'summary' and 'description' fields.
Your task is to analyze the context (paths, method, properties, parameters) and generate appropriate, concise summaries and detailed descriptions for each item.
The output MUST be in ${languageStr}.

Input Items:
${JSON.stringify(items, null, 2)}

Return ONLY a valid JSON array of objects with the exact following structure. Do not wrap it in markdown code blocks.
[
  {
    "id": "item-id",
    "summary": "Short concise summary",
    "description": "Detailed description explaining what this endpoint or schema does."
  }
]
`;
}

export class GeminiProvider implements LLMProvider {
	name = "gemini";
	private genAI: GoogleGenerativeAI;

	constructor(apiKey: string) {
		this.genAI = new GoogleGenerativeAI(apiKey);
	}

	async enrichBatch(
		items: MissingItem[],
		lang: string,
	): Promise<EnrichedItem[]> {
		const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
		const prompt = getPrompt(items, lang);

		const result = await model.generateContent(prompt);
		const response = result.response.text();

		// Clean markdown block if model accidentally adds it
		const cleanResponse = response
			.replace(/^```json/m, "")
			.replace(/```$/m, "")
			.trim();

		try {
			return JSON.parse(cleanResponse) as EnrichedItem[];
		} catch (_err) {
			throw new Error(
				"Failed to parse Gemini response as JSON. Response was: " +
					cleanResponse,
			);
		}
	}
}

export class OpenAIProvider implements LLMProvider {
	name = "openai";
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async enrichBatch(
		items: MissingItem[],
		lang: string,
	): Promise<EnrichedItem[]> {
		const prompt = getPrompt(items, lang);

		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [
					{
						role: "system",
						content:
							"You are an AI assistant that only outputs raw JSON. No markdown formatting, no explanations.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.2,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI API error: ${response.status} ${error}`);
		}

		const content = getOpenAIMessageContent(await response.json());

		const cleanResponse = content
			.replace(/^```json/m, "")
			.replace(/```$/m, "")
			.trim();

		try {
			return JSON.parse(cleanResponse) as EnrichedItem[];
		} catch (_err) {
			throw new Error(
				"Failed to parse OpenAI response as JSON. Response was: " +
					cleanResponse,
			);
		}
	}
}

export function createLLMProvider(
	provider: string,
	apiKey: string,
): LLMProvider {
	if (provider === "gemini") {
		return new GeminiProvider(apiKey);
	} else if (provider === "openai") {
		return new OpenAIProvider(apiKey);
	}
	throw new Error(
		`Unsupported LLM provider: ${provider}. Supported providers: gemini, openai`,
	);
}
