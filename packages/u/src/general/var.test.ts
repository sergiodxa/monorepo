/**
 * Unit tests for `var()`, a plain string resolver (not a mixin).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { var as varUtility } from "./var";

describe("var", () => {
	test("resolves a bare reference with no fallback", () => {
		expect(varUtility("sidebar-width")).toBe("var(--sidebar-width)");
	});

	test("resolves a reference with a fallback", () => {
		expect(varUtility("sidebar-width", "18rem")).toBe("var(--sidebar-width, 18rem)");
	});
});
