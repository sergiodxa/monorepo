/**
 * One case per row of the reason table, because a consumer reading `reason`
 * alone has to be able to tell a flag that is off from a flag system that is
 * broken, plus the type check and the bulk shape that answers without a
 * per-flag default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext, FlagValue, ResolutionDetails } from "@sdxc/flags";

import { expect, test } from "vitest";

import { evaluate, evaluateAll } from "./evaluate.js";
import { parseFlagSet } from "./parse.js";

/**
 * One set carrying a flag per row of the reason table, parsed the way a store's
 * contents reach evaluation, so `broken` is a real parse failure rather than a
 * hand-built one.
 */
const SNAPSHOT = parseFlagSet({
	flags: {
		banner: { variants: { on: true, off: false }, defaultVariant: "off" },
		greeting: { variants: { casual: "hey", formal: "good day" }, defaultVariant: "casual" },
		seats: { variants: { few: 5, many: 50 }, defaultVariant: "few" },
		theme: {
			variants: { dark: { color: "black" }, light: { color: "white" } },
			defaultVariant: "dark",
		},
		regional: {
			variants: { on: true, off: false },
			defaultVariant: "off",
			targeting: [{ when: { op: "eq", field: "country", value: "AR" }, serve: "on" }],
		},
		rollout: {
			variants: { on: true, off: false },
			defaultVariant: "off",
			targeting: [{ when: { op: "always" }, serve: { weights: { on: 1, off: 0 } } }],
		},
		invited: {
			variants: { on: true },
			targeting: [{ when: { op: "eq", field: "country", value: "AR" }, serve: "on" }],
		},
		retired: { variants: { on: true, off: false }, defaultVariant: "on", state: "disabled" },
		documented: {
			variants: { on: true },
			defaultVariant: "on",
			metadata: { version: 17, owner: "growth" },
		},
		broken: { variants: { on: true }, defaultVariant: "nobody" },
	},
});

test.each<[string, string, FlagValue, EvaluationContext, ResolutionDetails<FlagValue>]>([
	[
		"no targeting, and a default variant",
		"banner",
		false,
		{},
		{ value: false, reason: "STATIC", variant: "off" },
	],
	[
		"a rule matched and named a variant",
		"regional",
		false,
		{ country: "AR" },
		{ value: true, reason: "TARGETING_MATCH", variant: "on" },
	],
	[
		"a rule matched and bucketed",
		"rollout",
		false,
		{ targetingKey: "user-42" },
		{ value: true, reason: "SPLIT", variant: "on" },
	],
	[
		"targeting ran and no rule matched",
		"regional",
		false,
		{ country: "US" },
		{ value: false, reason: "DEFAULT", variant: "off" },
	],
	[
		"no default variant to fall back to",
		"invited",
		false,
		{ country: "US" },
		{ value: false, reason: "DEFAULT" },
	],
	["a disabled flag", "retired", false, {}, { value: false, reason: "DISABLED" }],
	[
		"no flag under that key",
		"nowhere",
		false,
		{},
		{ value: false, reason: "ERROR", errorCode: "FLAG_NOT_FOUND" },
	],
	[
		"a definition that did not parse",
		"broken",
		false,
		{},
		{ value: false, reason: "ERROR", errorCode: "PARSE_ERROR" },
	],
	[
		"a variant holding another type",
		"banner",
		"fallback",
		{},
		{ value: "fallback", reason: "ERROR", errorCode: "TYPE_MISMATCH" },
	],
	[
		"a split with no subject to bucket",
		"rollout",
		false,
		{},
		{ value: false, reason: "ERROR", errorCode: "TARGETING_KEY_MISSING" },
	],
])("reports %s", (_, key, defaultValue, context, expected) => {
	expect(evaluate(SNAPSHOT, key, defaultValue, context)).toMatchObject(expected);
});

test("names no variant for a flag that served the caller's own default", () => {
	let details = evaluate(SNAPSHOT, "invited", false, { country: "US" });

	expect(details.variant).toBeUndefined();
	expect(details.errorCode).toBeUndefined();
});

test("says why a definition was refused, in the words the parse failure recorded", () => {
	let details = evaluate(SNAPSHOT, "broken", false);

	expect(details.errorMessage).toContain("nobody");
});

test.each<[string, string, FlagValue, FlagValue]>([
	["a boolean", "banner", true, false],
	["a string", "greeting", "hi", "hey"],
	["a number", "seats", 1, 5],
	["a structure", "theme", { color: "red" }, { color: "black" }],
])("resolves %s variant through a default of that type", (_, key, defaultValue, expected) => {
	expect(evaluate(SNAPSHOT, key, defaultValue).value).toEqual(expected);
});

test.each<[string, string, FlagValue]>([
	["a boolean flag through a string default", "banner", "off"],
	["a string flag through a number default", "greeting", 0],
	["a number flag through a boolean default", "seats", false],
	["a structure flag through a boolean default", "theme", true],
	["a boolean flag through a structure default", "banner", { color: "red" }],
])("serves the caller's own default for %s", (_, key, defaultValue) => {
	let details = evaluate(SNAPSHOT, key, defaultValue);

	expect(details).toMatchObject({
		value: defaultValue,
		reason: "ERROR",
		errorCode: "TYPE_MISMATCH",
	});
});

test("carries the metadata a definition declared onto every resolution of that flag", () => {
	expect(evaluate(SNAPSHOT, "documented", false).flagMetadata).toEqual({
		version: 17,
		owner: "growth",
	});
	expect(evaluate(SNAPSHOT, "banner", false).flagMetadata).toBeUndefined();
});

test("answers for a snapshot holding nothing at all", () => {
	let empty = parseFlagSet({ flags: {} });

	expect(evaluate(empty, "banner", false)).toMatchObject({
		value: false,
		reason: "ERROR",
		errorCode: "FLAG_NOT_FOUND",
	});
	expect(evaluateAll(empty)).toEqual({});
});

test("resolves every flag in the set at once, the ones that did not parse included", () => {
	let all = evaluateAll(SNAPSHOT, { targetingKey: "user-42", country: "AR" });

	expect(Object.keys(all).sort()).toEqual([
		"banner",
		"broken",
		"documented",
		"greeting",
		"invited",
		"regional",
		"retired",
		"rollout",
		"seats",
		"theme",
	]);
	expect(all.banner).toMatchObject({ value: false, reason: "STATIC", variant: "off" });
	expect(all.regional).toMatchObject({ value: true, reason: "TARGETING_MATCH", variant: "on" });
	expect(all.rollout).toMatchObject({ value: true, reason: "SPLIT", variant: "on" });
	expect(all.documented).toMatchObject({ flagMetadata: { version: 17, owner: "growth" } });
});

test.each<[string, string]>([
	["a definition that did not parse", "broken"],
	["a flag that is switched off", "retired"],
	["a flag whose rules named no variant", "invited"],
])("reports null in bulk for %s, so the caller uses the default it already has", (_, key) => {
	let all = evaluateAll(SNAPSHOT, { country: "US" });

	expect(all[key]).toMatchObject({ value: null });
	expect(all[key]?.variant).toBeUndefined();
});

test("keeps the error code on the entry a bulk caller cannot resolve", () => {
	let all = evaluateAll(SNAPSHOT);

	expect(all.broken).toMatchObject({ reason: "ERROR", errorCode: "PARSE_ERROR" });
	expect(all.rollout).toMatchObject({ reason: "ERROR", errorCode: "TARGETING_KEY_MISSING" });
	expect(all.retired).toMatchObject({ reason: "DISABLED" });
});
