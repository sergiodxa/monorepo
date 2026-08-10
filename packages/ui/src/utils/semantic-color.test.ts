/**
 * Unit test for the shared semantic color union in
 * {@link "./semantic-color"}: a runtime check that the literal set every
 * component's own `Color` type resolves to is exactly the five tones this
 * module documents, so a change to the shared union surfaces here instead of
 * silently drifting from what each component's styling and `data-color`
 * contract actually handle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { SemanticColor } from "./semantic-color";

describe("SemanticColor", () => {
	test("is exactly the five semantic tones every component colors itself with", () => {
		let tones: readonly SemanticColor[] = ["brand", "neutral", "success", "warning", "danger"];

		expect(tones).toEqual(["brand", "neutral", "success", "warning", "danger"]);
	});
});
