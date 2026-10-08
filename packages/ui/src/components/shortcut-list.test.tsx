/**
 * Tests for the markup {@link ShortcutList} renders: a description list whose terms are
 * the actions and whose definitions hold one key cap per key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { ShortcutList } from "./shortcut-list.js";

describe(ShortcutList.name, () => {
	test("pairs each action with a cap per key, in press order", async () => {
		let html = await renderToString(
			<ShortcutList aria-label="Shortcuts">
				<ShortcutList.Item keys={["⌘", "K"]}>Open search</ShortcutList.Item>
				<ShortcutList.Item keys={["?"]}>Show shortcuts</ShortcutList.Item>
			</ShortcutList>,
		);

		expect(html).toMatch(/<dl[^>]*aria-label="Shortcuts"/);
		expect(html).toMatch(
			/<dt[^>]*>Open search<\/dt><dd[^>]*><kbd[^>]*>⌘<\/kbd><kbd[^>]*>K<\/kbd><\/dd>/,
		);
		expect(html).toMatch(/<dt[^>]*>Show shortcuts<\/dt><dd[^>]*><kbd[^>]*>\?<\/kbd><\/dd>/);
	});

	test("keeps a repeated key as two caps", async () => {
		let html = await renderToString(
			<ShortcutList>
				<ShortcutList.Item keys={["G", "G"]}>Go to the top</ShortcutList.Item>
			</ShortcutList>,
		);

		expect(html.match(/<kbd/g)).toHaveLength(2);
	});
});
