import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli.js";

describe("CLI integration", () => {
	let logSpy: any;
	let errorSpy: any;
	let exitSpy: any;
	const INVALID_SPEC_PATH = "tests/temp-invalid.yaml";
	const V2_SPEC_PATH = "tests/temp-v2.yaml";

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
			return undefined as never;
		});
		chalk.level = 0;

		// Create temp fixtures
		fs.writeFileSync(
			INVALID_SPEC_PATH,
			`
openapi: 3.0.0
info:
  title: Invalid Spec
  version: ""
paths:
  /test:
    get:
      responses:
        '200':
          description: OK
		`.trim(),
		);

		fs.writeFileSync(
			V2_SPEC_PATH,
			`
openapi: 3.0.0
info:
  title: Sample API V2
  version: 2.0.0
paths:
  /new-path:
    get:
      responses:
        '200':
          description: OK
		`.trim(),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (fs.existsSync(INVALID_SPEC_PATH)) fs.unlinkSync(INVALID_SPEC_PATH);
		if (fs.existsSync(V2_SPEC_PATH)) fs.unlinkSync(V2_SPEC_PATH);
	});

	it("should display version", async () => {
		await run(["node", "cli.js", "--version"]);
	});

	it("should validate a valid spec", async () => {
		await run(["node", "cli.js", "validate", "tests/sample-spec.yaml"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("checks passed"),
		);
	});

	it("should validate in JSON format", async () => {
		await run([
			"node",
			"cli.js",
			"validate",
			"tests/sample-spec.yaml",
			"--format",
			"json",
		]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("["));
	});

	it("should handle invalid spec and find line numbers", async () => {
		await run(["node", "cli.js", "validate", INVALID_SPEC_PATH]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("checks passed"),
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should output GitHub annotations", async () => {
		process.env.GITHUB_ACTIONS = "true";
		await run([
			"node",
			"cli.js",
			"validate",
			INVALID_SPEC_PATH,
			"--github-annotations",
		]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("::error"));
		delete process.env.GITHUB_ACTIONS;
	});

	it("should save summary to file", async () => {
		const writeSpy = vi
			.spyOn(fs, "writeFileSync")
			.mockImplementation((path, data, options) => {
				// Avoid actually writing the summary during test if we can
				if (typeof path === "string" && path.includes("summary.md"))
					return undefined;
				return undefined;
			});
		await run([
			"node",
			"cli.js",
			"validate",
			"tests/sample-spec.yaml",
			"--summary",
			"summary.md",
		]);
		expect(writeSpy).toHaveBeenCalled();
	});

	it("should fail on non-existent file", async () => {
		await run(["node", "cli.js", "validate", "non-existent.yaml"]);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should generate tests for a spec", async () => {
		const writeSpy = vi
			.spyOn(fs, "writeFileSync")
			.mockImplementation(() => undefined);
		vi.spyOn(fs, "existsSync").mockReturnValue(true);
		vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);

		await run([
			"node",
			"cli.js",
			"generate",
			"tests/sample-spec.yaml",
			"-o",
			"out",
		]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Generated"));
	});

	it("should run diff command with no changes", async () => {
		await run([
			"node",
			"cli.js",
			"diff",
			"tests/sample-spec.yaml",
			"tests/sample-spec.yaml",
		]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("No changes detected"),
		);
	});

	it("should run diff command and detect changes", async () => {
		await run([
			"node",
			"cli.js",
			"diff",
			"tests/sample-spec.yaml",
			V2_SPEC_PATH,
		]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Breaking Changes"),
		);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should run syntax command", async () => {
		await run(["node", "cli.js", "syntax", "tests/sample-spec.yaml"]);
		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining("Valid OpenAPI"),
		);
	});

	it("should run list rules command with category filter", async () => {
		await run(["node", "cli.js", "rules", "--category", "Structure"]);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Structure"));
		expect(logSpy).not.toHaveBeenCalledWith(
			expect.stringContaining("Security"),
		);
	});

	it("should display specific rule info", async () => {
		await run(["node", "cli.js", "rules", "S01"]);
		expect(logSpy).toHaveBeenCalled();
	});

	it("should error on non-existent rule", async () => {
		await run(["node", "cli.js", "rules", "INVALID"]);
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it("should run tags command", async () => {
		await run(["node", "cli.js", "tags", "tests/sample-spec.yaml"]);
		expect(logSpy).toHaveBeenCalled();
	});

	it("should run export-spectral command", async () => {
		await run(["node", "cli.js", "export-spectral"]);
		expect(logSpy).toHaveBeenCalled();
	});
});
