/**
 * Unit tests for `when.ts`, the primitive selector wrapper every other state
 * utility is sugar over.
 *
 * The environment split is directly reachable here: `import.meta.env.DEV`
 * reads through to `process.env.DEV` at call time, so each branch is
 * selected by setting or deleting it directly around an assertion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { bg } from "../color/bg.js";
import { border } from "../color/border.js";
import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { when } from "./when.js";

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

		expect(css.split("&:hover {")).toHaveLength(2);
		expect(await declarations(when("&:hover", [bg("brand.tint"), border("brand")]))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("a selector the serializer cannot recognize as nested is rejected outright in development", () => {
		expect(() => when("input:checked ~ &", p(4))).toThrow(/would be emitted as a declaration/);
		expect(() => when("> *", p(4))).toThrow();
	});

	test("the `:is(...)` form of the same selector is accepted and emitted verbatim", async () => {
		let css = await serialize(when(":is(input:checked) ~ &", p(4)));

		expect(css).toContain(":is(input:checked) ~ & {");
		expect(css).not.toContain("[object Object]");
	});

	describe("outside development", () => {
		beforeEach(() => {
			delete process.env.DEV;
		});

		test("the same rejected selector renders instead of throwing, and warns only once", () => {
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {});

			try {
				expect(() => when("form:invalid ~ &", p(4))).not.toThrow();
				expect(() => when("form:invalid ~ &", p(4))).not.toThrow();

				expect(warn).toHaveBeenCalledTimes(1);
				expect(warn.mock.calls[0]?.[0]).toContain("would be emitted as a declaration");
			} finally {
				warn.mockRestore();
			}
		});

		test("a second, distinct rejected selector still gets its own warning", () => {
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {});

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
