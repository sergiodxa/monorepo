/**
 * What `parseFlagSet` makes of a stored set: which flags reach the snapshot
 * ready to evaluate, which land in `failures` under their own key, and that one
 * refused definition leaves its siblings alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { StoredFlagSet } from "./store/index.js";

import { parseFlagSet } from "./parse.js";

/** A flag every case can keep beside the one it breaks, to prove isolation. */
const HEALTHY_FLAG = {
	variants: { on: true, off: false },
	defaultVariant: "off",
	targeting: [{ when: { op: "always" }, serve: "on" }],
};

describe("parseFlagSet", () => {
	test("reads a whole set into a snapshot ready to evaluate", () => {
		let stored: StoredFlagSet = {
			version: "rev-7",
			segments: { internal: { op: "endsWith", field: "email", value: "@example.com" } },
			flags: {
				"welcome-banner": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					state: "enabled",
					metadata: { owner: "growth", version: 3 },
					targeting: [
						{ when: { op: "segment", name: "internal" }, serve: "on" },
						{ when: { op: "always" }, serve: { weights: { on: 10, off: 90 } } },
					],
				},
			},
		};

		let snapshot = parseFlagSet(stored);

		expect(snapshot.failures.size).toBe(0);
		expect(snapshot.version).toBe("rev-7");
		expect(typeof snapshot.createdAt).toBe("number");
		expect(snapshot.segments.get("internal")).toEqual({
			op: "endsWith",
			field: "email",
			value: "@example.com",
		});

		let flag = snapshot.flags.get("welcome-banner");
		expect(flag?.key).toBe("welcome-banner");
		expect(flag?.state).toBe("enabled");
		expect(flag?.defaultVariant).toBe("off");
		expect(flag?.metadata).toEqual({ owner: "growth", version: 3 });
		expect([...(flag?.variants ?? [])]).toEqual([
			["on", true],
			["off", false],
		]);
		expect(flag?.targeting).toHaveLength(2);
		expect(flag?.targeting[1]?.serve).toEqual({ weights: { on: 10, off: 90 } });
	});

	test("carries a segment's condition into the rule that names it", () => {
		let snapshot = parseFlagSet({
			segments: { eu: { op: "in", field: "country", values: ["es", "fr"] } },
			flags: {
				checkout: {
					variants: { on: true, off: false },
					targeting: [{ when: { op: "segment", name: "eu" }, serve: "on" }],
				},
			},
		});

		expect(snapshot.flags.get("checkout")?.targeting[0]?.when).toEqual({
			op: "segment",
			name: "eu",
			of: { op: "in", field: "country", values: ["es", "fr"] },
		});
	});

	test("defaults an absent state to enabled and an absent targeting to no rules", () => {
		let snapshot = parseFlagSet({ flags: { bare: { variants: { on: true } } } });

		let flag = snapshot.flags.get("bare");
		expect(flag?.state).toBe("enabled");
		expect(flag?.targeting).toEqual([]);
		expect(flag?.defaultVariant).toBeUndefined();
	});

	test("compiles a matches pattern once, with the v flag", () => {
		let snapshot = parseFlagSet({
			flags: {
				beta: {
					variants: { on: true },
					targeting: [{ when: { op: "matches", field: "email", pattern: "^ada@" }, serve: "on" }],
				},
			},
		});

		let when = snapshot.flags.get("beta")?.targeting[0]?.when;
		expect(when).toMatchObject({ op: "matches", field: "email" });
		expect(when).toHaveProperty("pattern", expect.any(RegExp));
		expect((when as { pattern: RegExp }).pattern.flags).toBe("v");
	});

	test("reads a set a store answered with nothing in as an empty snapshot", () => {
		let snapshot = parseFlagSet({ flags: {} });

		expect(snapshot.flags.size).toBe(0);
		expect(snapshot.failures.size).toBe(0);
		expect(snapshot.segments.size).toBe(0);
	});
});

describe("parseFlagSet failures", () => {
	/** Each case breaks one flag next to a healthy sibling, and names why. */
	let cases: { name: string; flag: unknown; reason: RegExp }[] = [
		{
			name: "a definition that is not an object",
			flag: "on",
			reason: /expected/i,
		},
		{
			name: "a definition with no variants at all",
			flag: { variants: {} },
			reason: /at least one variant/i,
		},
		{
			name: "a defaultVariant naming a variant nobody declared",
			flag: { variants: { on: true, off: false }, defaultVariant: "maybe" },
			reason: /defaultVariant "maybe" is not a declared variant/,
		},
		{
			name: "a pattern that does not compile",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "matches", field: "email", pattern: "([a-" }, serve: "on" }],
			},
			reason: /does not compile/,
		},
		{
			name: "an operator the language does not name",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "regex", field: "email", value: "ada" }, serve: "on" }],
			},
			reason: /op/i,
		},
		{
			name: "a well-formed condition whose value holds the wrong type",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "lt", field: "age", value: "18" }, serve: "on" }],
			},
			reason: /number/i,
		},
		{
			name: "a rule serving a variant nobody declared",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "always" }, serve: "off" }],
			},
			reason: /serves "off", which the flag does not declare/,
		},
		{
			name: "a split weighting a variant nobody declared",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "always" }, serve: { weights: { on: 1, off: 1 } } }],
			},
			reason: /"off" does not name a declared variant/,
		},
		{
			name: "a split whose weights could never select an arm",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "always" }, serve: { weights: { on: 0 } } }],
			},
			reason: /above zero/i,
		},
		{
			name: "a split weighted by a fraction of a share",
			flag: {
				variants: { on: true, off: false },
				targeting: [{ when: { op: "always" }, serve: { weights: { on: 0.5, off: 0.5 } } }],
			},
			reason: /whole, non-negative weight/i,
		},
		{
			name: "a condition naming a segment the set never declared",
			flag: {
				variants: { on: true },
				targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
			},
			reason: /Unknown segment "internal"/,
		},
	];

	for (let { name, flag, reason } of cases) {
		test(`records ${name} under its own key, and parses its siblings`, () => {
			let snapshot = parseFlagSet({ flags: { broken: flag, healthy: HEALTHY_FLAG } });

			expect(snapshot.failures.get("broken")?.key).toBe("broken");
			expect(snapshot.failures.get("broken")?.message).toMatch(reason);
			expect(snapshot.flags.has("broken")).toBe(false);
			expect(snapshot.flags.get("healthy")?.defaultVariant).toBe("off");
		});
	}

	test("fails only the flags that reach a segment cycle", () => {
		let snapshot = parseFlagSet({
			segments: {
				internal: { op: "any", of: [{ op: "segment", name: "staff" }] },
				staff: { op: "segment", name: "internal" },
				eu: { op: "eq", field: "country", value: "es" },
			},
			flags: {
				cyclic: {
					variants: { on: true },
					targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
				},
				sound: {
					variants: { on: true },
					targeting: [{ when: { op: "segment", name: "eu" }, serve: "on" }],
				},
			},
		});

		expect(snapshot.failures.get("cyclic")?.message).toMatch(/reference cycle/);
		expect(snapshot.flags.has("cyclic")).toBe(false);
		expect(snapshot.flags.get("sound")?.targeting).toHaveLength(1);
		expect(snapshot.segments.has("internal")).toBe(false);
		expect(snapshot.segments.has("eu")).toBe(true);
	});

	test("fails a flag reaching a segment that is itself the whole cycle", () => {
		let snapshot = parseFlagSet({
			segments: { loop: { op: "not", of: { op: "segment", name: "loop" } } },
			flags: {
				looping: {
					variants: { on: true },
					targeting: [{ when: { op: "segment", name: "loop" }, serve: "on" }],
				},
			},
		});

		expect(snapshot.failures.get("looping")?.message).toMatch(
			/"loop" takes part in a reference cycle/,
		);
	});

	test("fails a flag reaching a segment whose own condition does not parse", () => {
		let snapshot = parseFlagSet({
			segments: { internal: { op: "endsWith", field: "email", value: 7 } },
			flags: {
				gated: {
					variants: { on: true },
					targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
				},
				healthy: HEALTHY_FLAG,
			},
		});

		expect(snapshot.failures.get("gated")?.message).toMatch(/Unknown segment "internal"/);
		expect(snapshot.flags.has("healthy")).toBe(true);
	});

	test("answers with an empty snapshot when the set itself holds no object", () => {
		let snapshot = parseFlagSet({ flags: null as unknown as Record<string, unknown> });

		expect(snapshot.flags.size).toBe(0);
		expect(snapshot.failures.size).toBe(0);
	});
});
