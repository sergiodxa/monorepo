/**
 * Unit test for the shared semantic color union in
 * {@link "./semantic-color"}: checks that the literal set every component's
 * own `Color` type resolves to matches the five tones this module
 * documents, so a change to the shared union surfaces here before
 * components' `data-color` styling contracts drift from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { SemanticColor } from "./semantic-color";

describe("SemanticColor", () => {
	test("is exactly the five semantic tones every component colors itself with", () => {
		let tones: readonly SemanticColor[] = ["brand", "neutral", "success", "warning", "danger"];

		expect(tones).toEqual(["brand", "neutral", "success", "warning", "danger"]);
	});
});
