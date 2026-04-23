import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { SentinelConfig } from "../types.js";

const CONFIG_FILES = [
	".sentinelrc",
	".sentinelrc.json",
	".sentinelrc.yaml",
	".sentinelrc.yml",
	"swagger-sentinel.config.json",
];

/**
 * Load configuration from the current working directory.
 */
export function loadConfig(cwd: string = process.cwd()): SentinelConfig {
	let config: SentinelConfig = {};

	// 1. Search for standalone config files
	for (const file of CONFIG_FILES) {
		const filePath = path.join(cwd, file);
		if (fs.existsSync(filePath)) {
			try {
				const content = fs.readFileSync(filePath, "utf8");
				if (file.endsWith(".yaml") || file.endsWith(".yml")) {
					config = yaml.load(content) as SentinelConfig;
				} else {
					config = JSON.parse(content);
				}
				break; // Stop at first found config
			} catch (_err) {
				console.warn(`Warning: Failed to parse config file ${file}`);
			}
		}
	}

	// 2. Fallback to package.json if no sentinelrc found
	if (Object.keys(config).length === 0) {
		const pkgPath = path.join(cwd, "package.json");
		if (fs.existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
				if (pkg["swagger-sentinel"]) {
					config = pkg["swagger-sentinel"];
				}
			} catch (_err) {
				// ignore
			}
		}
	}

	return config;
}
