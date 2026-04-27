#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import {
	type BreakingChangeReport,
	detectBreakingChanges,
} from "./comparator/index.js";
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
	// ENRICH (AI)
	// =====================================================
	program
		.command("enrich <specFile>")
		.description(
			"Use AI to automatically fill missing summaries and descriptions",
		)
		.option(
			"--provider <provider>",
			"LLM Provider to use (gemini or openai)",
			"gemini",
		)
		.option("--lang <lang>", "Language for generated docs (e.g. en, tr)", "en")
		.option("--write", "Write changes back to the file")
		.action(async (specFile: string, options: Record<string, unknown>) => {
			try {
				const provider = options.provider as "gemini" | "openai";
				const lang = options.lang as string;
				const apiKey =
					provider === "gemini"
						? process.env.GEMINI_API_KEY
						: process.env.OPENAI_API_KEY;

				if (!apiKey) {
					console.error(
						chalk.red(
							`\n✗ Error: Missing API key. Please set ${provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} environment variable.\n`,
						),
					);
					process.exit(1);
				}

				console.log(
					chalk.cyan(`\n✨ Analyzing ${specFile} for missing documentation...`),
				);
				const spec = await loadSpec(specFile);

				const { enrichSpec } = await import("./enricher/index.js");

				console.log(
					chalk.gray(
						`   Calling ${provider} API to generate descriptions (Language: ${lang})...`,
					),
				);
				const result = await enrichSpec(spec, { provider, apiKey, lang });

				if (result.enrichedCount === 0) {
					console.log(
						chalk.green(
							`\n✓ No missing documentation found. Your spec is fully documented!\n`,
						),
					);
					return;
				}

				console.log(chalk.white(`\nGenerated Improvements:\n`));
				for (const item of result.items) {
					console.log(chalk.cyan(`  ● ${item.path}`));
					if (item.summary) {
						console.log(
							chalk.gray(`    Summary: `) + chalk.white(item.summary),
						);
					}
					if (item.description) {
						console.log(
							chalk.gray(`    Description: `) + chalk.white(item.description),
						);
					}
					console.log("");
				}

				if (options.write) {
					const yaml = await import("js-yaml");
					fs.writeFileSync(specFile, yaml.dump(result.spec), "utf-8");
					console.log(
						chalk.green(
							`\n✓ Successfully enriched and updated ${result.enrichedCount} field(s) in ${specFile}\n`,
						),
					);
				} else {
					console.log(
						chalk.yellow(
							`\n⚠ Found and generated ${result.enrichedCount} missing field(s).`,
						),
					);
					console.log(
						chalk.gray(
							`  Run with --write flag to save these changes to the file.\n`,
						),
					);
				}
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
	// BREAKING CHANGE DETECTOR
	// =====================================================
	program
		.command("breaking <oldSpec> <newSpec>")
		.alias("diff")
		.description("Detect breaking changes between two OpenAPI specs")
		.option("--format <format>", "Output format: text, json", "text")
		.option(
			"--summary <path>",
			"Save a Markdown summary of breaking analysis to a file",
		)
		.option(
			"--version-label <value>",
			"Version label rendered in summary branding",
			pkg.version,
		)
		.option(
			"--no-version-badge",
			"Do not render the version badge in summary branding",
		)
		.option(
			"--risk-breaking-weight <number>",
			"Risk score weight for each breaking change",
		)
		.option(
			"--risk-non-breaking-weight <number>",
			"Risk score weight for each non-breaking change",
		)
		.option(
			"--risk-informative-weight <number>",
			"Risk score weight for each informative change",
		)
		.option(
			"--risk-high-threshold <number>",
			"Minimum score for HIGH risk level",
		)
		.option(
			"--risk-medium-threshold <number>",
			"Minimum score for MEDIUM risk level",
		)
		.option(
			"--fail-on <level>",
			"Exit with error on: breaking, any, none",
			"breaking",
		)
		.action(
			async (
				oldSpecFile: string,
				newSpecFile: string,
				options: Record<string, unknown>,
			) => {
				try {
					const failOn = normalizeFailOnLevel(options.failOn);
					const riskConfig = parseRiskScoreConfig(options);
					const oldSpec = await loadSpec(oldSpecFile);
					const newSpec = await loadSpec(newSpecFile);
					const report = detectBreakingChanges(oldSpec, newSpec);
					const risk = calculateRiskScore(report, riskConfig);

					if (options.format === "json") {
						console.log(JSON.stringify({ ...report, risk }, null, 2));
					} else {
						printDiffResults(report, risk);
					}

					if (options.summary) {
						const branding: SummaryBrandingOptions = {
							includeVersionBadge: options.versionBadge !== false,
							versionLabel: String(options.versionLabel ?? pkg.version),
							outputPath: String(options.summary),
						};
						const summaryMd = generateBreakingSummary(
							report,
							risk,
							oldSpecFile,
							newSpecFile,
							branding,
						);
						fs.writeFileSync(options.summary as string, summaryMd, "utf-8");
						console.log(chalk.cyan(`\n📊 Summary saved to ${options.summary}`));
					}

					process.exit(shouldFail(report, failOn) ? 1 : 0);
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
	type RiskLevel = "low" | "medium" | "high";

	interface RiskScoreConfig {
		breakingWeight: number;
		nonBreakingWeight: number;
		informativeWeight: number;
		highThreshold: number;
		mediumThreshold: number;
	}

	interface RiskScoreResult {
		score: number;
		level: RiskLevel;
		config: RiskScoreConfig;
	}

	interface SummaryBrandingOptions {
		includeVersionBadge: boolean;
		versionLabel: string;
		outputPath?: string;
	}

	const defaultRiskScoreConfig: RiskScoreConfig = {
		breakingWeight: 10,
		nonBreakingWeight: 3,
		informativeWeight: 1,
		highThreshold: 15,
		mediumThreshold: 6,
	};

	function printDiffResults(
		report: BreakingChangeReport,
		risk: RiskScoreResult,
	) {
		const changes = report.changes;
		if (changes.length === 0) {
			console.log(chalk.green("\n✓ No changes detected between specs\n"));
			return;
		}

		const breaking = report.breakingChanges;
		const nonBreaking = report.nonBreakingChanges;
		const informative = report.informativeChanges;

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

		console.log(
			chalk.white(
				`Recommended version bump: ${report.recommendedVersionBump.toUpperCase()}\n`,
			),
		);

		console.log(
			chalk.white(`Risk score: ${risk.score} (${risk.level.toUpperCase()})\n`),
		);
	}

	type FailOnLevel = "breaking" | "any" | "none";

	function normalizeFailOnLevel(level: unknown): FailOnLevel {
		if (level === "breaking" || level === "any" || level === "none") {
			return level;
		}
		throw new Error(
			`Invalid --fail-on value: ${String(level)} (expected: breaking, any, none)`,
		);
	}

	function shouldFail(
		report: BreakingChangeReport,
		level: FailOnLevel,
	): boolean {
		if (level === "none") return false;
		if (level === "any") return report.changes.length > 0;
		return report.hasBreakingChanges;
	}

	function parseRiskScoreConfig(
		options: Record<string, unknown>,
	): RiskScoreConfig {
		const config: RiskScoreConfig = {
			breakingWeight: parseOptionalNumber(
				options.riskBreakingWeight,
				"--risk-breaking-weight",
				defaultRiskScoreConfig.breakingWeight,
			),
			nonBreakingWeight: parseOptionalNumber(
				options.riskNonBreakingWeight,
				"--risk-non-breaking-weight",
				defaultRiskScoreConfig.nonBreakingWeight,
			),
			informativeWeight: parseOptionalNumber(
				options.riskInformativeWeight,
				"--risk-informative-weight",
				defaultRiskScoreConfig.informativeWeight,
			),
			highThreshold: parseOptionalNumber(
				options.riskHighThreshold,
				"--risk-high-threshold",
				defaultRiskScoreConfig.highThreshold,
			),
			mediumThreshold: parseOptionalNumber(
				options.riskMediumThreshold,
				"--risk-medium-threshold",
				defaultRiskScoreConfig.mediumThreshold,
			),
		};

		if (config.mediumThreshold > config.highThreshold) {
			throw new Error(
				"Invalid risk thresholds: --risk-medium-threshold must be <= --risk-high-threshold",
			);
		}

		return config;
	}

	function parseOptionalNumber(
		value: unknown,
		optionName: string,
		fallback: number,
	): number {
		if (value === undefined) return fallback;

		const parsed = Number(value);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error(
				`Invalid ${optionName} value: ${String(value)} (must be a non-negative number)`,
			);
		}

		return parsed;
	}

	function calculateRiskScore(
		report: BreakingChangeReport,
		config: RiskScoreConfig,
	): RiskScoreResult {
		const score =
			report.breakingChanges.length * config.breakingWeight +
			report.nonBreakingChanges.length * config.nonBreakingWeight +
			report.informativeChanges.length * config.informativeWeight;

		const level: RiskLevel =
			score >= config.highThreshold
				? "high"
				: score >= config.mediumThreshold
					? "medium"
					: "low";

		return {
			score,
			level,
			config,
		};
	}

	function generateBreakingSummary(
		report: BreakingChangeReport,
		risk: RiskScoreResult,
		oldSpecFile: string,
		newSpecFile: string,
		branding: SummaryBrandingOptions,
	): string {
		const lines: string[] = [];
		const generatedAt = new Date().toISOString();
		const recommendedBump = report.recommendedVersionBump.toUpperCase();
		const riskLevel = risk.level.toUpperCase();

		const breakingTotal = report.breakingChanges.length;
		const nonBreakingTotal = report.nonBreakingChanges.length;
		const informativeTotal = report.informativeChanges.length;
		const riskGauge = buildRiskGauge(risk.score, risk.config);
		const riskBadge = buildBadge(
			"Risk",
			riskLevel,
			getRiskBadgeColor(risk.level),
		);
		const releaseDecision =
			breakingTotal > 0
				? "BLOCKED"
				: report.changes.length > 0
					? "REVIEW"
					: "READY";
		const releaseBadge = buildBadge(
			"Release",
			releaseDecision,
			getReleaseBadgeColor(releaseDecision),
		);
		const logoPath = buildSummaryLogoPath(branding.outputPath);

		const assessment =
			breakingTotal > 0
				? "Breaking changes detected. A MAJOR version bump is recommended before release."
				: report.changes.length > 0
					? "No breaking change detected. Review additive and informative changes before release."
					: "No contract change detected between the compared specs.";

		const releaseRationale =
			releaseDecision === "BLOCKED"
				? "Breaking changes were detected. Release should be blocked until migration plan and version bump are approved."
				: releaseDecision === "REVIEW"
					? "No breaking changes detected, but API changes exist. Release should proceed after change review."
					: "No API contract changes detected. Release can proceed without API-related blockers.";

		const escapeTableCell = (value: string) => value.replaceAll("|", "\\|");

		lines.push(
			`<p align="center"><img src="${logoPath}" width="140" alt="Swagger Sentinel Logo" /></p>`,
		);
		if (branding.includeVersionBadge) {
			lines.push("");
			lines.push(
				`![Version](https://img.shields.io/badge/Version-${encodeURIComponent(branding.versionLabel)}-0A7A3F)`,
			);
		}

		lines.push("");
		lines.push("## Swagger Sentinel Breaking Change Summary");
		lines.push("");
		lines.push("### Executive Summary");
		lines.push("");
		lines.push(assessment);
		lines.push("");
		lines.push("### Release Decision");
		lines.push("");
		lines.push("| Item | Value |");
		lines.push("|---|---|");
		lines.push(`| Release Status | ${releaseBadge} |`);
		lines.push(`| Risk Status | ${riskBadge} |`);
		lines.push(`| Recommended Version Bump | ${recommendedBump} |`);
		lines.push(`| Decision Rationale | ${releaseRationale} |`);
		lines.push("");
		lines.push("### Context");
		lines.push("");
		lines.push(`- Generated At: ${generatedAt}`);
		lines.push(`- Old Spec: ${oldSpecFile}`);
		lines.push(`- New Spec: ${newSpecFile}`);
		lines.push("");
		lines.push("### Metrics");
		lines.push("");
		lines.push("| Metric | Value |");
		lines.push("|---|---:|");
		lines.push(`| Total Changes | ${report.changes.length} |`);
		lines.push(`| Breaking Changes | ${breakingTotal} |`);
		lines.push(`| Non-Breaking Changes | ${nonBreakingTotal} |`);
		lines.push(`| Informative Changes | ${informativeTotal} |`);
		lines.push(`| Recommended Version Bump | ${recommendedBump} |`);
		lines.push(`| Risk Score | ${risk.score} |`);
		lines.push(`| Risk Level | ${riskLevel} (${riskBadge}) |`);
		lines.push(`| Risk Gauge | ${riskGauge} |`);
		lines.push("");
		lines.push("### Visual Snapshot");
		lines.push("");
		lines.push("```mermaid");
		lines.push("pie showData");
		lines.push("  title Change Distribution");
		lines.push(`  "Breaking" : ${breakingTotal}`);
		lines.push(`  "Non-Breaking" : ${nonBreakingTotal}`);
		lines.push(`  "Informative" : ${informativeTotal}`);
		lines.push("```");
		lines.push("");
		lines.push("### Risk Configuration");
		lines.push("");
		lines.push("| Parameter | Value |");
		lines.push("|---|---:|");
		lines.push(`| breakingWeight | ${risk.config.breakingWeight} |`);
		lines.push(`| nonBreakingWeight | ${risk.config.nonBreakingWeight} |`);
		lines.push(`| informativeWeight | ${risk.config.informativeWeight} |`);
		lines.push(`| mediumThreshold | ${risk.config.mediumThreshold} |`);
		lines.push(`| highThreshold | ${risk.config.highThreshold} |`);
		lines.push("");

		if (breakingTotal > 0) {
			lines.push("### Breaking Changes");
			lines.push("");
			lines.push("| # | Scope | Detail |");
			lines.push("|---:|---|---|");
			report.breakingChanges.forEach((change, idx) => {
				lines.push(
					`| ${idx + 1} | ${escapeTableCell(change.path)} | ${escapeTableCell(change.message)} |`,
				);
			});
			lines.push("");
		}

		if (nonBreakingTotal > 0) {
			lines.push("### Non-Breaking Changes");
			lines.push("");
			lines.push("| # | Scope | Detail |");
			lines.push("|---:|---|---|");
			report.nonBreakingChanges.forEach((change, idx) => {
				lines.push(
					`| ${idx + 1} | ${escapeTableCell(change.path)} | ${escapeTableCell(change.message)} |`,
				);
			});
			lines.push("");
		}

		if (informativeTotal > 0) {
			lines.push("### Informative Changes");
			lines.push("");
			lines.push("| # | Scope | Detail |");
			lines.push("|---:|---|---|");
			report.informativeChanges.forEach((change, idx) => {
				lines.push(
					`| ${idx + 1} | ${escapeTableCell(change.path)} | ${escapeTableCell(change.message)} |`,
				);
			});
			lines.push("");
		}

		lines.push("### Recommended Actions");
		lines.push("");
		if (breakingTotal > 0) {
			lines.push(
				"- Apply a MAJOR version bump before release and communicate migration notes.",
			);
			lines.push(
				"- Review client impact for removed paths/methods and required request changes.",
			);
		}
		if (nonBreakingTotal > 0) {
			lines.push(
				"- Verify additive endpoints and fields are reflected in client SDK and docs.",
			);
		}
		if (informativeTotal > 0) {
			lines.push(
				"- Confirm operationId/documentation updates are aligned with tooling expectations.",
			);
		}
		if (report.changes.length === 0) {
			lines.push("- No action required. Contract is unchanged.");
		}
		lines.push("");

		return lines.join("\n");
	}

	function buildRiskGauge(score: number, config: RiskScoreConfig): string {
		const size = 18;
		const safeHighThreshold = Math.max(1, config.highThreshold);
		const ratioToHigh = score / safeHighThreshold;
		const clampedRatio = Math.min(1, ratioToHigh);
		const filled = Math.round(clampedRatio * size);
		const level =
			score >= config.highThreshold
				? "HIGH"
				: score >= config.mediumThreshold
					? "MED"
					: "LOW";
		const percentOfHigh = Math.round(ratioToHigh * 100);

		return `${level} [${"#".repeat(filled)}${"-".repeat(size - filled)}] ${percentOfHigh}% of HIGH threshold`;
	}

	function buildBadge(label: string, message: string, color: string): string {
		const encodedLabel = encodeURIComponent(label);
		const encodedMessage = encodeURIComponent(message);
		const encodedColor = encodeURIComponent(color);
		return `![${label} ${message}](https://img.shields.io/badge/${encodedLabel}-${encodedMessage}-${encodedColor})`;
	}

	function getRiskBadgeColor(level: RiskLevel): string {
		if (level === "high") return "red";
		if (level === "medium") return "orange";
		return "brightgreen";
	}

	function getReleaseBadgeColor(
		decision: "BLOCKED" | "REVIEW" | "READY",
	): string {
		if (decision === "BLOCKED") return "red";
		if (decision === "REVIEW") return "yellow";
		return "brightgreen";
	}

	function buildSummaryLogoPath(outputPath?: string): string {
		if (!outputPath) return "assets/logo-versioned.png";

		const outputDir = path.dirname(path.resolve(outputPath));
		const logoAbsolutePath = path.resolve(
			process.cwd(),
			"assets/logo-versioned.png",
		);
		const relativePath = path.relative(outputDir, logoAbsolutePath);
		return relativePath.replaceAll("\\", "/");
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
