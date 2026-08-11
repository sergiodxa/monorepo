/**
 * Unit tests for `when.ts`, the primitive selector wrapper every other state
 * utility is sugar over.
 *
 * The environment split is directly reachable here: under `bun test`,
 * `import.meta.env` is Bun's live alias for `process.env`, so `.DEV` is simply
 * `process.env.DEV` and each branch can be selected by setting or deleting it
 * around an assertion, with no module mocking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { when } from "./when";

let originalDev: string | undefined;

beforeEach(() => {
	originalDev = process.env.DEV;
	process.env.DEV = "1";
});

afterEach(() => {
	if (originalDev === undefined) delete process.env.DEV;
	else process.env.DEV = originalDev;
});

describe("when", () => {
	test("emits the literal selector as a nested block", async () => {
		expect(await serialize(when("&:hover", p(4)))).toContain("&:hover {");
		expect(await declarations(when("&:hover", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("an array of two utilities merges under the same selector", async () => {
		let css = await serialize(when("&:hover", [bg("brand.tint"), border("brand")]));

		// One block, not two: a second `&:hover {` would mean the merge happened
		// after serialization rather than before it.
		expect(css.split("&:hover {")).toHaveLength(2);
		expect(await declarations(when("&:hover", [bg("brand.tint"), border("brand")]))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("a selector the serializer cannot recognize as nested is rejected outright in development", () => {
		// The serializer only treats a key as a selector when it starts with
		// `&`, `@`, `:`, `[` or `.`. Anything else — a leading element or class
		// name, as in `"input:checked ~ &"` — used to be emitted as a declaration
		// whose value stringifies to `[object Object]`, which browsers discard, so
		// the rule vanished with no error anywhere. Now it throws instead.
		expect(() => when("input:checked ~ &", p(4))).toThrow(/would be emitted as a declaration/);
		expect(() => when("> *", p(4))).toThrow();
	});

	test("the `:is(...)` form of the same selector is accepted and emitted verbatim", async () => {
		let css = await serialize(when(":is(input:checked) ~ &", p(4)));

		expect(css).toContain(":is(input:checked) ~ & {");
		// `[object Object]` is the fingerprint of a selector that fell through to
		// the declaration path; asserting its absence is what proves the rule
		// actually reached the stylesheet.
		expect(css).not.toContain("[object Object]");
	});

	describe("outside development", () => {
		beforeEach(() => {
			delete process.env.DEV;
		});

		test("the same rejected selector renders instead of throwing, and warns only once", () => {
			let warn = spyOn(console, "warn").mockImplementation(() => {});

			try {
				// Twice over: the guard has to survive a re-render of the same
				// component, which is what a per-render throw would break.
				expect(() => when("form:invalid ~ &", p(4))).not.toThrow();
				expect(() => when("form:invalid ~ &", p(4))).not.toThrow();

				expect(warn).toHaveBeenCalledTimes(1);
				expect(warn.mock.calls[0]?.[0]).toContain("would be emitted as a declaration");
			} finally {
				warn.mockRestore();
			}
		});

		test("a second, distinct rejected selector still gets its own warning", () => {
			let warn = spyOn(console, "warn").mockImplementation(() => {});

			try {
				when("table:empty ~ &", p(4));
				when("caption:empty ~ &", p(4));

				expect(warn).toHaveBeenCalledTimes(2);
			} finally {
				warn.mockRestore();
			}
		});
	});

	test("every prefix the serializer recognizes is accepted", () => {
		for (let selector of ["&:hover", "@media (min-width: 0)", ":is(a) ~ &", "[data-x] &", ".x &"]) {
			expect(() => when(selector, p(4))).not.toThrow();
		}
	});
});
