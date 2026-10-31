/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MixInput } from "remix/component";

import { css } from "remix/component";
import { describe, expect, test } from "vitest";

import type { UtilityMixin } from "../internal/descriptor.js";

import { fg } from "../color/fg.js";
import { serialize } from "../internal/serialize.js";
import { text } from "../typography/text.js";

import { mergeMix } from "./merge-mix.js";

/** The stylesheet of the single utility a merge produced, the last entry of its result. */
async function mergedCSS(value: MixInput): Promise<string> {
	let list = value as ReadonlyArray<UtilityMixin>;
	return (await serialize(list[list.length - 1]!)).replace(/\s+/g, " ");
}

describe("mergeMix", () => {
	test("puts the caller's utilities in a cascade sublayer after the component's", async () => {
		let result = await mergedCSS(mergeMix([fg("neutral"), text("sm")], text("xs")));

		let defaults = result.indexOf("@layer defaults");
		let overrides = result.indexOf("@layer overrides");
		expect(defaults).toBeGreaterThan(-1);
		expect(overrides).toBeGreaterThan(defaults);
		expect(result.slice(defaults, overrides)).toContain("var(--ui-text-sm");
		expect(result.slice(overrides)).toContain("var(--ui-text-xs");
		expect(result.slice(overrides)).not.toContain("var(--ui-text-sm");
	});

	test("merges utilities nested inside arrays and drops falsy values", async () => {
		let result = await mergedCSS(mergeMix([text("sm"), false], [null, [text("lg")]]));

		expect(result.slice(result.indexOf("@layer overrides"))).toContain("var(--ui-text-lg");
	});

	test("keeps every other mixin, the component's first, ahead of the merged utilities", () => {
		let own = css({ display: "block" });
		let callers = css({ display: "flex" });

		let result = mergeMix([own, text("sm")], [callers, text("xs")]) as ReadonlyArray<unknown>;

		expect(result.slice(0, 2)).toEqual([own, callers]);
		expect(result).toHaveLength(3);
	});

	test("leaves the component's mixins untouched when the caller passes no utility", () => {
		let base = [fg("neutral"), text("sm")];
		let callers = css({ display: "flex" });

		expect(mergeMix(base, callers)).toEqual([base, callers]);
		expect(mergeMix(base, undefined)).toEqual([base, undefined]);
	});
});
