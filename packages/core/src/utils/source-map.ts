import fs from "node:fs";

/**
 * A lightweight utility to find line numbers in YAML/JSON source files
 * based on property paths or names.
 */
export function findLineNumber(
	filePath: string,
	searchText: string,
	context?: string,
): number | undefined {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const lines = content.split("\n");

		// Strategy 1: Search for specific path (e.g., "/pets:")
		if (searchText.startsWith("/")) {
			const pathKey = searchText.endsWith(":") ? searchText : `${searchText}:`;
			const idx = lines.findIndex(
				(l) =>
					l.trim() === pathKey ||
					l.trim() === `"${searchText}":` ||
					l.trim() === `'${searchText}':`,
			);
			if (idx !== -1) return idx + 1;
		}

		// Strategy 2: Search for property with context (e.g., "get:" under "/pets:")
		if (context) {
			const contextIdx = lines.findIndex((l) => l.trim().startsWith(context));
			if (contextIdx !== -1) {
				const searchIdx = lines
					.slice(contextIdx)
					.findIndex((l) => l.trim().startsWith(searchText));
				if (searchIdx !== -1) return contextIdx + searchIdx + 1;
			}
		}

		// Strategy 3: Direct search for key
		const directIdx = lines.findIndex((l) =>
			l.trim().startsWith(`${searchText}:`),
		);
		if (directIdx !== -1) return directIdx + 1;

		return undefined;
	} catch {
		return undefined;
	}
}
