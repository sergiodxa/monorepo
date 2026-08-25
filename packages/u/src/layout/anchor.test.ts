/**
 * Unit tests for `anchor()`, a plain string resolver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { anchor } from "./anchor";

describe("anchor", () => {
	test("prefixes the anchor name with --", () => {
		expect(anchor("tip", "bottom")).toBe("anchor(--tip bottom)");
	});

	test("prefixes a multi-word name the same way", () => {
		expect(anchor("tooltip-trigger", "top")).toBe("anchor(--tooltip-trigger top)");
	});

	test("resolves each physical side", () => {
		expect(anchor("tip", "top")).toBe("anchor(--tip top)");
		expect(anchor("tip", "right")).toBe("anchor(--tip right)");
		expect(anchor("tip", "bottom")).toBe("anchor(--tip bottom)");
		expect(anchor("tip", "left")).toBe("anchor(--tip left)");
	});

	test("resolves each logical side", () => {
		expect(anchor("tip", "start")).toBe("anchor(--tip start)");
		expect(anchor("tip", "end")).toBe("anchor(--tip end)");
		expect(anchor("tip", "self-start")).toBe("anchor(--tip self-start)");
		expect(anchor("tip", "self-end")).toBe("anchor(--tip self-end)");
	});

	test("resolves center, inside and outside", () => {
		expect(anchor("tip", "center")).toBe("anchor(--tip center)");
		expect(anchor("tip", "inside")).toBe("anchor(--tip inside)");
		expect(anchor("tip", "outside")).toBe("anchor(--tip outside)");
	});

	test("resolves a percentage side through the raw-string escape", () => {
		expect(anchor("tip", "25%")).toBe("anchor(--tip 25%)");
	});

	test("appends a fallback when one is given", () => {
		expect(anchor("tip", "bottom", "100%")).toBe("anchor(--tip bottom, 100%)");
	});

	test("appends a zero-length fallback rather than dropping it", () => {
		expect(anchor("tip", "center", "0px")).toBe("anchor(--tip center, 0px)");
	});

	test("an explicit undefined fallback omits the comma", () => {
		expect(anchor("tip", "bottom", undefined)).toBe("anchor(--tip bottom)");
	});
});
