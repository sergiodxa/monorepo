/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { textAlign } from "./text-align";

describe("textAlign", () => {
	test("no-arg defaults to the logical start keyword", async () => {
		expect(await declarations(textAlign())).toEqual(["text-align: start"]);
	});

	test("center", async () => {
		expect(await declarations(textAlign("center"))).toEqual(["text-align: center"]);
	});

	test("end", async () => {
		expect(await declarations(textAlign("end"))).toEqual(["text-align: end"]);
	});

	test("justify", async () => {
		expect(await declarations(textAlign("justify"))).toEqual(["text-align: justify"]);
	});

	test("never emits the physical left/right keywords for the typed logical values", async () => {
		let values = [
			...(await declarations(textAlign())),
			...(await declarations(textAlign("center"))),
			...(await declarations(textAlign("end"))),
			...(await declarations(textAlign("justify"))),
		];

		expect(values).not.toContain("text-align: left");
		expect(values).not.toContain("text-align: right");
	});

	test("accepts a raw physical left/right escape for the rare genuinely-physical case", async () => {
		expect(await declarations(textAlign("left"))).toEqual(["text-align: left"]);
		expect(await declarations(textAlign("right"))).toEqual(["text-align: right"]);
	});
});
