import { RULE_REGISTRY } from "./registry.js";

/**
 * Generates a Spectral YAML ruleset for the 83 automated rules.
 * Hand-tuned mappings for the most common rules.
 */
export function generateSpectralRuleset(): string {
	const automated = RULE_REGISTRY.filter((r) => r.isAutomated);

	let yaml = `################################################################################\n`;
	yaml += `# Swagger Sentinel - Spectral Export\n`;
	yaml += `# Generated at ${new Date().toISOString()}\n`;
	yaml += `################################################################################\n\n`;
	yaml += `rules:\n`;

	for (const rule of automated) {
		yaml += `  sentinel-${rule.id.toLowerCase()}:\n`;
		yaml += `    schemaId: "${rule.id}"\n`;
		yaml += `    description: "${rule.description}"\n`;
		yaml += `    severity: ${rule.severity === "error" ? "error" : rule.severity === "warning" ? "warn" : "info"}\n`;

		// Attempt specific Spectral mappings
		const mapping = getSpectralMapping(rule.id);
		if (mapping) {
			yaml += mapping;
		} else {
			// Placeholder for complex rules
			yaml += `    given: "$.info" # Complex JS rule coverage placeholder\n`;
			yaml += `    then:\n`;
			yaml += `      function: truthy\n`;
		}
		yaml += `\n`;
	}

	return yaml;
}

function getSpectralMapping(id: string): string | null {
	const mappings: Record<string, string> = {
		S01: `    given: "$.info"
    then:
      field: contact
      function: truthy`,
		S02: `    given: "$.info.version"
    then:
      function: pattern
      functionOptions:
        match: "^([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$"`,
		S04: `    given: "$.paths"
    then:
      function: truthy`,
		P15: `    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^(/[a-z0-9-{}]+)+$"`,
		P16: `    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        notMatch: "/$"`,
		O31: `    given: "$.paths[*][*]"
    then:
      field: operationId
      function: truthy`,
		R50: `    given: "$..[?(@.type === 'string')]"
    then:
      field: maxLength
      function: truthy`,
		SEC95: `    given: "$.servers[*].url"
    then:
      function: pattern
      functionOptions:
        match: "^https://.*"`,
	};

	return mappings[id] || null;
}
