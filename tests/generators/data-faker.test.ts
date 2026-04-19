import { describe, expect, it } from "vitest";
import {
	generateFakeObject,
	getFakerCall,
} from "../../src/generators/data-faker.js";
import type { OpenAPISpec } from "../../src/types.js";

describe("Data Faker Utility", () => {
	describe("getFakerCall", () => {
		it("should support x-faker vendor extension", () => {
			const schema = { "x-faker": "internet.ipv4" };
			expect(getFakerCall("any", schema)).toBe("faker.internet.ipv4()");
		});

		it("should map semantic field names correctly", () => {
			expect(getFakerCall("email", { type: "string" })).toBe(
				"faker.internet.email()",
			);
			expect(getFakerCall("lastName", { type: "string" })).toBe(
				"faker.person.lastName()",
			);
			expect(getFakerCall("PhoneNumber", { type: "string" })).toBe(
				"faker.phone.number()",
			);
		});

		it("should map by format", () => {
			expect(getFakerCall("id", { type: "string", format: "uuid" })).toBe(
				"faker.string.uuid()",
			);
			expect(
				getFakerCall("created_at", { type: "string", format: "date-time" }),
			).toBe("faker.date.recent().toISOString()");
		});

		it("should handle enums", () => {
			const schema = { type: "string", enum: ["red", "green", "blue"] };
			expect(getFakerCall("color", schema)).toBe(
				'faker.helpers.arrayElement(["red","green","blue"])',
			);
		});

		it("should support numeric constraints", () => {
			const schema = { type: "integer", minimum: 10, maximum: 50 };
			expect(getFakerCall("age", schema)).toBe(
				"faker.number.int({ min: 10, max: 50 })",
			);
		});

		it("should support recursive arrays", () => {
			const schema = {
				type: "array",
				items: { type: "string", format: "email" },
			};
			expect(getFakerCall("emails", schema)).toBe(
				"faker.helpers.multiple(() => faker.internet.email(), { count: 3 })",
			);
		});

		it("should fallback to test-value", () => {
			expect(getFakerCall("unknown", { type: "unknown" })).toBe("'test-value'");
		});
	});

	describe("generateFakeObject", () => {
		it("should generate a full object literal", () => {
			const spec: OpenAPISpec = {
				openapi: "3.0.0",
				info: { title: "Test", version: "1.0" },
				paths: {},
			};
			const schema = {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string" },
				},
			};
			const output = generateFakeObject(schema, spec);
			expect(output).toContain("id: faker.string.uuid()");
			expect(output).toContain("name: faker.person.fullName()");
		});

		it("should handle non-objects", () => {
			expect(generateFakeObject({ type: "string" }, {} as any)).toBe("{}");
		});
	});
});
