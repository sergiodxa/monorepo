/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { declarations } from "../internal/serialize";

import { backdropOpacity } from "./backdrop-opacity";

describe("backdropOpacity", () => {
	test("no-arg defaults to 0.5", async () => {
		expect(await declarations(backdropOpacity())).toEqual([
			"--ui-backdrop-opacity: 0.5",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit numeric amount in the native 0-1 range", async () => {
		expect(await declarations(backdropOpacity(0.25))).toEqual([
			"--ui-backdrop-opacity: 0.25",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("a raw percentage string passes through unchanged", async () => {
		expect(await declarations(backdropOpacity("25%"))).toEqual([
			"--ui-backdrop-opacity: 25%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("it sets the backdrop variable, never the opacity property", async () => {
		let properties = (await declarations(backdropOpacity())).map((line) => line.split(":")[0]);

		expect(properties).not.toContain("opacity");
	});
});
