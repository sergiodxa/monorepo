/**
 * Unit tests for `aspect()`'s width/height `aspect-ratio` pairing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { aspect } from "./aspect";

describe("aspect", () => {
	test("joins width and height into an aspect-ratio expression", async () => {
		expect(await declarations(aspect(16, 9))).toEqual(["aspect-ratio: 16 / 9"]);
	});

	test("resolves every named ratio", async () => {
		expect(await declarations(aspect("square"))).toEqual(["aspect-ratio: 1 / 1"]);
		expect(await declarations(aspect("video"))).toEqual(["aspect-ratio: 16 / 9"]);
		expect(await declarations(aspect("widescreen"))).toEqual(["aspect-ratio: 21 / 9"]);
		expect(await declarations(aspect("portrait"))).toEqual(["aspect-ratio: 3 / 4"]);
		expect(await declarations(aspect("story"))).toEqual(["aspect-ratio: 9 / 16"]);
		expect(await declarations(aspect("photo"))).toEqual(["aspect-ratio: 4 / 3"]);
	});

	test("the ratio survives the serializer as a bare pair, with no px appended", async () => {
		// `aspect-ratio` is unitless: the width/height pair is already a string
		// by the time it reaches the serializer, so its px-appending never sees
		// a bare number to corrupt.
		expect(await declarations(aspect(16, 9))).not.toContain("aspect-ratio: 16px / 9px");
	});
});
