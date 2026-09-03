/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { accent } from "./accent.js";

describe("accent", () => {
	test("defaults to the brand solid color", async () => {
		expect(await declarations(accent())).toEqual(["accent-color: var(--ui-brand-bg-solid)"]);
	});

	test("an explicit tone resolves that tone's solid color", async () => {
		expect(await declarations(accent("danger"))).toEqual([
			"accent-color: var(--ui-danger-bg-solid)",
		]);
	});
});
