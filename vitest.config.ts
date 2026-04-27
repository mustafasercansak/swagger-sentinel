import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts", "tests/*.test.ts"],
		environment: "node",
		coverage: {
			provider: "v8",
				reporter: ["text", "json", "json-summary", "html"],
			thresholds: {
				lines: 80,
				functions: 80,
					branches: 80,
				statements: 80,
			},
				exclude: ["node_modules/", "dist/", "tests/"],
		},
	},
});
