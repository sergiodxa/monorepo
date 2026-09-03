/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { content } from "./content.js";

describe("content", () => {
	test("defaults to start", async () => {
		expect(await declarations(content())).toEqual(["align-content: start"]);
	});

	test("passes a plain keyword through unchanged", async () => {
		expect(await declarations(content("center"))).toEqual(["align-content: center"]);
	});

	test("aliases between to space-between", async () => {
		expect(await declarations(content("between"))).toEqual(["align-content: space-between"]);
	});

	test("aliases around to space-around", async () => {
		expect(await declarations(content("around"))).toEqual(["align-content: space-around"]);
	});

	test("aliases evenly to space-evenly", async () => {
		expect(await declarations(content("evenly"))).toEqual(["align-content: space-evenly"]);
	});
});
