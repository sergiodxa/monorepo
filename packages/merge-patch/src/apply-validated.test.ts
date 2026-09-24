/**
 * Checks that `applyValidated` judges the patched resource with the resource's own
 * schema, so issue paths point into the result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { maxLength, minLength } from "remix/data-schema/checks";
import { describe, expect, expectTypeOf, test } from "vitest";

import { applyValidated, MergePatchValidationError } from "./apply-validated.js";

const MONITOR_SCHEMA = s.object({
	name: s.string().pipe(minLength(1), maxLength(20)),
	intervalSeconds: s.number(),
	description: s.optional(s.string()),
});

const MONITOR = { name: "Home page", intervalSeconds: 60, description: "Front door" };

describe("applyValidated", () => {
	test("returns the patched resource typed by the schema", () => {
		let result = applyValidated(
			MONITOR,
			{ description: null, intervalSeconds: 30 },
			MONITOR_SCHEMA,
		);

		expect(unwrap(result)).toEqual({ name: "Home page", intervalSeconds: 30 });
		expectTypeOf(unwrap(result)).toHaveProperty("intervalSeconds").toEqualTypeOf<number>();
		expectTypeOf(unwrap(result)).toHaveProperty("name").toEqualTypeOf<string>();
	});

	test("fails on a member the patch sets out of range, at the patch's own path", () => {
		let result = applyValidated(MONITOR, { name: "" }, MONITOR_SCHEMA);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MergePatchValidationError);
		expect(result.error.issues.map((issue) => issue.path)).toEqual([["name"]]);
	});

	test("fails when the patch removes a required member", () => {
		let result = applyValidated(MONITOR, { intervalSeconds: null }, MONITOR_SCHEMA);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.issues[0]?.path).toEqual(["intervalSeconds"]);
	});

	test("fails on a schema that validates asynchronously", () => {
		let asyncSchema: StandardSchemaV1<unknown, unknown> = {
			"~standard": { version: 1, vendor: "test", validate: async (value) => ({ value }) },
		};

		let result = applyValidated({}, {}, asyncSchema);

		expect(isFailure(result)).toBe(true);
	});
});
