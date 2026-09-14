/**
 * The dotted-path reader, checked on the shapes a context actually arrives in
 * and on the misses a rule must survive: a path through a primitive, a key that
 * is not there, and a field that is there holding `null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";

import { expect, test } from "vitest";

import { read } from "./path.js";

/** One context carrying every shape the table addresses. */
const CONTEXT: EvaluationContext = {
	targetingKey: "user-42",
	country: "AR",
	plan: { tier: "pro", limits: { seats: 5 }, trial: null },
	roles: ["admin", "billing"],
	teams: [{ name: "core" }],
	"plan.tier": "literal",
	deletedAt: null,
};

test.each([
	["a scalar at the root", "country", "AR"],
	["a nested field", "plan.tier", "pro"],
	["a twice-nested field", "plan.limits.seats", 5],
	["a numeric segment indexing an array", "roles.0", "admin"],
	["a field inside an array element", "teams.0.name", "core"],
	["an index past the end of an array", "roles.9", undefined],
	["a non-index segment against an array", "roles.length", undefined],
	["an absent root field", "plan_tier", undefined],
	["an absent nested field", "plan.seats", undefined],
	["a path walking through a string", "country.length", undefined],
	["a path walking through a number", "plan.limits.seats.0", undefined],
	["a path walking through null", "plan.trial.days", undefined],
	["a path walking past a leaf", "plan.tier.deeper.still", undefined],
	["an inherited property", "constructor", undefined],
	["the prototype", "__proto__", undefined],
	["an empty path", "", undefined],
] as const)("reads %s", (_, path, expected) => {
	expect(read(CONTEXT, path)).toEqual(expected);
});

test("tells a field holding null apart from a field that is absent", () => {
	expect(read(CONTEXT, "deletedAt")).toBeNull();
	expect(read(CONTEXT, "archivedAt")).toBeUndefined();
	expect(read(CONTEXT, "plan.trial")).toBeNull();
});

test("addresses a field whose name contains a dot by the shape it sits inside", () => {
	expect(read(CONTEXT, "plan.tier")).toBe("pro");
	expect(read({ "plan.tier": "literal" }, "plan.tier")).toBeUndefined();
});

test("reads a Date whole rather than descending into it", () => {
	let createdAt = new Date("2026-09-14T00:00:00.000Z");

	expect(read({ createdAt }, "createdAt")).toBe(createdAt);
	expect(read({ createdAt }, "createdAt.getTime")).toBeUndefined();
});
