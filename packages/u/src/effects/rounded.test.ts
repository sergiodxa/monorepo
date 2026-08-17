/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { rounded } from "./rounded";

describe("rounded", () => {
	test("no-arg defaults to the md radius", async () => {
		expect(await declarations(rounded())).toEqual(["border-radius: var(--ui-radius-md, 0.375rem)"]);
	});

	test("an explicit named radius", async () => {
		expect(await declarations(rounded("lg"))).toEqual([
			"border-radius: var(--ui-radius-lg, 0.5rem)",
		]);
	});

	test("the inherit keyword bypasses token resolution", async () => {
		expect(await declarations(rounded("inherit"))).toEqual(["border-radius: inherit"]);
	});
});
