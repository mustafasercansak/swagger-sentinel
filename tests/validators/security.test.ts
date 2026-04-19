import { describe, expect, it } from "vitest";
import type { ValidationResult } from "../../src/types.js";
import { validateSecurity } from "../../src/validators/security.js";

function check(results: ValidationResult[], id: string) {
	return results.find((r) => r.id === id);
}

function spec(overrides: any = {}) {
	return Object.assign(
		{
			openapi: "3.0.3",
			info: { title: "Test", version: "1.0.0" },
			paths: {},
		},
		overrides,
	);
}

describe("validateSecurity", () => {
	// SEC90
	it("SEC90 passes when securitySchemes defined", () => {
		const s = spec({
			components: {
				securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
			},
		});
		expect(check(validateSecurity(s as any), "SEC90")?.passed).toBe(true);
	});

	it("SEC90 fails when no securitySchemes", () => {
		const r = check(validateSecurity(spec()), "SEC90");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("warning");
	});

	// SEC91
	it("SEC91 passes when apiKey is in header", () => {
		const s = spec({
			components: {
				securitySchemes: {
					apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC91")?.passed).toBe(true);
	});

	it("SEC91 fails when apiKey is in query", () => {
		const s = spec({
			components: {
				securitySchemes: {
					apiKey: { type: "apiKey", in: "query", name: "api_key" },
				},
			},
		});
		const r = check(validateSecurity(s as any), "SEC91");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("error");
	});

	// SEC93
	it("SEC93 passes when password field is writeOnly", () => {
		const s = spec({
			components: {
				schemas: {
					User: {
						properties: { password: { type: "string", writeOnly: true } },
					},
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC93")?.passed).toBe(true);
	});

	it("SEC93 fails when password field is not writeOnly", () => {
		const s = spec({
			components: {
				schemas: { User: { properties: { password: { type: "string" } } } },
			},
		});
		expect(check(validateSecurity(s as any), "SEC93")?.passed).toBe(false);
	});

	// SEC95
	it("SEC95 passes for https server", () => {
		const s = spec({ servers: [{ url: "https://api.example.com" }] });
		expect(check(validateSecurity(s as any), "SEC95")?.passed).toBe(true);
	});

	it("SEC95 passes for localhost http", () => {
		const s = spec({ servers: [{ url: "http://localhost:3000" }] });
		expect(check(validateSecurity(s as any), "SEC95")?.passed).toBe(true);
	});

	it("SEC95 fails for plain http production server", () => {
		const s = spec({ servers: [{ url: "http://api.example.com" }] });
		const r = check(validateSecurity(s as any), "SEC95");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("error");
	});

	// SEC96
	it("SEC96 passes when OAuth2 flow has scopes", () => {
		const s = spec({
			components: {
				securitySchemes: {
					oauth: {
						type: "oauth2",
						flows: {
							clientCredentials: {
								tokenUrl: "/token",
								scopes: { "read:items": "Read items" },
							},
						},
					},
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC96")?.passed).toBe(true);
	});

	it("SEC96 fails when OAuth2 flow has no scopes", () => {
		const s = spec({
			components: {
				securitySchemes: {
					oauth: {
						type: "oauth2",
						flows: { clientCredentials: { tokenUrl: "/token", scopes: {} } },
					},
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC96")?.passed).toBe(false);
	});

	// SEC97
	it("SEC97 passes when secured op has 401", () => {
		const s = spec({
			security: [{ bearer: [] }],
			paths: {
				"/items": {
					get: {
						responses: {
							"200": { description: "ok" },
							"401": { description: "unauth" },
						},
					},
				},
			},
			components: {
				securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
			},
		});
		expect(check(validateSecurity(s as any), "SEC97")?.passed).toBe(true);
	});

	it("SEC97 fails when secured op missing 401", () => {
		const s = spec({
			security: [{ bearer: [] }],
			paths: {
				"/items": { get: { responses: { "200": { description: "ok" } } } },
			},
			components: {
				securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
			},
		});
		expect(check(validateSecurity(s as any), "SEC97")?.passed).toBe(false);
	});

	// SEC99
	it("SEC99 passes for normal server URL", () => {
		const s = spec({ servers: [{ url: "https://api.example.com" }] });
		expect(check(validateSecurity(s as any), "SEC99")?.passed).toBe(true);
	});

	it("SEC99 fails when credentials in server URL", () => {
		const s = spec({ servers: [{ url: "https://user:pass@api.example.com" }] });
		const r = check(validateSecurity(s as any), "SEC99");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("error");
	});

	// SEC100
	it("SEC100 passes when no basic auth scheme", () => {
		const s = spec({
			components: {
				securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
			},
		});
		expect(check(validateSecurity(s as any), "SEC100")?.passed).toBe(true);
	});

	it("SEC100 fails when basic auth scheme is used", () => {
		const s = spec({
			components: {
				securitySchemes: { basic: { type: "http", scheme: "basic" } },
			},
		});
		const r = check(validateSecurity(s as any), "SEC100");
		expect(r?.passed).toBe(false);
		expect(r?.severity).toBe("warning");
	});

	// SEC101 Deprecated X- prefix in security headers
	it("SEC101 passes when header name is normal", () => {
		const s = spec({
			components: {
				securitySchemes: {
					apiKey: { type: "apiKey", in: "header", name: "Authorization" },
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC101")?.passed).toBe(true);
	});

	it("SEC101 fails when header name starts with X-", () => {
		const s = spec({
			components: {
				securitySchemes: {
					apiKey: { type: "apiKey", in: "header", name: "X-API-TOKEN" },
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC101")?.passed).toBe(false);
	});

	// SEC102 HTML responses should include a Content-Security-Policy header
	it("SEC102 passes when HTML response has CSP header", () => {
		const s = spec({
			paths: {
				"/index.html": {
					get: {
						responses: {
							"200": {
								content: { "text/html": {} },
								headers: {
									"Content-Security-Policy": { schema: { type: "string" } },
								},
							},
						},
					},
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC102")?.passed).toBe(true);
	});

	it("SEC102 fails when HTML response missing CSP header", () => {
		const s = spec({
			paths: {
				"/index.html": {
					get: {
						responses: {
							"200": { content: { "text/html": {} } },
						},
					},
				},
			},
		});
		expect(check(validateSecurity(s as any), "SEC102")?.passed).toBe(false);
	});
});
