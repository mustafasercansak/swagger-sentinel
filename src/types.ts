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
	enum?: any[];
	example?: any;
	description?: string;
	$ref?: string;
	[key: string]: any; // Allow for vendor extensions
}

export interface OpenAPIOperation {
	tags?: string[];
	summary?: string;
	description?: string;
	operationId?: string;
	parameters?: OpenAPIParameter[];
	requestBody?: {
		description?: string;
		content: Record<string, { schema: OpenAPISchema; example?: any; examples?: any }>;
		required?: boolean;
		$ref?: string;
	};
	responses: Record<
		string,
		{
			description: string;
			content?: Record<string, { schema: OpenAPISchema; example?: any; examples?: any }>;
			headers?: Record<string, any>;
			$ref?: string;
		}
	>;
	deprecated?: boolean;
	security?: Array<Record<string, string[]>>;
	[key: string]: any; // Vendor extensions
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
	flows?: any;
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
		responses?: Record<string, any>;
		parameters?: Record<string, OpenAPIParameter>;
		examples?: Record<string, any>;
		requestBodies?: Record<string, any>;
		headers?: Record<string, any>;
		securitySchemes?: Record<string, OpenAPISecurityScheme>;
		links?: Record<string, any>;
		callbacks?: Record<string, any>;
	};
	security?: Array<Record<string, string[]>>;
	tags?: Array<{
		name: string;
		description?: string;
		externalDocs?: any;
	}>;
	externalDocs?: any;
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
