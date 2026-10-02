/**
 * Tests for {@link "./sidebar"}, covering the rail slots a consumer holds
 * against the viewport: a header or footer that lets the rail's background
 * show through paints the scrolling nav behind it in plain sight, so each
 * slot's own paint is asserted over `renderToString`'s output, as is the drawer
 * staying hidden while closed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Sidebar } from "./sidebar.js";

describe("Sidebar.Header", () => {
	test("paints the surface it sits on rather than letting it show through", async () => {
		let html = await renderToString(<Sidebar.Header>sdxc</Sidebar.Header>);

		expect(String(html)).toMatch(/background-color:\s*inherit/);
	});
});

describe("Sidebar.Footer", () => {
	test("paints the surface it sits on rather than letting it show through", async () => {
		let html = await renderToString(<Sidebar.Footer>account</Sidebar.Footer>);

		expect(String(html)).toMatch(/background-color:\s*inherit/);
	});
});

describe("Sidebar.MobileNav", () => {
	test("lays the drawer out only while it is open, so a closed one stays hidden", async () => {
		let html = String(
			await renderToString(
				<Sidebar.MobileNav id="mobile-nav" aria-label="Main">
					nav
				</Sidebar.MobileNav>,
			),
		);
		let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
			.map((match) => match[1])
			.join("\n");

		let displays = css.match(/display:\s*flex/g) ?? [];
		let gated = css.match(/&\[open\]\s*\{\s*display:\s*flex/g) ?? [];

		expect(displays.length).toBeGreaterThan(0);
		expect(gated.length).toBe(displays.length);
	});
});
