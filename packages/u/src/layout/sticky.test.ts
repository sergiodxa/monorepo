/**
 * Unit tests for `sticky()`'s fixed `position: sticky` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { sticky } from "./sticky";

describe("sticky", () => {
	test("sets position: sticky", async () => {
		expect(await declarations(sticky())).toEqual(["position: sticky"]);
	});
});
