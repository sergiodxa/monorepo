/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { overflowWrap } from "./overflow-wrap";

describe("overflowWrap", () => {
	test("no-arg defaults to break-word", async () => {
		expect(await declarations(overflowWrap())).toEqual(["overflow-wrap: break-word"]);
	});

	test("normal", async () => {
		expect(await declarations(overflowWrap("normal"))).toEqual(["overflow-wrap: normal"]);
	});

	test("anywhere", async () => {
		expect(await declarations(overflowWrap("anywhere"))).toEqual(["overflow-wrap: anywhere"]);
	});
});
