/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { roundedCorner } from "./rounded-corner.js";

describe("roundedCorner", () => {
	test("no radius name defaults to the md radius", async () => {
		expect(await declarations(roundedCorner("end-start"))).toEqual([
			"border-end-start-radius: var(--ui-radius-md, 0.375rem)",
		]);
	});

	test("start-start corner with an explicit named radius", async () => {
		expect(await declarations(roundedCorner("start-start", "sm"))).toEqual([
			"border-start-start-radius: var(--ui-radius-sm, 0.25rem)",
		]);
	});

	test("end-end corner with an explicit named radius", async () => {
		expect(await declarations(roundedCorner("end-end", "lg"))).toEqual([
			"border-end-end-radius: var(--ui-radius-lg, 0.5rem)",
		]);
	});

	test("start-end corner with a raw CSS length", async () => {
		expect(await declarations(roundedCorner("start-end", "3px"))).toEqual([
			"border-start-end-radius: 3px",
		]);
	});
});
