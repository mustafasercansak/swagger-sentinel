import type {
	OpenAPISchema,
	OpenAPISecurityScheme,
	OpenAPISpec,
	ValidationResult,
} from "../types.js";
import { getAllOperations } from "../utils/loader.js";

/**
 * Category: Security (14 checks, 10 automated)
 */
export function validateSecurity(spec: OpenAPISpec): ValidationResult[] {
	const results: ValidationResult[] = [];
	const ops = getAllOperations(spec);

	// SEC90: Security schemes defined
	const hasSecuritySchemes = !!(
		spec.components?.securitySchemes &&
		Object.keys(spec.components.securitySchemes).length > 0
	);
	results.push({
		id: "SEC90",
		category: "Security",
		severity: "warning",
		passed: hasSecuritySchemes,
		message: "Security schemes are defined",
		details: !hasSecuritySchemes
			? "Every production API needs authentication — add components.securitySchemes"
			: null,
	});

	// SEC91: No API keys in query parameters
	const queryApiKeys: string[] = [];
	if (spec.components?.securitySchemes) {
		for (const [name, scheme] of Object.entries(
			spec.components.securitySchemes,
		)) {
			const s = scheme as OpenAPISecurityScheme;
			if (s.type === "apiKey" && s.in === "query") {
				queryApiKeys.push(name);
			}
		}
	}
	results.push({
		id: "SEC91",
		category: "Security",
		severity: "error",
		passed: queryApiKeys.length === 0,
		message: "No API keys in query parameters",
		details:
			queryApiKeys.length > 0
				? `Keys in query: ${queryApiKeys.join(", ")} — move to header. Query params leak into logs, browser history, referrer headers.`
				: null,
	});

	// SEC93: Sensitive fields marked writeOnly
	const sensitiveFields = [
		"password",
		"secret",
		"token",
		"apiKey",
		"api_key",
		"creditCard",
		"ssn",
	];
	const notWriteOnly: string[] = [];
	if (spec.components?.schemas) {
		for (const [schemaName, schema] of Object.entries(
			spec.components.schemas,
		)) {
			if (schema.properties) {
				for (const [propName, propSchema] of Object.entries(
					schema.properties,
				)) {
					const p = propSchema as OpenAPISchema;
					if (
						sensitiveFields.some((f) =>
							propName.toLowerCase().includes(f.toLowerCase()),
						) &&
						!p.writeOnly
					) {
						notWriteOnly.push(`${schemaName}.${propName}`);
					}
				}
			}
		}
	}

	results.push({
		id: "SEC93",
		category: "Security",
		severity: "warning",
		passed: notWriteOnly.length === 0,
		message: "Sensitive fields are marked writeOnly",
		details:
			notWriteOnly.length > 0
				? `Not writeOnly: ${notWriteOnly.join(", ")}`
				: null,
	});

	// SEC94: Global security is defined or per-operation
	const hasGlobalSecurity = !!(spec.security && spec.security.length > 0);
	const allOpsHaveSecurity = ops.every(
		(o) => o.operation.security !== undefined,
	);
	results.push({
		id: "SEC94",
		category: "Security",
		severity: "suggestion",
		passed: hasGlobalSecurity || allOpsHaveSecurity,
		message: "Security is applied globally or per-operation",
		details: !(hasGlobalSecurity || allOpsHaveSecurity)
			? "Add top-level security or per-operation security"
			: null,
	});

	// SEC95: Production server URLs use HTTPS
	const httpServers = (spec.servers || []).filter(
		(s) =>
			s.url?.startsWith("http://") &&
			!s.url.includes("localhost") &&
			!s.url.includes("127.0.0.1"),
	);
	results.push({
		id: "SEC95",
		category: "Security",
		severity: "error",
		passed: httpServers.length === 0,
		message: "Production server URLs use HTTPS",
		details:
			httpServers.length > 0
				? `Plain HTTP servers: ${httpServers.map((s) => s.url).join(", ")}`
				: null,
	});

	// SEC96: OAuth2 flows define scopes
	const oauthNoScopes: string[] = [];
	if (spec.components?.securitySchemes) {
		for (const [name, scheme] of Object.entries(
			spec.components.securitySchemes,
		)) {
			const s = scheme as OpenAPISecurityScheme;
			if (s.type === "oauth2" && s.flows) {
				for (const [flowName, flow] of Object.entries(s.flows)) {
					const f = flow as { scopes?: Record<string, string> };
					if (!f.scopes || Object.keys(f.scopes).length === 0) {
						oauthNoScopes.push(`${name}.${flowName}`);
					}
				}
			}
		}
	}
	results.push({
		id: "SEC96",
		category: "Security",
		severity: "warning",
		passed: oauthNoScopes.length === 0,
		message: "OAuth2 flows define at least one scope",
		details:
			oauthNoScopes.length > 0
				? `No scopes: ${oauthNoScopes.join(", ")}`
				: null,
	});

	// SEC97: Secured operations define 401 Unauthorized response
	const securedNo401: string[] = [];
	for (const op of ops) {
		const opSecurity =
			op.operation.security !== undefined
				? op.operation.security
				: spec.security;
		const isSecured = opSecurity && opSecurity.length > 0;
		if (isSecured) {
			const codes = Object.keys(op.operation.responses || {});
			if (!codes.includes("401") && !codes.includes("default")) {
				securedNo401.push(`${op.method} ${op.path}`);
			}
		}
	}
	results.push({
		id: "SEC97",
		category: "Security",
		severity: "warning",
		passed: securedNo401.length === 0,
		message: "Secured operations define 401 Unauthorized response",
		details:
			securedNo401.length > 0
				? `Missing 401: ${securedNo401.slice(0, 3).join(", ")}${securedNo401.length > 3 ? ` (+${securedNo401.length - 3} more)` : ""}`
				: null,
	});

	// SEC98: Secured operations define 403 Forbidden response
	const securedNo403: string[] = [];
	for (const op of ops) {
		const opSecurity =
			op.operation.security !== undefined
				? op.operation.security
				: spec.security;
		const isSecured = opSecurity && opSecurity.length > 0;
		if (isSecured) {
			const codes = Object.keys(op.operation.responses || {});
			if (!codes.includes("403") && !codes.includes("default")) {
				securedNo403.push(`${op.method} ${op.path}`);
			}
		}
	}
	results.push({
		id: "SEC98",
		category: "Security",
		severity: "suggestion",
		passed: securedNo403.length === 0,
		message: "Secured operations define 403 Forbidden response",
		details:
			securedNo403.length > 0
				? `Missing 403: ${securedNo403.slice(0, 3).join(", ")}${securedNo403.length > 3 ? ` (+${securedNo403.length - 3} more)` : ""}`
				: null,
	});

	// SEC99: No credentials embedded in server URLs
	const credentialServers = (spec.servers || []).filter(
		(s) => s.url && /:\/\/[^@/]+:[^@/]+@/.test(s.url),
	);
	results.push({
		id: "SEC99",
		category: "Security",
		severity: "error",
		passed: credentialServers.length === 0,
		message: "No credentials embedded in server URLs",
		details:
			credentialServers.length > 0
				? `Credentials in URL: ${credentialServers.map((s) => s.url).join(", ")}`
				: null,
	});

	// SEC100: HTTP Basic authentication not used (insecure without TLS enforcement)
	const basicSchemes: string[] = [];
	if (spec.components?.securitySchemes) {
		for (const [name, scheme] of Object.entries(
			spec.components.securitySchemes,
		)) {
			const s = scheme as OpenAPISecurityScheme;
			if (s.type === "http" && s.scheme === "basic") {
				basicSchemes.push(name);
			}
		}
	}
	results.push({
		id: "SEC100",
		category: "Security",
		severity: "warning",
		passed: basicSchemes.length === 0,
		message: "HTTP Basic authentication is not used",
		details:
			basicSchemes.length > 0
				? `Basic auth schemes: ${basicSchemes.join(", ")} — prefer Bearer/OAuth2/API key`
				: null,
	});

	// SEC101: No X- prefix for custom security headers
	const xPrefixHeaders: string[] = [];
	if (spec.components?.securitySchemes) {
		for (const [name, scheme] of Object.entries(
			spec.components.securitySchemes,
		)) {
			const s = scheme as OpenAPISecurityScheme;
			if (
				s.type === "apiKey" &&
				s.in === "header" &&
				s.name?.toUpperCase().startsWith("X-")
			) {
				xPrefixHeaders.push(`${name} ("${s.name}")`);
			}
		}
	}
	results.push({
		id: "SEC101",
		category: "Security",
		severity: "warning",
		passed: xPrefixHeaders.length === 0,
		message: "Security headers do not use the deprecated X- prefix",
		details:
			xPrefixHeaders.length > 0
				? `Found: ${xPrefixHeaders.join(", ")} — prefer direct names (e.g., "Api-Key" instead of "X-Api-Key")`
				: null,
	});

	// SEC102: Content-Security-Policy suggested for HTML responses
	const htmlMissingCsp: string[] = [];
	for (const op of ops) {
		const responses = op.operation.responses || {};
		for (const [code, resp] of Object.entries(responses)) {
			const content =
				(resp as { content?: Record<string, { schema?: unknown }> }).content ||
				{};
			if (content["text/html"]) {
				const headers =
					(resp as { headers?: Record<string, unknown> }).headers || {};
				const hasCsp = Object.keys(headers).some(
					(h) => h.toLowerCase() === "content-security-policy",
				);
				if (!hasCsp) {
					htmlMissingCsp.push(`${op.method} ${op.path} (${code})`);
				}
			}
		}
	}
	results.push({
		id: "SEC102",
		category: "Security",
		severity: "suggestion",
		passed: htmlMissingCsp.length === 0,
		message: "HTML responses should include a Content-Security-Policy header",
		details:
			htmlMissingCsp.length > 0
				? `Missing CSP on: ${htmlMissingCsp.join(", ")}`
				: null,
	});

	return results;
}
