/**
 * Holds the content vocabulary to its attribute schemas: a `feature` cell may name
 * every glyph the renderer draws, and a name outside that set fails the parse with
 * its line instead of rendering a cell without its glyph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { FEATURE_ICON_NAMES, readContent } from "~/app/services/content";

/** A one-cell grid naming the glyph under test. */
function featureNaming(icon: string): string {
	return `<feature-grid>\n<feature title="Cell" icon="${icon}">\nBody.\n</feature>\n</feature-grid>\n`;
}

describe("the feature tag's icon attribute", () => {
	test.each(FEATURE_ICON_NAMES)("accepts %s", (icon) => {
		expect(isFailure(readContent(featureNaming(icon)))).toBe(false);
	});

	test("rejects a glyph the renderer does not draw", () => {
		expect(isFailure(readContent(featureNaming("rocket")))).toBe(true);
	});
});
