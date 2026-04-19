import fs from "fs";
import { describe, expect, it, vi } from "vitest";
import { findLineNumber } from "../../src/utils/source-map.js";

vi.mock("fs");

describe("source-map.ts", () => {
	const mockYaml = `
openapi: 3.0.0
info:
  title: Test API
paths:
  /pets:
    get:
      summary: List pets
    post:
      summary: Create pet
`;

	it("should find line number for a path", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
		const line = findLineNumber("test.yaml", "/pets");
		expect(line).toBe(6);
	});

	it("should find line number with context", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
		const line = findLineNumber("test.yaml", "post", "/pets");
		expect(line).toBe(9);
	});

	it("should find line number for a direct key", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
		const line = findLineNumber("test.yaml", "openapi");
		expect(line).toBe(2);
	});

	it("should return undefined if not found", () => {
		vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);
		const line = findLineNumber("test.yaml", "missing");
		expect(line).toBeUndefined();
	});

	it("should return undefined on file error", () => {
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw new Error("FS Error");
		});
		const line = findLineNumber("test.yaml", "openapi");
		expect(line).toBeUndefined();
	});
});
