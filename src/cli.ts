#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { compareSpecs, type DiffChange } from "./comparator/index.js";
import { generate } from "./generators/index.js";
import { getRuleExtendedInfo, getRulesByCategory } from "./rules/registry.js";
import type { ValidationResult } from "./types.js";
import { loadConfig } from "./utils/config.js";
import { formatResults } from "./utils/formatter.js";
import {
	formatGitHubAnnotation,
	generateGitHubSummary,
	isGitHubActions,
} from "./utils/github.js";
import { loadSpec } from "./utils/loader.js";
import { findLineNumber } from "./utils/source-map.js";
import { validate } from "./validators/index.js";

// Load package.json for versioning
const pkgPath = path.resolve(__dirname, "../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

export async function run(args: string[] = process.argv) {
	const program = new Command();

	program
		.name("swagger-sentinel")
		.description("Opinionated OpenAPI 3.x validator and test generator")
		.version(pkg.version);

	program
		.command("validate <specFile>")
		.description("Validate an OpenAPI spec against the 130-point checklist")
		.option("--strict", "Treat warnings as errors")
		.option("--format <format>", "Output format: text, json", "text")
		.option("--category <category>", "Validate only a specific category")
		.option("--rules <path>", "Path to custom rules directory")
		.option("--fix", "Auto-correct safe violations")
		.option(
			"--github-annotations",
			"Output GitHub Actions annotations (warning/error)",
		)
		.option(
			"--summary <path>",
			"Save a Markdown summary of the results to a file",
		)
		.action(async (specFile: string, options: Record<string, unknown>) => {
			try {
				const config = loadConfig();
				const mergedOptions = {
					...options,
					strict: options.strict || config.strict || false,
				};

				let customRules: unknown[] = [];
				if (options.rules) {
					const { loadCustomRules } = await import("./rules/manager.js");
					customRules = await loadCustomRules(options.rules as string);
				}

				const spec = await loadSpec(specFile);

				if (options.fix) {
					const { applyFixes } = await import("./fixer/index.js");
					const yaml = await import("js-yaml");
					const fixCount = applyFixes(spec);
					if (fixCount > 0) {
						fs.writeFileSync(specFile, yaml.dump(spec), "utf-8");
						console.log(
							chalk.green(`\n  ✓ Applied ${fixCount} fix(es) to ${specFile}`),
						);
					}
				}

				const results = await validate(spec, {
					...mergedOptions,
					config,
					customRules,
				});

				// Post-process to find line numbers for errors
				results.forEach((r) => {
					if (!r.passed) {
						// Heuristic to find path in message or details
						let searchPath = r.path;
						if (!searchPath && r.message) {
							const pathMatch = r.message.match(/(\/[a-zA-Z0-9_{}/-]+)/);
							if (pathMatch) searchPath = pathMatch[1];
						}
						if (searchPath) {
							r.line = findLineNumber(specFile, searchPath);
						}
					}
				});

				const output = formatResults(results, options.format as string);

				if (options.format === "json") {
					console.log(JSON.stringify(output, null, 2));
				} else {
					printResults(results, mergedOptions.strict as boolean);
				}

				// Handle GitHub Actions Annotations
				if (
					options.githubAnnotations ||
					(isGitHubActions() && options.format === "text")
				) {
					results
						.filter((r) => !r.passed)
						.forEach((r) => {
							const annotation = formatGitHubAnnotation(r, specFile);
							if (annotation) console.log(annotation);
						});
				}

				// Handle Job Summary
				if (options.summary) {
					const summaryMd = generateGitHubSummary(results, specFile);
					fs.writeFileSync(options.summary as string, summaryMd, "utf-8");
					console.log(chalk.cyan(`\n📊 Summary saved to ${options.summary}`));
				}

				const hasErrors = results.some(
					(r) => r.severity === "error" && !r.passed,
				);
				const hasWarnings = results.some(
					(r) => r.severity === "warning" && !r.passed,
				);

				process.exit(
					hasErrors || (mergedOptions.strict && hasWarnings) ? 1 : 0,
				);
			} catch (err: unknown) {
				const error = err as Error;
				console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
				process.exit(1);
			}
		});

	// =====================================================
	// GENERATE
	// =====================================================
	program
		.command("generate <specFile>")
		.description("Generate Vitest TypeScript tests from an OpenAPI spec")
		.option(
			"-o, --output <dir>",
			"Output directory for generated tests",
			"./tests",
		)
		.option("--tag <tag>", "Generate tests for a specific tag only")
		.option(
			"--base-url <url>",
			"Base URL for API requests",
			"http://localhost:3000",
		)
		.option("--seed <number>", "Seed for Faker.js consistency", "42")
		.action(async (specFile: string, options: Record<string, unknown>) => {
			try {
				const config = loadConfig();
				const genConfig = config.generate || {};

				const mergedOptions = {
					...options,
					output:
						options.output !== "./tests"
							? options.output
							: genConfig.output || "./tests",
					baseUrl:
						options.baseUrl !== "http://localhost:3000"
							? options.baseUrl
							: genConfig.baseUrl || "http://localhost:3000",
					seed: options.seed !== "42" ? options.seed : genConfig.seed || "42",
				};

				const spec = await loadSpec(specFile);
				const genOptions = {
					baseUrl: mergedOptions.baseUrl as string,
					tag: options.tag as string | undefined,
					output: mergedOptions.output as string,
				};
				const files = generate(spec, genOptions);

				if (!fs.existsSync(mergedOptions.output as string)) {
					fs.mkdirSync(mergedOptions.output as string, { recursive: true });
				}

				for (const file of files) {
					const filePath = path.join(mergedOptions.output as string, file.name);
					fs.writeFileSync(filePath, file.content, "utf-8");
					console.log(chalk.green(`  ✓ ${filePath}`));
				}

				console.log(
					chalk.green(
						`\n✓ Generated ${files.length} test file(s) in ${mergedOptions.output}\n`,
					),
				);
			} catch (err: unknown) {
				const error = err as Error;
				console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
				process.exit(1);
			}
		});

	// =====================================================
	// WATCH
	// =====================================================
	program
		.command("watch <specFile>")
		.description("Watch spec file and re-validate on changes")
		.option("--strict", "Treat warnings as errors")
		.action(async (specFile: string, options: Record<string, unknown>) => {
			const chokidar = await import("chokidar");
			const config = loadConfig();
			const mergedOptions = {
				...options,
				strict: options.strict || config.strict || false,
			};

			console.log(chalk.cyan(`\n👁  Watching ${specFile} for changes...\n`));

			const runValidation = async () => {
				try {
					const spec = await loadSpec(specFile);
					const results = await validate(spec, { ...mergedOptions, config });
					console.log(
						chalk.gray(`\n--- ${new Date().toLocaleTimeString()} ---`),
					);
					printResults(results, mergedOptions.strict as boolean);
				} catch (err: unknown) {
					const error = err as Error;
					console.error(chalk.red(`\n✗ ${error.message}`));
				}
			};

			runValidation();

			chokidar.watch(specFile, { ignoreInitial: true }).on("change", () => {
				runValidation();
			});
		});

	// =====================================================
	// UTILITY: syntax check
	// =====================================================
	program
		.command("syntax <specFile>")
		.alias("validate-only")
		.description("Quick syntax/structure check only")
		.action(async (specFile: string) => {
			try {
				const spec = await loadSpec(specFile);

				if (!spec.openapi)
					throw new Error(
						'Missing "openapi" field — not a valid OpenAPI document',
					);
				if (!spec.info) throw new Error('Missing "info" field');
				if (!spec.paths || Object.keys(spec.paths).length === 0)
					throw new Error("No paths defined");

				const pathCount = Object.keys(spec.paths).length;
				let opCount = 0;
				for (const p of Object.values(spec.paths)) {
					for (const method of [
						"get",
						"post",
						"put",
						"patch",
						"delete",
						"head",
						"options",
					]) {
						if ((p as Record<string, unknown>)[method]) opCount++;
					}
				}

				console.log(chalk.green(`\n✓ Valid OpenAPI ${spec.openapi} spec`));
				console.log(
					chalk.gray(`  ${pathCount} paths, ${opCount} operations\n`),
				);
			} catch (err: unknown) {
				const error = err as Error;
				console.error(chalk.red(`\n✗ Invalid spec: ${error.message}\n`));
				process.exit(1);
			}
		});

	// =====================================================
	// UTILITY: list tags
	// =====================================================
	program
		.command("tags <specFile>")
		.alias("list-tags")
		.description("List all operation tags in the spec")
		.action(async (specFile: string) => {
			try {
				const spec = await loadSpec(specFile);
				const tags = new Map<string, string[]>();

				for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
					for (const method of [
						"get",
						"post",
						"put",
						"patch",
						"delete",
						"head",
						"options",
					]) {
						const op = (pathItem as Record<string, unknown>)[method] as {
							tags?: string[];
						};
						if (op?.tags) {
							for (const tag of op.tags) {
								if (!tags.has(tag)) tags.set(tag, []);
								tags.get(tag)?.push(`${method.toUpperCase()} ${pathStr}`);
							}
						}
					}
				}

				if (tags.size === 0) {
					console.log(chalk.yellow("\n⚠ No tags found in spec\n"));
					return;
				}

				console.log(chalk.cyan(`\nTags in spec:\n`));
				for (const [tag, ops] of tags.entries()) {
					console.log(chalk.white(`  ${tag} (${ops.length} operations)`));
					for (const op of ops) {
						console.log(chalk.gray(`    ${op}`));
					}
				}
				console.log("");
			} catch (err: unknown) {
				const error = err as Error;
				console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
				process.exit(1);
			}
		});

	// =====================================================
	// DIFF
	// =====================================================
	program
		.command("diff <oldSpec> <newSpec>")
		.description("Compare two spec versions and report breaking changes")
		.option("--format <format>", "Output format: text, json", "text")
		.action(
			async (
				oldSpecFile: string,
				newSpecFile: string,
				options: Record<string, unknown>,
			) => {
				try {
					const oldSpec = await loadSpec(oldSpecFile);
					const newSpec = await loadSpec(newSpecFile);
					const changes = compareSpecs(oldSpec, newSpec);

					if (options.format === "json") {
						console.log(JSON.stringify(changes, null, 2));
					} else {
						printDiffResults(changes);
					}

					const hasBreaking = changes.some((c) => c.type === "breaking");
					process.exit(hasBreaking ? 1 : 0);
				} catch (err: unknown) {
					const error = err as Error;
					console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
					process.exit(1);
				}
			},
		);

	// =====================================================
	// PRINT HELPERS
	// =====================================================
	function printDiffResults(changes: DiffChange[]) {
		if (changes.length === 0) {
			console.log(chalk.green("\n✓ No changes detected between specs\n"));
			return;
		}

		const breaking = changes.filter((c) => c.type === "breaking");
		const nonBreaking = changes.filter((c) => c.type === "non-breaking");
		const informative = changes.filter((c) => c.type === "informative");

		console.log(chalk.cyan(`\nFound ${changes.length} change(s):\n`));

		if (breaking.length > 0) {
			console.log(chalk.red.bold(`  Breaking Changes (${breaking.length}):`));
			for (const c of breaking) {
				console.log(
					chalk.red(`    ✗ ${chalk.white(`${c.path}:`)} ${c.message}`),
				);
			}
			console.log("");
		}

		if (nonBreaking.length > 0) {
			console.log(
				chalk.yellow.bold(`  Non-Breaking Changes (${nonBreaking.length}):`),
			);
			for (const c of nonBreaking) {
				console.log(
					chalk.yellow(`    ⚠ ${chalk.white(`${c.path}:`)} ${c.message}`),
				);
			}
			console.log("");
		}

		if (informative.length > 0) {
			console.log(chalk.blue.bold(`  Informative (${informative.length}):`));
			for (const c of informative) {
				console.log(
					chalk.blue(`    ℹ ${chalk.white(`${c.path}:`)} ${c.message}`),
				);
			}
			console.log("");
		}

		if (breaking.length > 0) {
			console.log(
				chalk.red(
					`✗ FAILED: ${breaking.length} breaking change(s) detected!\n`,
				),
			);
		} else {
			console.log(chalk.green(`✓ SUCCESS: No breaking changes detected.\n`));
		}
	}

	function printResults(results: ValidationResult[], strict: boolean) {
		const passed = results.filter((r) => r.passed);
		const failed = results.filter((r) => !r.passed && r.severity === "error");
		const warnings = results.filter(
			(r) => !r.passed && r.severity === "warning",
		);
		const suggestions = results.filter(
			(r) => !r.passed && r.severity === "suggestion",
		);

		console.log("");
		for (const r of results) {
			if (r.passed) {
				console.log(chalk.green(`  ✓ ${r.message}`));
			} else if (r.severity === "error") {
				console.log(chalk.red(`  ✗ ${r.message}`));
			} else if (r.severity === "warning") {
				console.log(chalk.yellow(`  ⚠ ${r.message}`));
			} else {
				console.log(chalk.blue(`  ℹ ${r.message}`));
			}
			if (r.details && !r.passed) {
				console.log(chalk.gray(`    → ${r.details}`));
			}
		}

		const total = results.length;
		const passCount = passed.length;
		console.log("");

		if (failed.length === 0 && (!strict || warnings.length === 0)) {
			console.log(
				chalk.green(`✓ Validation passed: ${passCount}/${total} checks passed`),
			);
		} else {
			console.log(
				chalk.red(`✗ Validation failed: ${passCount}/${total} checks passed`),
			);
		}

		if (failed.length > 0)
			console.log(chalk.red(`  ${failed.length} error(s)`));
		if (warnings.length > 0)
			console.log(chalk.yellow(`  ${warnings.length} warning(s)`));
		if (suggestions.length > 0)
			console.log(chalk.blue(`  ${suggestions.length} suggestion(s)`));
		console.log("");
	}

	// =====================================================
	// RULES REGISTRY
	// =====================================================
	program
		.command("rules [id]")
		.description("List and explore the 130-point validation checklist")
		.option("--category <name>", "Filter rules by category")
		.action((id: string | undefined, options: Record<string, unknown>) => {
			if (id) {
				const info = getRuleExtendedInfo(id);
				if (info) {
					console.log(`\n${info}\n`);
				} else {
					console.error(chalk.red(`\n✗ Rule not found: ${id}\n`));
					process.exit(1);
				}
				return;
			}

			const categories = [
				"Structure",
				"Paths",
				"Operations",
				"Request",
				"Response",
				"Security",
				"Documentation",
			];
			const filterCat = options.category;

			console.log(chalk.cyan(`\nOpenAPI 130-Point Checklist:\n`));

			for (const cat of categories) {
				if (
					filterCat &&
					cat.toLowerCase() !== (filterCat as string).toLowerCase()
				)
					continue;

				const rules = getRulesByCategory(cat);
				console.log(chalk.white.bold(`  ${cat} (${rules.length} checks)`));

				for (const rule of rules) {
					const symbol = rule.isAutomated
						? chalk.green("✅")
						: chalk.blue("👁 ");
					const sevColor =
						rule.severity === "error"
							? chalk.red
							: rule.severity === "warning"
								? chalk.yellow
								: chalk.blue;
					console.log(
						`    ${symbol} ${chalk.gray(rule.id.padEnd(6))} ${rule.title.padEnd(45)} ${sevColor(`(${rule.severity as string})`)}`,
					);
				}
				console.log("");
			}

			if (!id) {
				console.log(
					chalk.gray(
						`Use 'swagger-sentinel rules <ID>' to see full descriptions.\n`,
					),
				);
			}
		});

	// =====================================================
	// SPECTRAL EXPORT
	// =====================================================
	program
		.command("export-spectral")
		.description("Export automated rules as a Spectral YAML ruleset")
		.action(async () => {
			const { generateSpectralRuleset } = await import("./rules/spectral.js");
			console.log(generateSpectralRuleset());
		});

	return program.parseAsync(args);
}

// Execute if run via CLI
const isMain =
	process.argv[1] &&
	(process.argv[1].endsWith("cli.js") ||
		process.argv[1].endsWith("cli.ts") ||
		process.argv[1].includes(".bin"));

if (isMain) {
	run().catch((err) => {
		console.error(chalk.red("Fatal error:"), err);
		process.exit(1);
	});
}
