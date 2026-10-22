/**
 * Covers the menu surface's concentric corners, read from the stylesheet it
 * emits: its padding and radius both derive from `--ui-surface-padding`, so
 * the surface's corners stay concentric with its `--ui-radius-md` rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vite-plus/test";

import { Menu } from "./menu.js";

describe("Menu", () => {
	test("rounds the surface as its rows' radius plus the padding between them", async () => {
		let html = await renderToString(
			<Menu id="actions" aria-label="Actions">
				<Menu.Item>Rename</Menu.Item>
			</Menu>,
		);

		expect(html).toContain("padding: var(--ui-surface-padding, 0.25rem)");
		expect(html).toContain(
			"border-radius: calc(var(--ui-radius-md, 0.375rem) + var(--ui-surface-padding, 0.25rem) + 1px)",
		);
	});
});
