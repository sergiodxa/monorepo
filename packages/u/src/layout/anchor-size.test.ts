/**
 * Unit tests for `anchorSize()`, a plain string resolver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { anchorSize } from "./anchor-size";

describe("anchorSize", () => {
	test("prefixes the anchor name with --", () => {
		expect(anchorSize("trigger", "inline")).toBe("anchor-size(--trigger inline)");
	});

	test("prefixes a multi-word name the same way", () => {
		expect(anchorSize("tooltip-trigger", "inline")).toBe("anchor-size(--tooltip-trigger inline)");
	});

	test("resolves each logical dimension", () => {
		expect(anchorSize("trigger", "block")).toBe("anchor-size(--trigger block)");
		expect(anchorSize("trigger", "inline")).toBe("anchor-size(--trigger inline)");
	});

	test("resolves each self-relative dimension", () => {
		expect(anchorSize("trigger", "self-block")).toBe("anchor-size(--trigger self-block)");
		expect(anchorSize("trigger", "self-inline")).toBe("anchor-size(--trigger self-inline)");
	});

	test("resolves each physical dimension", () => {
		expect(anchorSize("trigger", "width")).toBe("anchor-size(--trigger width)");
		expect(anchorSize("trigger", "height")).toBe("anchor-size(--trigger height)");
	});

	test("appends a fallback when one is given", () => {
		expect(anchorSize("trigger", "inline", "12rem")).toBe("anchor-size(--trigger inline, 12rem)");
	});

	test("appends a zero-length fallback rather than dropping it", () => {
		expect(anchorSize("trigger", "block", "0px")).toBe("anchor-size(--trigger block, 0px)");
	});

	test("an explicit undefined fallback omits the comma", () => {
		expect(anchorSize("trigger", "inline", undefined)).toBe("anchor-size(--trigger inline)");
	});
});
