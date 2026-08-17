/**
 * Unit tests for `pbs()`'s `padding-block-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { pbs } from "./pbs";

describe("pbs", () => {
	test("resolves a spacing-scale number", async () => {
		expect(await declarations(pbs(4))).toEqual([
			"padding-block-start: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
