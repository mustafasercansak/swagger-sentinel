import type { OpenAPISpec } from "../types.js";

/**
 * Utility to generate Faker.js code strings based on OpenAPI schemas.
 */
export function getFakerCall(propName: string, schema: any): string {
	// 1. Check for x-faker vendor extension
	if (schema["x-faker"]) {
		return `faker.${schema["x-faker"]}()`;
	}

	// 2. Enum check (high priority)
	if (schema.enum) {
		return `faker.helpers.arrayElement(${JSON.stringify(schema.enum)})`;
	}

	// 3. Array check (recursive)
	if (schema.type === "array") {
		const itemsCall = getFakerCall(
			`${propName}Item`,
			schema.items || { type: "string" },
		);
		return `faker.helpers.multiple(() => ${itemsCall}, { count: 3 })`;
	}

	// 4. Semantic mapping by property name
	const name = propName.toLowerCase().replace(/[^a-z]/g, "");

	if (name.includes("email")) return "faker.internet.email()";
	if (name.includes("password")) return "faker.internet.password()";
	if (name.includes("username")) return "faker.internet.username()";
	if (name.includes("firstname")) return "faker.person.firstName()";
	if (name.includes("lastname")) return "faker.person.lastName()";
	if (name.includes("fullname") || name === "name")
		return "faker.person.fullName()";
	if (name.includes("phone")) return "faker.phone.number()";
	if (name.includes("address")) return "faker.location.streetAddress()";
	if (name.includes("city")) return "faker.location.city()";
	if (name.includes("country")) return "faker.location.country()";
	if (name.includes("zipcode") || name.includes("postalcode"))
		return "faker.location.zipCode()";
	if (name.includes("company")) return "faker.company.name()";
	if (name.includes("url") || name.includes("website"))
		return "faker.internet.url()";
	if (name.includes("avatar") || name.includes("image"))
		return "faker.image.avatar()";
	if (name.includes("color")) return "faker.color.human()";
	if (name.includes("price") || name.includes("amount"))
		return "faker.commerce.price()";
	if (name.includes("description")) return "faker.lorem.paragraph()";
	if (name.includes("title") || name.includes("subject"))
		return "faker.lorem.sentence()";

	// 5. Mapping by format
	if (schema.format === "uuid") return "faker.string.uuid()";
	if (schema.format === "email") return "faker.internet.email()";
	if (schema.format === "date-time") return "faker.date.recent().toISOString()";
	if (schema.format === "date")
		return "faker.date.recent().toISOString().split('T')[0]";
	if (schema.format === "ipv4") return "faker.internet.ipv4()";
	if (schema.format === "ipv6") return "faker.internet.ipv6()";
	if (schema.format === "uri") return "faker.internet.url()";

	// 6. Default by type
	switch (schema.type) {
		case "string":
			return "faker.lorem.word()";
		case "number":
		case "integer": {
			const min = schema.minimum ?? 1;
			const max = schema.maximum ?? 1000;
			return `faker.number.int({ min: ${min}, max: ${max} })`;
		}
		case "boolean":
			return "faker.datatype.boolean()";
		default:
			return "'test-value'";
	}
}

/**
 * Generate a full object literal with Faker calls.
 */
export function generateFakeObject(schema: any, spec: OpenAPISpec): string {
	if (schema.type !== "object" || !schema.properties) {
		return "{}";
	}

	const props: string[] = [];
	for (const [name, propSchema] of Object.entries(schema.properties as any)) {
		props.push(`      ${name}: ${getFakerCall(name, propSchema)}`);
	}

	return `{\n${props.join(",\n")}\n    }`;
}
