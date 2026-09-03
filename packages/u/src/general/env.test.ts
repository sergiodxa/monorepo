/**
 * Unit tests for `env()`, a plain string resolver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { env } from "./env.js";

describe("env", () => {
	test("resolves a bare reference with no fallback", () => {
		expect(env("safe-area-inset-bottom")).toBe("env(safe-area-inset-bottom)");
	});

	test("resolves a reference with a fallback", () => {
		expect(env("safe-area-inset-bottom", "0px")).toBe("env(safe-area-inset-bottom, 0px)");
	});
});
