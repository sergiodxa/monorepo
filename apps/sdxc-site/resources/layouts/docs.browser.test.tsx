/**
 * Tests the documentation shell against the real layout engine: at every width a reader
 * meets it the page never scrolls sideways, and the page's headings are always one tap away,
 * as a rail beside the prose or as a sticky bar under the header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { NavTree } from "~/app/services/navigation-tree";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** The header reads the platform from the request on the server; a browser has none. */
vi.doMock("@sdxc/user-agent/helpers", () => ({ isApplePlatform: () => true }));

/** The search dialog's results frame needs the page runtime; the closed dialog draws nothing. */
vi.doMock("remix/component", async (importOriginal) => ({
	...(await importOriginal<typeof import("remix/component")>()),
	Frame: () => () => null,
}));

const { default: DocsLayout } = await import("~/resources/layouts/docs");

/** A tree shaped like the component catalogue's, which is where the header crowded first. */
const TREE: NavTree = {
	label: "@sdxc/ui",
	href: "/api/ui",
	sections: [
		{
			title: "Components",
			entries: [
				{ title: "Announcement chip", href: "/api/ui/announcement-chip" },
				{ title: "Bento", href: "/api/ui/bento" },
			],
			groups: [],
		},
	],
};

/** Every width the shell is checked at, spanning the drawer, the docked tree and the rail. */
const WIDTHS = [320, 375, 414, 600, 768, 900, 1024, 1199, 1200, 1280, 1390, 1440, 1600, 1920];

/** The widths below the rail's breakpoint, where the headings fold into the sticky bar. */
const BAR_WIDTHS = [320, 375, 768, 1024, 1199];

/** The page's headings, one with a title long enough to need truncating in the bar. */
const ANCHORS = [
	{ id: "usage", text: "Usage", level: 2 },
	{ id: "props", text: "Props, and every variant a long section heading can describe", level: 2 },
	{ id: "slots", text: "Slots", level: 3 },
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	window.scrollTo(0, 0);
	await page.viewport(414, 896);
});

/**
 * Mounts a component page as `/api/ui/*` draws it: a long trail, an in-page rail, and a
 * scrolling preview wider than the prose, which is what pushed the rail off the page.
 */
function mountComponentPage() {
	mounted = render(
		<DocsLayout
			tree={TREE}
			activePath="/api/ui/bento"
			breadcrumbs={[
				{ label: "API", href: "/api" },
				{ label: "@sdxc/ui", href: "/api/ui" },
				{ label: "Marketing section with a long name" },
			]}
			anchors={ANCHORS}
		>
			<h1>Bento</h1>
			{ANCHORS.map((anchor) => (
				<h2 key={anchor.id} id={anchor.id} style={{ marginBlock: "40rem" }}>
					{anchor.text}
				</h2>
			))}
			<div style={{ overflowX: "auto" }}>
				<div style={{ inlineSize: "60rem" }}>A preview wider than the prose, which scrolls.</div>
			</div>
		</DocsLayout>,
	);
}

/** The phone bar the headings fold into. */
function bar(): HTMLDetailsElement {
	return mounted!.$('[data-slot="toc-bar"]') as HTMLDetailsElement;
}

/** The in-page list a reader can see, or `undefined` while none is drawn. */
function visibleOutline(): HTMLElement | undefined {
	let navs = [...mounted!.$$('nav[aria-label="On this page"]')] as HTMLElement[];
	return navs.find((nav) => nav.getBoundingClientRect().height > 0 && !nav.closest("details"));
}

/** How far the page reaches past the viewport's inline end, which is zero when it fits. */
function horizontalOverflow(): number {
	return document.documentElement.scrollWidth - window.innerWidth;
}

describe("DocsLayout", () => {
	test.each(WIDTHS)("fits a %ipx viewport without scrolling sideways", async (width) => {
		await page.viewport(width, 900);
		mountComponentPage();

		expect(horizontalOverflow()).toBeLessThanOrEqual(0);
	});

	test("drops the search shortcut hint on a phone", async () => {
		await page.viewport(320, 900);
		mountComponentPage();

		let hint = mounted!.$("header kbd") as HTMLElement;

		expect(getComputedStyle(hint).display).toBe("none");
	});

	test("keeps the in-page rail inside the viewport once it is drawn", async () => {
		await page.viewport(1280, 900);
		mountComponentPage();

		let rail = visibleOutline();

		expect(rail?.closest("details")).toBeNull();
		expect(rail!.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(rail!.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
		expect(bar().getBoundingClientRect().height).toBe(0);
	});

	test.each(BAR_WIDTHS)("folds the headings into a bar on a %ipx screen", async (width) => {
		await page.viewport(width, 900);
		mountComponentPage();

		let box = bar().getBoundingClientRect();

		expect(visibleOutline()).toBeUndefined();
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(window.innerWidth);
	});

	test("keeps the bar at the top of the screen while the page scrolls", async () => {
		await page.viewport(375, 900);
		mountComponentPage();

		window.scrollTo(0, 2000);

		await expect.poll(() => bar().getBoundingClientRect().top).toBe(0);
	});

	test("closes the bar once a reader jumps to a heading, and clears the heading of it", async () => {
		await page.viewport(375, 900);
		mountComponentPage();
		let details = bar();
		details.open = true;

		(details.querySelector('a[href="#props"]') as HTMLAnchorElement).click();

		await expect.poll(() => details.open).toBe(false);
		await expect
			.poll(() => document.getElementById("props")!.getBoundingClientRect().top)
			.toBeGreaterThanOrEqual(details.getBoundingClientRect().bottom);
	});
});
