/**
 * What the definition schemas accept and refuse, operator by operator, so the
 * contract an admin UI validates a rule against is pinned down before the
 * parser builds anything from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseSafe } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	CONDITION_SCHEMA,
	FLAG_DEFINITION_SCHEMA,
	SEGMENT_SET_SCHEMA,
	SPLIT_SCHEMA,
	TARGETING_RULE_SCHEMA,
} from "./schema.js";

describe("CONDITION_SCHEMA", () => {
	/** One accepted shape per operator, so adding an operator has to land here too. */
	let accepted: unknown[] = [
		{ op: "always" },
		{ op: "exists", field: "plan.tier" },
		{ op: "eq", field: "country", value: "es" },
		{ op: "ne", field: "beta", value: true },
		{ op: "in", field: "country", values: ["es", "fr", null] },
		{ op: "notIn", field: "plan.tier", values: ["free"] },
		{ op: "lt", field: "age", value: 18 },
		{ op: "lte", field: "age", value: 18 },
		{ op: "gt", field: "seats", value: 5 },
		{ op: "gte", field: "seats", value: 5 },
		{ op: "startsWith", field: "email", value: "ada" },
		{ op: "endsWith", field: "email", value: "@example.com" },
		{ op: "contains", field: "email", value: "+tag" },
		{ op: "matches", field: "email", pattern: "^ada@" },
		{ op: "semver", field: "version", compare: "^", value: "1.2.3" },
		{ op: "segment", name: "internal" },
		{ op: "not", of: { op: "always" } },
		{ op: "all", of: [{ op: "always" }, { op: "exists", field: "email" }] },
		{ op: "any", of: [{ op: "always" }] },
	];

	for (let condition of accepted) {
		test(`reads ${JSON.stringify(condition).slice(0, 60)}`, () => {
			let result = parseSafe(CONDITION_SCHEMA, condition);

			expect(result.success).toBe(true);
			if (result.success) expect(result.value).toEqual(condition);
		});
	}

	/** Each refusal is a rule an editor can save today and the engine would not run. */
	let refused: { name: string; condition: unknown }[] = [
		{ name: "an operator nobody named", condition: { op: "regex", field: "a", value: "b" } },
		{ name: "a comparison against another type", condition: { op: "gt", field: "a", value: "2" } },
		{
			name: "a prefix test against a number",
			condition: { op: "startsWith", field: "a", value: 2 },
		},
		{ name: "a comparison that names no field", condition: { op: "eq", value: "es" } },
		{ name: "a field naming nothing at all", condition: { op: "exists", field: "" } },
		{
			name: "a structure where a scalar is compared",
			condition: { op: "eq", field: "a", value: {} },
		},
		{
			name: "a version comparison outside the eight",
			condition: { op: "semver", field: "v", compare: "≈", value: "1.0.0" },
		},
		{ name: "a branch holding no condition", condition: { op: "all", of: [{ op: "nope" }] } },
	];

	for (let { name, condition } of refused) {
		test(`refuses ${name}`, () => {
			expect(parseSafe(CONDITION_SCHEMA, condition).success).toBe(false);
		});
	}

	test("keeps the discriminant narrow enough to switch on", () => {
		let result = parseSafe(CONDITION_SCHEMA, { op: "eq", field: "country", value: "es" });

		expect(result.success).toBe(true);
		if (result.success && result.value.op === "eq") expect(result.value.field).toBe("country");
	});
});

describe("SPLIT_SCHEMA", () => {
	test("reads weights with the bucketing they are drawn from", () => {
		let split = { weights: { on: 10, off: 90 }, by: "sessionId", seed: "checkout" };

		expect(parseSafe(SPLIT_SCHEMA, split)).toEqual({ success: true, value: split });
	});

	test("reads weights that reach any total, since they are taken against their own sum", () => {
		expect(parseSafe(SPLIT_SCHEMA, { weights: { a: 1, b: 1 } }).success).toBe(true);
	});

	test("refuses a fraction of a share", () => {
		expect(parseSafe(SPLIT_SCHEMA, { weights: { a: 0.5, b: 0.5 } }).success).toBe(false);
	});

	test("refuses a negative share", () => {
		expect(parseSafe(SPLIT_SCHEMA, { weights: { a: -1, b: 2 } }).success).toBe(false);
	});

	test("refuses weights that would leave every arm unreachable", () => {
		expect(parseSafe(SPLIT_SCHEMA, { weights: { a: 0, b: 0 } }).success).toBe(false);
	});
});

describe("TARGETING_RULE_SCHEMA", () => {
	test("reads a rule that names one variant", () => {
		let rule = { when: { op: "always" }, serve: "on" };

		expect(parseSafe(TARGETING_RULE_SCHEMA, rule)).toEqual({ success: true, value: rule });
	});

	test("reads a rule that buckets among several", () => {
		let rule = { when: { op: "always" }, serve: { weights: { on: 1, off: 1 } } };

		expect(parseSafe(TARGETING_RULE_SCHEMA, rule)).toEqual({ success: true, value: rule });
	});
});

describe("FLAG_DEFINITION_SCHEMA", () => {
	test("reads the four types a variant holds", () => {
		let definition = {
			variants: { yes: true, greeting: "hi", ten: 10, shape: { title: "Pics", tags: [1, null] } },
			defaultVariant: "yes",
			state: "disabled",
			metadata: { owner: "growth", version: 3, cached: true },
			targeting: [{ when: { op: "always" }, serve: "yes" }],
		};

		expect(parseSafe(FLAG_DEFINITION_SCHEMA, definition)).toEqual({
			success: true,
			value: definition,
		});
	});

	test("refuses a flag with nothing to serve", () => {
		expect(parseSafe(FLAG_DEFINITION_SCHEMA, { variants: {} }).success).toBe(false);
	});

	test("refuses a state outside the two it names", () => {
		let definition = { variants: { on: true }, state: "ENABLED" };

		expect(parseSafe(FLAG_DEFINITION_SCHEMA, definition).success).toBe(false);
	});
});

describe("SEGMENT_SET_SCHEMA", () => {
	test("reads a map of named conditions", () => {
		let segments = {
			internal: { op: "endsWith", field: "email", value: "@example.com" },
			eu: { op: "in", field: "country", values: ["es", "fr"] },
		};

		expect(parseSafe(SEGMENT_SET_SCHEMA, segments)).toEqual({ success: true, value: segments });
	});

	test("refuses the whole map when one entry is not a condition", () => {
		let segments = { internal: { op: "endsWith", field: "email", value: 7 } };

		expect(parseSafe(SEGMENT_SET_SCHEMA, segments).success).toBe(false);
	});
});
