/**
 * Tests for {@link "./sidebar"}, covering the rail slots a consumer holds
 * against the viewport: a header or footer that lets the rail's background
 * show through paints the scrolling nav behind it in plain sight, so each
 * slot's own paint is asserted over `renderToString`'s output, as is the drawer
 * staying hidden while closed and the markup each link prefetch mode writes.
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

describe("Sidebar", () => {
	test("declares its collapsed size after its open size, so collapsing wins and animates", async () => {
		let html = String(
			await renderToString(
				<Sidebar.Provider>
					<Sidebar collapsible="offcanvas">nav</Sidebar>
					<Sidebar.Inset>page</Sidebar.Inset>
				</Sidebar.Provider>,
			),
		);

		let open = html.indexOf("inline-size: var(--sidebar-width, 16rem)");
		let collapsed = html.search(
			/data-collapsible="offcanvas"\]\[data-side="left"\][^{]*\{[^}]*inline-size: 0/,
		);

		expect(open).toBeGreaterThan(-1);
		expect(collapsed).toBeGreaterThan(open);
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

describe("small sidebar controls", () => {
	test.each([
		["Sidebar.GroupAction", <Sidebar.GroupAction aria-label="Add">+</Sidebar.GroupAction>],
		["Sidebar.MenuAction", <Sidebar.MenuAction aria-label="Settings">…</Sidebar.MenuAction>],
		["Sidebar.Trigger", <Sidebar.Trigger id="toggle" aria-label="Toggle sidebar" />],
	])("%s grows its pointer target to the minimum target size", async (_, node) => {
		let html = String(await renderToString(node));

		expect(html).toContain("--ui-target-size");
		expect(html).toMatch(/position:\s*relative|position:\s*absolute/);
	});
});

describe("Sidebar.MenuLink prefetch", () => {
	test("writes neither the attribute nor a hint by default", async () => {
		let html = await renderToString(<Sidebar.MenuLink href="/next">Inbox</Sidebar.MenuLink>);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain('rel="prefetch"');
	});

	test.each(["intent", "viewport"] as const)(
		'writes data-rmx-prefetch="%s" on the anchor and renders no hint',
		async (mode) => {
			let html = await renderToString(
				<Sidebar.MenuLink href="/next" prefetch={mode}>
					Inbox
				</Sidebar.MenuLink>,
			);

			expect(html).toMatch(new RegExp(`<a[^>]*data-rmx-prefetch="${mode}"`));
			expect(html).not.toContain('rel="prefetch"');
		},
	);

	test('renders a prefetch hint after the anchor, without the attribute, for "render"', async () => {
		let html = await renderToString(
			<Sidebar.MenuLink href="/next" prefetch="render">
				Inbox
			</Sidebar.MenuLink>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).toMatch(/<\/a><link rel="prefetch" href="\/next"\s*\/?>/);
	});

	test('renders no hint for "render" when the anchor has no destination', async () => {
		let html = await renderToString(
			<Sidebar.MenuLink href="" prefetch="render">
				Inbox
			</Sidebar.MenuLink>,
		);

		expect(html).not.toContain('rel="prefetch"');
	});
});

describe("Sidebar.MenuSubLink prefetch", () => {
	test("writes neither the attribute nor a hint by default", async () => {
		let html = await renderToString(
			<Sidebar.MenuSubLink href="/next">Profile</Sidebar.MenuSubLink>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain('rel="prefetch"');
	});

	test.each(["intent", "viewport"] as const)(
		'writes data-rmx-prefetch="%s" on the anchor and renders no hint',
		async (mode) => {
			let html = await renderToString(
				<Sidebar.MenuSubLink href="/next" prefetch={mode}>
					Profile
				</Sidebar.MenuSubLink>,
			);

			expect(html).toMatch(new RegExp(`<a[^>]*data-rmx-prefetch="${mode}"`));
			expect(html).not.toContain('rel="prefetch"');
		},
	);

	test('renders a prefetch hint after the anchor, without the attribute, for "render"', async () => {
		let html = await renderToString(
			<Sidebar.MenuSubLink href="/next" prefetch="render">
				Profile
			</Sidebar.MenuSubLink>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(html).toMatch(/<\/a><link rel="prefetch" href="\/next"\s*\/?>/);
	});

	test('renders no hint for "render" when the anchor has no destination', async () => {
		let html = await renderToString(
			<Sidebar.MenuSubLink href="" prefetch="render">
				Profile
			</Sidebar.MenuSubLink>,
		);

		expect(html).not.toContain('rel="prefetch"');
	});
});
