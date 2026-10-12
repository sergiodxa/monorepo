/**
 * Tests for {@link TagGroup.Remove}'s footprint: it renders through Button's icon-only
 * branch, whose fixed 2.5rem row measure used to stretch a ~24px pill to a full button
 * row. The control now resizes that measure, keeping Button's invisible pointer target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { TagGroup } from "./tag-group.js";

/**
 * Server-renders one dismissible tag, styles included.
 *
 * @returns The rendered markup with every emitted `<style>` block.
 */
async function renderDismissibleTag(): Promise<string> {
	return await renderToString(
		<TagGroup.Tag color="brand">
			Remote
			<TagGroup.Remove name="remove" value="remote" aria-label="Remove remote" />
		</TagGroup.Tag>,
	);
}

describe("TagGroup.Remove", () => {
	test("sizes the icon-only button from a custom property rather than a fixed 2.5rem row", async () => {
		let html = await renderDismissibleTag();

		expect(html).toContain("data-icon-only");
		expect(html).not.toMatch(/\sinline-size: 2\.5rem;/);
		expect(html).not.toMatch(/\sblock-size: 2\.5rem;/);
		expect(html).toContain("--ui-button-icon-size-md: var(--ui-tag-remove-size, 1rem);");
		expect(html).toContain("min-block-size: var(--ui-button-icon-size-md, 2.5rem);");
	});

	test("drops the padding a fixed-size glyph box has no room for", async () => {
		let html = await renderDismissibleTag();

		expect(html).toMatch(
			/&\[data-icon-only\] \{\s*padding: calc\(var\(--ui-spacing, 0\.25rem\) \* 0\);/,
		);
	});

	test("keeps a pointer target of --ui-target-size around the shrunken glyph", async () => {
		let html = await renderDismissibleTag();

		expect(html).toMatch(
			/&::after \{[^}]*position: absolute;[^}]*inline-size: var\(--ui-target-size, 1\.5rem\);/,
		);
	});
});
