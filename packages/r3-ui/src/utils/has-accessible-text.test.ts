/**
 * Unit tests for the accessible-text tree-walk in
 * {@link "./has-accessible-text"}: every assertion checks a known `children`
 * shape against the expected boolean outcome, with no DOM and no rendering
 * involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { hasAccessibleText } from "./has-accessible-text";

describe(hasAccessibleText.name, () => {
	test("a plain string with content counts as accessible text", () => {
		expect(hasAccessibleText("Save changes")).toBe(true);
	});

	test("an empty or whitespace-only string carries no accessible text", () => {
		expect(hasAccessibleText("")).toBe(false);
		expect(hasAccessibleText("   \n\t")).toBe(false);
	});

	test("a number counts as accessible text", () => {
		expect(hasAccessibleText(42)).toBe(true);
		expect(hasAccessibleText(0)).toBe(true);
	});

	test("a bigint counts as accessible text", () => {
		expect(hasAccessibleText(42n)).toBe(true);
	});

	test("an array counts as soon as any entry carries accessible text", () => {
		expect(hasAccessibleText([undefined, false, "   ", "Delete"])).toBe(true);
		expect(hasAccessibleText([undefined, false, "   ", {}])).toBe(false);
	});

	test("a nested element-like object recurses through its own props.children", () => {
		let icon = { props: {} };
		let label = { props: { children: "Settings" } };

		expect(hasAccessibleText({ props: { children: label } })).toBe(true);
		expect(hasAccessibleText({ props: { children: icon } })).toBe(false);
		expect(hasAccessibleText({ props: { children: [icon, label] } })).toBe(true);
	});

	test("undefined, a boolean, and a bare icon-like object with no props carry no accessible text", () => {
		expect(hasAccessibleText(undefined)).toBe(false);
		expect(hasAccessibleText(true)).toBe(false);
		expect(hasAccessibleText(false)).toBe(false);
		expect(hasAccessibleText({ type: "svg" })).toBe(false);
	});
});
