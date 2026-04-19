import fs from "node:fs";
import SwaggerParser from "@apidevtools/json-schema-ref-parser";
import { describe, expect, it, vi } from "vitest";
import {
	getAllOperations,
	loadSpec,
	resolveRef,
} from "../../src/utils/loader.js";

vi.mock("fs");
vi.mock("@apidevtools/json-schema-ref-parser");

describe("loader.ts", () => {
	describe("loadSpec", () => {
		it("should load a valid JSON spec", async () => {
			const mockSpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0.0" },
				paths: {},
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const mockParser = {
				dereference: vi.fn().mockResolvedValue(mockSpec),
			};
			vi.mocked(SwaggerParser).mockImplementation(
				() => mockParser as unknown as SwaggerParser,
			);

			const spec = await loadSpec("test.json");
			expect(spec.openapi).toBe("3.0.0");
		});

		it("should throw if file not found", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			await expect(loadSpec("missing.json")).rejects.toThrow("File not found");
		});

		it("should throw if not a valid OpenAPI version", async () => {
			const mockSpec = {
				openapi: "2.0.0",
				info: { title: "Test", version: "1.0.0" },
			};
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const mockParser = {
				dereference: vi.fn().mockResolvedValue(mockSpec),
			};
			vi.mocked(SwaggerParser).mockImplementation(
				() => mockParser as unknown as SwaggerParser,
			);

			await expect(loadSpec("test.json")).rejects.toThrow(
				"Unsupported OpenAPI version",
			);
		});
	});

	describe("resolveRef", () => {
		const spec = {
			components: {
				schemas: {
					User: { type: "object" },
				},
			},
		} as unknown as OpenAPISpec;

		it("should resolve a valid reference", () => {
			const resolved = resolveRef(spec, "#/components/schemas/User");
			expect(resolved).toEqual({ type: "object" });
		});

		it("should return null for invalid or external reference", () => {
			expect(resolveRef(spec, "external.yaml")).toBeNull();
			expect(resolveRef(spec, "#/invalid/path")).toBeUndefined();
		});
	});

	describe("getAllOperations", () => {
		it("should extract all operations from a spec", () => {
			const spec = {
				paths: {
					"/users": {
						get: { operationId: "getUsers" },
						post: { operationId: "createUser" },
					},
					"/products": {
						put: { operationId: "updateProduct" },
					},
				},
			} as unknown as OpenAPISpec;

			const ops = getAllOperations(spec);
			expect(ops).toHaveLength(3);
			expect(ops[0].method).toBe("GET");
			expect(ops[1].method).toBe("POST");
			expect(ops[2].method).toBe("PUT");
		});
	});
});
