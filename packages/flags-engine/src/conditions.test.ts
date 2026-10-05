/**
 * The targeting dialect's own operator, `semver`, and the reference spelling a
 * stored flag set already uses; every other operator belongs to the condition
 * language and is covered there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";

import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import type { Condition } from "./definition.js";

import { flagConditions } from "./conditions.js";

/** A context with a version field, a field that is no version, and a list. */
const CONTEXT: EvaluationContext = {
	targetingKey: "user-42",
	version: "1.4.2",
	build: "nightly",
	roles: ["admin"],
};

/** Compiles and evaluates one condition against the context. */
function holds(condition: Condition, context: EvaluationContext = CONTEXT): boolean {
	return flagConditions.evaluate(unwrap(flagConditions.compile(condition)), context);
}

test.each<[string, Condition, boolean]>([
	[
		"semver over the version",
		{ op: "semver", field: "version", compare: ">=", value: "1.0.0" },
		true,
	],
	["semver under it", { op: "semver", field: "version", compare: "<", value: "1.0.0" }, false],
	["semver within a minor", { op: "semver", field: "version", compare: "~", value: "1.4.0" }, true],
	[
		"semver on a field that is no version",
		{ op: "semver", field: "build", compare: ">=", value: "1.0.0" },
		false,
	],
	["semver against a list", { op: "semver", field: "roles", compare: ">=", value: "1.0.0" }, false],
	[
		"semver on a field the context lacks",
		{ op: "semver", field: "release", compare: ">=", value: "1.0.0" },
		false,
	],
])("evaluates %s", (_, condition, expected) => {
	expect(holds(condition)).toBe(expected);
});

test("refuses a version comparison outside the eight", () => {
	expect(
		flagConditions.compile({ op: "semver", field: "v", compare: "≈", value: "1.0.0" }),
	).toMatchObject({
		status: "failure",
		error: { path: "compare" },
	});
});

test("resolves a segment reference against the segments it is handed", () => {
	let segments = { internal: { op: "endsWith", field: "email", value: "@example.com" } };
	let compiled = unwrap(
		flagConditions.compile({ op: "segment", name: "internal" }, { references: segments }),
	);

	expect(flagConditions.evaluate(compiled, { email: "ada@example.com" })).toBe(true);
	expect(
		flagConditions.compile({ op: "segment", name: "staff" }, { references: segments }),
	).toMatchObject({
		error: { message: 'Unknown segment "staff"' },
	});
});
