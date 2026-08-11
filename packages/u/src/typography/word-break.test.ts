/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { wordBreak } from "./word-break";

describe("wordBreak", () => {
	test("no-arg defaults to normal", async () => {
		expect(await declarations(wordBreak())).toEqual(["word-break: normal"]);
	});

	test("break-all", async () => {
		expect(await declarations(wordBreak("break-all"))).toEqual(["word-break: break-all"]);
	});

	test("keep-all", async () => {
		expect(await declarations(wordBreak("keep-all"))).toEqual(["word-break: keep-all"]);
	});

	test("break-word", async () => {
		expect(await declarations(wordBreak("break-word"))).toEqual(["word-break: break-word"]);
	});
});
