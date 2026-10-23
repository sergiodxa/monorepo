/**
 * Tests for {@link NavLink}: the anchor carries `data-rmx-prefetch` only for the
 * runtime's modes, and `"render"` adds a `<link rel="prefetch">` after it instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { NavLink } from "./nav-link.js";

describe(NavLink.name, () => {
	test("leaves prefetching off unless a mode is chosen", async () => {
		let html = await renderToString(<NavLink href="/settings">Settings</NavLink>);
		let none = await renderToString(
			<NavLink href="/settings" prefetch="none">
				Settings
			</NavLink>,
		);

		expect(html).toMatch(/<a [^>]*href="\/settings"[^>]*>Settings<\/a>/);
		expect(html).not.toContain("data-rmx-prefetch");
		expect(none).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain("<link");
		expect(none).not.toContain("<link");
	});

	test.each(["intent", "viewport"] as const)("prefetches on %s", async (prefetch) => {
		let html = await renderToString(
			<NavLink href="/settings" prefetch={prefetch}>
				Settings
			</NavLink>,
		);

		expect(html).toMatch(new RegExp(`<a [^>]*data-rmx-prefetch="${prefetch}"`));
		expect(html).not.toContain("<link");
	});

	test("renders a prefetch hint after the anchor on render", async () => {
		let html = await renderToString(
			<NavLink href="/settings" prefetch="render">
				Settings
			</NavLink>,
		);

		expect(html).toMatch(/Settings<\/a><link rel="prefetch" href="\/settings"/);
		expect(html).not.toContain("data-rmx-prefetch");
	});

	test("renders no prefetch hint without a destination", async () => {
		let html = await renderToString(
			<NavLink href="" prefetch="render">
				Settings
			</NavLink>,
		);

		expect(html).not.toContain("<link");
	});
});
