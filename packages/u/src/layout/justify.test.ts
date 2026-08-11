/**
 * Unit tests for `justify()`'s default value, plain keywords, and the
 * `between`/`around`/`evenly` aliasing to their `space-*` CSS keywords.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { justify } from "./justify";

describe("justify", () => {
	test("defaults to start", async () => {
		expect(await declarations(justify())).toEqual(["justify-content: start"]);
	});

	test("passes a plain keyword through unchanged", async () => {
		expect(await declarations(justify("center"))).toEqual(["justify-content: center"]);
	});

	test("aliases between to space-between", async () => {
		expect(await declarations(justify("between"))).toEqual(["justify-content: space-between"]);
	});

	test("aliases around to space-around", async () => {
		expect(await declarations(justify("around"))).toEqual(["justify-content: space-around"]);
	});

	test("aliases evenly to space-evenly", async () => {
		expect(await declarations(justify("evenly"))).toEqual(["justify-content: space-evenly"]);
	});
});
