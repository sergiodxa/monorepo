import { isFailure, unwrap } from "@sdxc/result";
import * as ds from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

/**
 * Tests for the combinators: the keywords each emits, how presence shapes `required`,
 * naming and recursion through `$defs`, both sides of a transform, and validation that
 * matches the `remix/data-schema` counterpart value for value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONSchema } from "./types.js";

import * as checks from "./checks.js";
import { toJSONSchema } from "./convert.js";

import * as s from "./index.js";

/** The document for a schema's input side, without the `$schema` every document declares. */
function jsonOf(schema: s.Schema<any, any>, options?: s.ToJSONSchemaOptions): JSONSchema {
	let { $schema: _, ...json } = unwrap(toJSONSchema(schema, options));
	return json;
}

describe("scalar combinators", () => {
	test("each emits its type", () => {
		expect(jsonOf(s.string())).toEqual({ type: "string" });
		expect(jsonOf(s.number())).toEqual({ type: "number" });
		expect(jsonOf(s.integer())).toEqual({ type: "integer" });
		expect(jsonOf(s.boolean())).toEqual({ type: "boolean" });
		expect(jsonOf(s.null_())).toEqual({ type: "null" });
		expect(jsonOf(s.any())).toEqual({});
	});

	test("literal emits const and enum_ emits enum, both with their type", () => {
		expect(jsonOf(s.literal("http"))).toEqual({ type: "string", const: "http" });
		expect(jsonOf(s.literal(3))).toEqual({ type: "integer", const: 3 });
		expect(jsonOf(s.enum_(["owner", "member"]))).toEqual({
			type: "string",
			enum: ["owner", "member"],
		});
		expect(jsonOf(s.enum_(["a", 1]))).toEqual({ enum: ["a", 1] });
	});

	test("a document declares the 2020-12 meta-schema", () => {
		expect(unwrap(toJSONSchema(s.string())).$schema).toBe(
			"https://json-schema.org/draft/2020-12/schema",
		);
	});
});

describe("object", () => {
	test("keys are required unless wrapped in optional or defaulted", () => {
		let schema = s.object({
			name: s.string(),
			note: s.optional(s.string()),
			limit: s.defaulted(s.integer(), 20),
		});

		expect(jsonOf(schema)).toEqual({
			type: "object",
			properties: {
				name: { type: "string" },
				note: { type: "string" },
				limit: { type: "integer", default: 20 },
			},
			required: ["name"],
		});
	});

	test("the output side requires a defaulted key, since a parse always yields it", () => {
		let schema = s.object({ limit: s.defaulted(s.integer(), 20) });
		expect(jsonOf(schema, { direction: "output" }).required).toEqual(["limit"]);
	});

	test("unknownKeys error adds additionalProperties false", () => {
		let schema = s.object({ name: s.string() }, { unknownKeys: "error" });
		expect(jsonOf(schema).additionalProperties).toBe(false);
	});

	test("an object with every key optional has no required list", () => {
		expect(jsonOf(s.object({ a: s.optional(s.string()) }))).not.toHaveProperty("required");
	});

	test("optional keys are optional in the inferred types", () => {
		let schema = s.object({ name: s.string(), note: s.optional(s.string()) });
		expectTypeOf<s.InferOutput<typeof schema>>().toEqualTypeOf<{
			name: string;
			note?: string | undefined;
		}>();
	});
});

describe("nullable", () => {
	test("a scalar widens its type with null", () => {
		expect(jsonOf(s.nullable(s.integer()))).toEqual({ type: ["integer", "null"] });
	});

	test("an enum or literal also lists null among its values", () => {
		expect(jsonOf(s.nullable(s.enum_(["a", "b"])))).toEqual({
			type: ["string", "null"],
			enum: ["a", "b", null],
		});
		expect(jsonOf(s.nullable(s.literal("a")))).toEqual({
			type: ["string", "null"],
			enum: ["a", null],
		});
	});

	test("an object becomes anyOf with null", () => {
		expect(jsonOf(s.nullable(s.object({ a: s.string() })))).toEqual({
			anyOf: [
				{ type: "object", properties: { a: { type: "string" } }, required: ["a"] },
				{ type: "null" },
			],
		});
	});

	test("a named schema stays a reference inside anyOf", () => {
		let named = s.object({ a: s.string() }).meta({ id: "Thing" });
		expect(jsonOf(s.nullable(named)).anyOf).toEqual([{ $ref: "#/$defs/Thing" }, { type: "null" }]);
	});

	test("nullable keeps an optional key optional", () => {
		let schema = s.object({ a: s.nullable(s.optional(s.string())) });
		expect(jsonOf(schema)).not.toHaveProperty("required");
	});
});

describe("collections", () => {
	test("array emits items", () => {
		expect(jsonOf(s.array(s.string()))).toEqual({ type: "array", items: { type: "string" } });
	});

	test("tuple emits prefixItems, closes items and fixes the length", () => {
		expect(jsonOf(s.tuple([s.number(), s.string()]))).toEqual({
			type: "array",
			prefixItems: [{ type: "number" }, { type: "string" }],
			items: false,
			minItems: 2,
			maxItems: 2,
		});
	});

	test("record emits additionalProperties, and propertyNames when the key is constrained", () => {
		expect(jsonOf(s.record(s.string(), s.integer()))).toEqual({
			type: "object",
			additionalProperties: { type: "integer" },
		});
		expect(jsonOf(s.record(s.string().pipe(checks.pattern(/^x-/)), s.string()))).toEqual({
			type: "object",
			additionalProperties: { type: "string" },
			propertyNames: { type: "string", pattern: "^x-" },
		});
	});

	test("union emits anyOf", () => {
		expect(jsonOf(s.union([s.string(), s.integer()]))).toEqual({
			anyOf: [{ type: "string" }, { type: "integer" }],
		});
	});
});

describe("variant", () => {
	test("each branch pins the discriminator and the schema declares it", () => {
		let schema = s.variant("kind", {
			http: s.object({ kind: s.literal("http"), url: s.string() }),
			dns: s.object({ host: s.string() }),
		});

		expect(jsonOf(schema)).toEqual({
			oneOf: [
				{
					type: "object",
					properties: { kind: { type: "string", const: "http" }, url: { type: "string" } },
					required: ["kind", "url"],
				},
				{
					type: "object",
					properties: { host: { type: "string" }, kind: { const: "dns" } },
					required: ["host", "kind"],
				},
			],
			discriminator: { propertyName: "kind" },
		});
	});

	test("named branches are combined through allOf and listed in the mapping", () => {
		let http = s.object({ kind: s.literal("http") }).meta({ id: "HttpCheck" });
		let json = jsonOf(s.variant("kind", { http }));

		expect(json.oneOf).toEqual([
			{
				allOf: [
					{ $ref: "#/$defs/HttpCheck" },
					{ type: "object", properties: { kind: { const: "http" } }, required: ["kind"] },
				],
			},
		]);
		expect(json.discriminator).toEqual({
			propertyName: "kind",
			mapping: { http: "#/$defs/HttpCheck" },
		});
	});
});

describe("naming and recursion", () => {
	test("meta with an id hoists the schema into $defs", () => {
		let monitor = s.object({ name: s.string() }).meta({ id: "Monitor", description: "A monitor" });
		let json = jsonOf(s.object({ monitor, previous: s.optional(monitor) }));

		expect(json.properties).toEqual({
			monitor: { $ref: "#/$defs/Monitor" },
			previous: { $ref: "#/$defs/Monitor" },
		});
		expect(json.$defs).toEqual({
			Monitor: {
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				description: "A monitor",
			},
		});
	});

	test("refs inline writes named schemas in place", () => {
		let monitor = s.object({ name: s.string() }).meta({ id: "Monitor" });
		let json = jsonOf(s.object({ monitor }), { refs: "inline" });

		expect(json.properties?.monitor).toEqual({
			type: "object",
			properties: { name: { type: "string" } },
			required: ["name"],
		});
		expect(json).not.toHaveProperty("$defs");
	});

	test("two different schemas under one name fail", () => {
		let a = s.string().meta({ id: "Thing" });
		let b = s.integer().meta({ id: "Thing" });
		let result = toJSONSchema(s.object({ a, b }));

		expect(isFailure(result) && result.error.message).toBe(
			'Two different schemas are named "Thing"',
		);
	});

	test("lazy recursion terminates through $defs, in either refs mode", () => {
		interface Category {
			name: string;
			children: Category[];
		}
		let category: s.Schema<unknown, Category> = s.lazy(
			() => s.object({ name: s.string(), children: s.array(category) }),
			{ id: "Category" },
		);
		let expected = {
			$ref: "#/$defs/Category",
			$defs: {
				Category: {
					type: "object",
					properties: {
						name: { type: "string" },
						children: { type: "array", items: { $ref: "#/$defs/Category" } },
					},
					required: ["name", "children"],
				},
			},
		};

		expect(jsonOf(category)).toEqual(expected);
		expect(jsonOf(category, { refs: "inline" })).toEqual(expected);
		expect(s.parse(category, { name: "a", children: [{ name: "b", children: [] }] })).toEqual({
			name: "a",
			children: [{ name: "b", children: [] }],
		});
	});
});

describe("chain methods", () => {
	test("pipe adds each check's keywords, and length checks on arrays count items", () => {
		expect(jsonOf(s.string().pipe(checks.minLength(1), checks.maxLength(255)))).toEqual({
			type: "string",
			minLength: 1,
			maxLength: 255,
		});
		expect(jsonOf(s.array(s.string()).pipe(checks.minLength(1)))).toEqual({
			type: "array",
			items: { type: "string" },
			minItems: 1,
		});
	});

	test("refine keeps the description and meta annotates it", () => {
		let schema = s
			.string()
			.refine((value) => value.startsWith("mon_"))
			.meta({ pattern: "^mon_", examples: ["mon_1"] });

		expect(jsonOf(schema)).toEqual({ type: "string", pattern: "^mon_", examples: ["mon_1"] });
		expect(s.parseSafe(schema, "dns_1").success).toBe(false);
	});

	test("transform keeps the input side and describes the output with its schema, or {}", () => {
		let decoded = s.string().pipe(checks.pattern(/^\d+$/)).transform(Number, s.integer());
		let opaque = s.string().transform(Number);

		expect(jsonOf(decoded)).toEqual({ type: "string", pattern: "^\\d+$" });
		expect(jsonOf(decoded, { direction: "output" })).toEqual({ type: "integer" });
		expect(jsonOf(opaque, { direction: "output" })).toEqual({});
	});

	test("a check after a transform documents the output side only", () => {
		let schema = s.string().transform(Number, s.number()).pipe(checks.min(1));

		expect(jsonOf(schema)).toEqual({ type: "string" });
		expect(jsonOf(schema, { direction: "output" })).toEqual({ type: "number", minimum: 1 });
	});

	test("a plain data-schema check validates without documenting", () => {
		let schema = s.string().pipe({ check: (value) => value.length > 0, message: "Empty" });
		expect(jsonOf(schema)).toEqual({ type: "string" });
		expect(s.parseSafe(schema, "").success).toBe(false);
	});
});

describe("schemas that cannot describe themselves", () => {
	test("a nested plain data-schema schema fails naming its path", () => {
		let schema = s.object({
			address: s.object({ city: ds.string() as unknown as s.Schema<string> }),
		});
		let result = toJSONSchema(schema);

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.path).toEqual(["properties", "address", "properties", "city"]);
		expect(result.error.message).toBe(
			'The schema at "/properties/address/properties/city" cannot describe itself as JSON Schema',
		);
	});

	test("a foreign Standard JSON Schema is inlined and its $defs lifted", () => {
		let foreign = {
			"~standard": {
				version: 1 as const,
				vendor: "other",
				validate: (value: unknown) => ({ value }),
				jsonSchema: {
					input: () => ({
						$schema: "https://json-schema.org/draft/2020-12/schema",
						$ref: "#/$defs/Foreign",
						$defs: { Foreign: { type: "string" } },
					}),
					output: () => ({ type: "string" }),
				},
			},
		};
		let json = unwrap(toJSONSchema(foreign));

		expect(json).toEqual({
			$schema: "https://json-schema.org/draft/2020-12/schema",
			$ref: "#/$defs/Foreign",
			$defs: { Foreign: { type: "string" } },
		});
	});

	test("a data-schema schema carrying its own converter nests, validates and describes", () => {
		let base = ds.array(ds.string());
		let tags = {
			...base,
			"~standard": {
				...base["~standard"],
				jsonSchema: {
					input: () => ({ type: "array", items: { type: "string" } }),
					output: () => ({ type: "array", items: { type: "string" } }),
				},
			},
		};
		let schema = s.object({ tags });

		expect(unwrap(toJSONSchema(schema)).properties).toEqual({
			tags: { type: "array", items: { type: "string" } },
		});
		expect(s.parseSafe(schema, { tags: [1] }).success).toBe(false);
	});

	test("a foreign converter that throws becomes a failure carrying the cause", () => {
		let cause = new Error("unsupported refinement");
		let foreign = {
			"~standard": {
				version: 1 as const,
				vendor: "other",
				jsonSchema: {
					input: () => {
						throw cause;
					},
					output: () => ({}),
				},
			},
		};
		let result = toJSONSchema(foreign);

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.cause).toBe(cause);
		expect(result.error.message).toContain("unsupported refinement");
	});
});

describe("Standard JSON Schema", () => {
	test("every schema exposes the converter, which returns the standalone document", () => {
		let schema = s.object({ name: s.string() });
		expect(schema["~standard"].jsonSchema.input({ target: "draft-2020-12" })).toEqual(
			unwrap(toJSONSchema(schema)),
		);
	});

	test("the converter refuses a target other than 2020-12, as the interface prescribes", () => {
		expect(() => s.string()["~standard"].jsonSchema.input({ target: "draft-07" })).toThrow(
			'Unsupported JSON Schema target "draft-07"',
		);
	});

	test("a schema from this package nests inside a plain data-schema schema", () => {
		let schema = ds.object({ name: s.string().pipe(checks.minLength(1)) });
		expect(ds.parseSafe(schema, { name: "" }).success).toBe(false);
		expect(ds.parse(schema, { name: "a" })).toEqual({ name: "a" });
	});
});
