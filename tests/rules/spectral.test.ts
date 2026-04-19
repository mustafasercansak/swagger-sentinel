import { describe, it, expect } from "vitest";
import { generateSpectralRuleset } from "../../src/rules/spectral.js";

describe("spectral.ts", () => {
	it("should generate a valid YAML string", () => {
		const yaml = generateSpectralRuleset();
		expect(yaml).toContain("rules:");
		expect(yaml).toContain("sentinel-");
		// Check that it includes at least one specific mapping
		expect(yaml).toContain("schemaId: \"S01\"");
		expect(yaml).toContain("field: contact");
	});

	it("should handle rules without specific mappings using placeholders", () => {
		const yaml = generateSpectralRuleset();
		// Find a rule that definitely doesn't have a mapping (e.g., S03 if it exists and is automated)
		// Or just check for the placeholder string
		expect(yaml).toContain("function: truthy");
		expect(yaml).toContain("given: \"$.info\" # Complex JS rule coverage placeholder");
	});
});
