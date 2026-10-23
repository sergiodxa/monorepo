/**
 * Tests for the markup each {@link NavigationMenu.Link} prefetch mode writes:
 * runtime-read modes land on the anchor as `data-rmx-prefetch`, and `"render"`
 * places a `<link rel="prefetch">` right after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { NavigationMenu } from "./navigation-menu.js";

describe("NavigationMenu.Link prefetch", () => {
	test("writes neither the attribute nor a hint by default", async () => {
		let html = await renderToString(<NavigationMenu.Link href="/next">Docs</NavigationMenu.Link>);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain('rel="prefetch"');
	});

	test.each(["intent", "viewport"] as const)(
		'writes data-rmx-prefetch="%s" on the anchor and renders no hint',
		async (mode) => {
			let html = await renderToString(
				<NavigationMenu.Link href="/next" prefetch={mode}>
					Docs
				</NavigationMenu.Link>,
			);

			expect(html).toMatch(new RegExp(`<a[^>]*data-rmx-prefetch="${mode}"`));
			expect(html).not.toContain('rel="prefetch"');
		},
	);

	test('renders a prefetch hint after the anchor, without the attribute, for "render"', async () => {
		let html = await renderToString(
			<NavigationMenu.Link href="/next" prefetch="render">
				Docs
			</NavigationMenu.Link>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).toMatch(/<\/a><link rel="prefetch" href="\/next"\s*\/?>/);
	});

	test('renders no hint for "render" when the anchor has no destination', async () => {
		let html = await renderToString(
			<NavigationMenu.Link href="" prefetch="render">
				Docs
			</NavigationMenu.Link>,
		);

		expect(html).not.toContain('rel="prefetch"');
	});
});
