/**
 * Tests for the boundary functions: checks and coercions documenting themselves,
 * `withJSONSchema` pairing a plain data-schema schema with hand-written JSON Schema,
 * and `toJSONSchema` options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import * as ds from "remix/data-schema";
import { describe, expect, test } from "vitest";

import * as checks from "./checks.js";
import * as coerce from "./coerce.js";

import * as s from "./index.js";

describe("checks", () => {
	test("each carries the keyword that documents it", () => {
		expect(checks.minLength(1).keywords).toEqual({ minLength: 1 });
		expect(checks.maxLength(2).keywords).toEqual({ maxLength: 2 });
		expect(checks.min(3).keywords).toEqual({ minimum: 3 });
		expect(checks.max(4).keywords).toEqual({ maximum: 4 });
		expect(checks.email().keywords).toEqual({ format: "email" });
		expect(checks.url().keywords).toEqual({ format: "uri" });
		expect(checks.pattern(/^mon_/).keywords).toEqual({ pattern: "^mon_" });
		expect(checks.minItems(1).keywords).toEqual({ minItems: 1 });
		expect(checks.maxItems(9).keywords).toEqual({ maxItems: 9 });
	});
});

describe("coerce", () => {
	test("the input side accepts text or the target type; the output side is the target", () => {
		let schema = s.object({ limit: coerce.number(), since: s.optional(coerce.date()) });

		expect(unwrap(s.toJSONSchema(schema)).properties).toEqual({
			limit: { type: ["number", "string"] },
			since: { type: "string", format: "date-time" },
		});
		expect(unwrap(s.toJSONSchema(schema, { direction: "output" })).properties).toEqual({
			limit: { type: "number" },
			since: { type: "string", format: "date-time" },
		});
	});

	test("boolean, bigint and string document their accepted inputs", () => {
		let describe = (schema: s.Schema<unknown, unknown>) => {
			let { $schema: _, ...json } = unwrap(s.toJSONSchema(schema));
			return json;
		};
		expect(describe(coerce.boolean())).toEqual({ type: ["boolean", "string"] });
		expect(describe(coerce.bigint())).toEqual({ type: ["integer", "string"] });
		expect(describe(coerce.string())).toEqual({ type: ["string", "number", "boolean"] });
	});
});

describe("withJSONSchema", () => {
	test("one JSON Schema describes both sides", () => {
		let slug = s.withJSONSchema(
			ds.string().refine((value) => /^[a-z-]+$/.test(value)),
			{ type: "string", pattern: "^[a-z-]+$" },
		);

		expect(unwrap(s.toJSONSchema(s.object({ slug }))).properties).toEqual({
			slug: { type: "string", pattern: "^[a-z-]+$" },
		});
		expect(s.parseSafe(slug, "Nope").success).toBe(false);
	});

	test("input and output describe each side of a transform", () => {
		let schema = s.withJSONSchema(ds.string().transform(Number), {
			input: { type: "string" },
			output: { type: "number" },
		});

		expect(unwrap(s.toJSONSchema(schema, { direction: "output" })).type).toBe("number");
		expect(s.parse(schema, "2")).toBe(2);
	});

	test("the result chains like any other schema", () => {
		let schema = s.withJSONSchema(ds.string(), { type: "string" }).pipe(checks.minLength(1));
		let { $schema: _, ...json } = unwrap(s.toJSONSchema(schema));
		expect(json).toEqual({ type: "string", minLength: 1 });
	});
});
