import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/utils/config.js";

vi.mock("fs");

describe("config.ts", () => {
	it("should load config if file exists", () => {
		const mockConfig = { strict: true };
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

		const config = loadConfig();
		expect(config.strict).toBe(true);
	});

	it("should return empty object if file missing", () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const config = loadConfig();
		expect(config).toEqual({});
	});
});
