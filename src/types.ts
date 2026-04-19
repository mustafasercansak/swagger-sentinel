export type Severity = "error" | "warning" | "suggestion";

export interface ValidationResult {
	id: string;
	category: string;
	severity: Severity;
	passed: boolean;
	message: string;
	details?: string | null;
	line?: number;
	path?: string; // JSON path or property name to aid line finding
}

export type ValidatorFunction = (spec: OpenAPISpec) => ValidationResult[];

export interface OpenAPIParameter {
	name: string;
	in: "query" | "header" | "path" | "cookie";
	description?: string;
	required?: boolean;
	deprecated?: boolean;
	schema?: OpenAPISchema;
}

export interface OpenAPISchema {
	type?: string;
	format?: string;
	properties?: Record<string, OpenAPISchema>;
	items?: OpenAPISchema;
	required?: string[];
	enum?: unknown[];
	example?: unknown;
	description?: string;
	$ref?: string;
	[key: string]: unknown; // Allow for vendor extensions
}

export interface OpenAPIResponse {
	description: string;
	content?: Record<
		string,
		{ schema: OpenAPISchema; example?: unknown; examples?: unknown }
	>;
	headers?: Record<string, unknown>;
	$ref?: string;
}

export interface OpenAPIRequestBody {
	description?: string;
	content: Record<
		string,
		{ schema: OpenAPISchema; example?: unknown; examples?: unknown }
	>;
	required?: boolean;
	$ref?: string;
}

export interface OpenAPIOperation {
	tags?: string[];
	summary?: string;
	description?: string;
	operationId?: string;
	parameters?: OpenAPIParameter[];
	requestBody?: OpenAPIRequestBody;
	responses: Record<string, OpenAPIResponse>;
	deprecated?: boolean;
	security?: Array<Record<string, string[]>>;
	[key: string]: unknown; // Vendor extensions
}

export interface OpenAPIPathItem {
	get?: OpenAPIOperation;
	post?: OpenAPIOperation;
	put?: OpenAPIOperation;
	delete?: OpenAPIOperation;
	patch?: OpenAPIOperation;
	head?: OpenAPIOperation;
	options?: OpenAPIOperation;
	parameters?: OpenAPIParameter[];
}

export interface OpenAPISecurityScheme {
	type: "apiKey" | "http" | "oauth2" | "openIdConnect";
	description?: string;
	name?: string;
	in?: "query" | "header" | "cookie";
	scheme?: string;
	bearerFormat?: string;
	flows?: unknown;
	openIdConnectUrl?: string;
}

export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
		contact?: {
			name?: string;
			email?: string;
			url?: string;
		};
		license?: {
			name: string;
			url?: string;
		};
		termsOfService?: string;
	};
	servers?: Array<{
		url: string;
		description?: string;
	}>;
	paths: Record<string, OpenAPIPathItem>;
	components?: {
		schemas?: Record<string, OpenAPISchema>;
		responses?: Record<string, OpenAPIResponse | Record<string, unknown>>;
		parameters?: Record<string, OpenAPIParameter | Record<string, unknown>>;
		examples?: Record<string, unknown>;
		requestBodies?: Record<string, OpenAPIRequestBody | Record<string, unknown>>;
		headers?: Record<string, unknown>;
		securitySchemes?: Record<string, OpenAPISecurityScheme>;
		links?: Record<string, unknown>;
		callbacks?: Record<string, unknown>;
	};
	security?: Array<Record<string, string[]>>;
	tags?: Array<{
		name: string;
		description?: string;
		externalDocs?: unknown;
	}>;
	externalDocs?: unknown;
}

export interface SentinelConfig {
	strict?: boolean;
	ignore?: string[];
	overrides?: Record<string, Severity>;
	generate?: {
		seed?: number | string;
		baseUrl?: string;
		output?: string;
	};
}
