/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { whiteSpace } from "./white-space.js";

describe("whiteSpace", () => {
	test("no-arg defaults to pre-wrap", async () => {
		expect(await declarations(whiteSpace())).toEqual(["white-space: pre-wrap"]);
	});

	test("normal", async () => {
		expect(await declarations(whiteSpace("normal"))).toEqual(["white-space: normal"]);
	});

	test("nowrap", async () => {
		expect(await declarations(whiteSpace("nowrap"))).toEqual(["white-space: nowrap"]);
	});

	test("pre", async () => {
		expect(await declarations(whiteSpace("pre"))).toEqual(["white-space: pre"]);
	});

	test("pre-wrap", async () => {
		expect(await declarations(whiteSpace("pre-wrap"))).toEqual(["white-space: pre-wrap"]);
	});

	test("pre-line", async () => {
		expect(await declarations(whiteSpace("pre-line"))).toEqual(["white-space: pre-line"]);
	});

	test("break-spaces", async () => {
		expect(await declarations(whiteSpace("break-spaces"))).toEqual(["white-space: break-spaces"]);
	});
});
