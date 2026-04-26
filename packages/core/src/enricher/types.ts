export interface MissingItem {
	id: string;
	type: "operation" | "schema";
	path: string; // e.g., "GET /users" or "UserDTO"
	context: Record<string, unknown>; // Partial object or parameters to give context to the LLM
}

export interface EnrichedItem {
	id: string;
	summary?: string;
	description?: string;
}

export interface LLMProvider {
	name: string;
	enrichBatch(items: MissingItem[], lang: string): Promise<EnrichedItem[]>;
}
