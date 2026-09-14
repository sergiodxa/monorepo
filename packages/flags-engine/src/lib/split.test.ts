/**
 * What a rollout percentage has to be worth: the same subject in the same arm
 * every time, an arm that really holds its share of a large sample, weights
 * taken against their own sum, and a missing subject reported rather than
 * quietly served.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";

import { isFailure, isSuccess } from "@sdxc/result";
import { expect, test } from "vitest";

import type { Split } from "../definition.js";

import { murmurHash3 } from "./hash.js";
import { selectVariant } from "./split.js";

/** Enough subjects that a one-in-a-thousand arm is expected to hold twenty of them. */
const SUBJECTS = Array.from({ length: 20_000 }, (_, index) => `user-${index}`);

/** The arm a subject landed in, for the assertions that are about the arm rather than the outcome. */
function armOf(split: Split, flagKey: string, subject: string): string | undefined {
	let picked = selectVariant(split, flagKey, { targetingKey: subject });

	return isSuccess(picked) ? picked.data : undefined;
}

/** How much of a sample one arm holds, as a fraction of the whole sample. */
function shareOf(split: Split, flagKey: string, variant: string): number {
	let held = SUBJECTS.filter((subject) => armOf(split, flagKey, subject) === variant);

	return held.length / SUBJECTS.length;
}

test("puts the same subject in the same arm on every call", () => {
	let split: Split = { weights: { on: 10, off: 90 } };
	let first = armOf(split, "beta", "user-42");

	for (let attempt = 0; attempt < 100; attempt++) {
		expect(armOf(split, "beta", "user-42")).toBe(first);
	}
});

test("buckets on the subject alone, so the rest of the context moves nobody", () => {
	let split: Split = { weights: { on: 10, off: 90 } };
	let bare: EvaluationContext = { targetingKey: "user-42" };
	let rich: EvaluationContext = { targetingKey: "user-42", country: "AR", plan: { tier: "pro" } };

	expect(selectVariant(split, "beta", rich)).toEqual(selectVariant(split, "beta", bare));
});

test.each(SUBJECTS.slice(0, 8))(
	"scales %s's hash onto the weights by a multiply-high",
	(subject) => {
		let hash = murmurHash3(`beta${subject}`);

		expect(armOf({ weights: { a: 1, b: 1 } }, "beta", subject)).toBe(hash < 2 ** 31 ? "a" : "b");
	},
);

test("expresses a bucket below one percent, which a share of a hundred cannot", () => {
	let split: Split = { weights: { rare: 1, rest: 999 } };
	let share = shareOf(split, "beta", "rare");

	expect(share).toBeGreaterThan(0);
	expect(share).toBeLessThan(0.005);
});

test("takes the weights against their own sum rather than against a hundred", () => {
	let halves: Split = { weights: { a: 1, b: 1 } };
	let fifths: Split = { weights: { a: 5, b: 5 } };

	for (let subject of SUBJECTS.slice(0, 200)) {
		expect(armOf(fifths, "beta", subject)).toBe(armOf(halves, "beta", subject));
	}

	expect(shareOf({ weights: { on: 1, off: 3 } }, "beta", "on")).toBeGreaterThan(0.24);
	expect(shareOf({ weights: { on: 1, off: 3 } }, "beta", "on")).toBeLessThan(0.26);
});

test("walks the arms in variant-name order, whatever order the weights arrive in", () => {
	let written: Split = { weights: { a: 1, b: 1, c: 1 } };
	let stored: Split = { weights: { c: 1, a: 1, b: 1 } };

	for (let subject of SUBJECTS.slice(0, 500)) {
		expect(armOf(stored, "beta", subject)).toBe(armOf(written, "beta", subject));
	}
});

test("gives a ten percent arm ten percent of a large sample", () => {
	expect(shareOf({ weights: { on: 10, off: 90 } }, "beta", "on")).toBeGreaterThan(0.09);
	expect(shareOf({ weights: { on: 10, off: 90 } }, "beta", "on")).toBeLessThan(0.11);
});

test("gives every arm of a three-way split its own share", () => {
	let split: Split = { weights: { control: 60, red: 30, blue: 10 } };

	expect(shareOf(split, "experiment", "control")).toBeCloseTo(0.6, 2);
	expect(shareOf(split, "experiment", "red")).toBeCloseTo(0.3, 2);
	expect(shareOf(split, "experiment", "blue")).toBeCloseTo(0.1, 2);
});

test("covers a different tenth for every flag key, and the same one under a shared seed", () => {
	let split: Split = { weights: { on: 10, off: 90 } };
	let seeded: Split = { weights: { on: 10, off: 90 }, seed: "checkout" };
	let sample = SUBJECTS.slice(0, 500);

	let moved = sample.filter(
		(subject) => armOf(split, "beta", subject) !== armOf(split, "gamma", subject),
	);
	expect(moved.length).toBeGreaterThan(0);

	for (let subject of sample) {
		expect(armOf(seeded, "gamma", subject)).toBe(armOf(seeded, "beta", subject));
	}
});

test("buckets on the field a split names, nested paths included", () => {
	let split: Split = { weights: { on: 1, off: 1 }, by: "account.id" };
	let one = selectVariant(split, "beta", { targetingKey: "user-1", account: { id: "acme" } });
	let other = selectVariant(split, "beta", { targetingKey: "user-2", account: { id: "acme" } });

	expect(one).toEqual(other);
});

test("reads a subject the caller sent as a number the way it reads the same text", () => {
	let split: Split = { weights: { on: 1, off: 1 }, by: "accountId" };
	let numeric = selectVariant(split, "beta", { accountId: 4210 });
	let textual = selectVariant(split, "beta", { accountId: "4210" });

	expect(numeric).toEqual(textual);
});

test.each<[string, Split, EvaluationContext]>([
	["a context carrying nothing at all", { weights: { on: 10, off: 90 } }, {}],
	[
		"a context naming every field but the subject",
		{ weights: { on: 10, off: 90 } },
		{ country: "AR" },
	],
	["a bucketing field holding null", { weights: { on: 1 }, by: "accountId" }, { accountId: null }],
	[
		"a bucketing field holding a structure",
		{ weights: { on: 1 }, by: "account" },
		{ account: { id: "acme" } },
	],
	["a bucketing field holding a list", { weights: { on: 1 }, by: "roles" }, { roles: ["admin"] }],
])("reports %s rather than serving an arm", (_, split, context) => {
	let picked = selectVariant(split, "beta", context);

	expect(isFailure(picked)).toBe(true);
});

test("names the field it found nothing under, so the fix is the one to make", () => {
	let picked = selectVariant({ weights: { on: 1 }, by: "accountId" }, "beta", {
		targetingKey: "user-42",
	});

	expect(isFailure(picked)).toBe(true);
	if (isFailure(picked)) expect(picked.error.message).toContain("accountId");
});
