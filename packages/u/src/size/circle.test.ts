/**
 * Unit tests for `circle()`'s fixed square-aspect-ratio/full-radius pairing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { circle } from "./circle.js";

describe("circle", () => {
	test("applies a 1:1 aspect ratio and the full radius token", async () => {
		expect(await declarations(circle())).toEqual([
			"aspect-ratio: 1 / 1",
			"border-radius: var(--ui-radius-full, 9999px)",
		]);
	});
});
