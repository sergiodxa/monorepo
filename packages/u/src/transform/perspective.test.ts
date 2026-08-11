/**
 * Unit tests for `perspective()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { perspective } from "./perspective";

describe("perspective", () => {
	test("defaults to 800px", async () => {
		expect(await declarations(perspective())).toEqual(["perspective: 800px"]);
	});

	test("treats a bare number as pixels", async () => {
		expect(await declarations(perspective(400))).toEqual(["perspective: 400px"]);
	});

	test("treats zero as pixels", async () => {
		expect(await declarations(perspective(0))).toEqual(["perspective: 0px"]);
	});

	test("passes the none keyword through unchanged", async () => {
		expect(await declarations(perspective("none"))).toEqual(["perspective: none"]);
	});

	test("passes a raw string length through unchanged", async () => {
		expect(await declarations(perspective("50rem"))).toEqual(["perspective: 50rem"]);
	});
});
