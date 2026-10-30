/**
 * Tests the documentation shell against the real layout engine: at every width a reader
 * meets it, from a phone to a wide desktop, the header row and the in-page rail stay inside
 * the viewport, so the page never scrolls sideways.
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
const WIDTHS = [320, 375, 768, 1024, 1200, 1280, 1390, 1440];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
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
			aside={<nav aria-label="On this page">On this page</nav>}
		>
			<h1>Bento</h1>
			<div style={{ overflowX: "auto" }}>
				<div style={{ inlineSize: "60rem" }}>A preview wider than the prose, which scrolls.</div>
			</div>
		</DocsLayout>,
	);
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

	test("keeps the in-page rail inside the viewport once it is drawn", async () => {
		await page.viewport(1280, 900);
		mountComponentPage();

		let rail = mounted!.$('nav[aria-label="On this page"]') as HTMLElement;

		expect(rail.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(rail.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
	});
});
