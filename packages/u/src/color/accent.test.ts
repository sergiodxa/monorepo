/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { accent } from "./accent";

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
