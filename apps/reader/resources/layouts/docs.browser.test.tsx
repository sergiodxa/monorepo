/**
 * Holds the help shell to its reading contract at every width a reader brings: nothing
 * scrolls sideways, a wide table scrolls inside its own box, headings clearly outrank the
 * prose, the docs bar sits right under the site header, and the rail appears only where
 * there is room for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { DocsPageHeader } from "@sdxc/ui";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import Feeds, { TOC } from "~/resources/docs/pages/feeds";
import DocsLayout from "~/resources/layouts/docs";
import en from "~/resources/locales/en";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English copy, built here because the app's translator also wires the server logger. */
const translate = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
});

/** The figures a page quotes, as the server formats them; their values only fill the prose. */
const FIGURES: Record<string, string> = {
	freeFeeds: "20",
	paidFeeds: "200",
	premiumFeeds: "500",
	pollFloor: "15 minutes",
};

/** Every width the help pages are checked at, phone to wide desktop. */
const WIDTHS = [320, 375, 768, 1024, 1280, 1440];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the feeds guide, which carries steps, a scene and a table, inside the shell. */
function mountGuide() {
	let { t } = translate("en");
	mounted = render(
		<DocsLayout t={t} isSignedIn={false} activePath="/docs/feeds" toc={TOC}>
			<DocsPageHeader
				crumbs={[
					{ label: "Help", href: "/docs" },
					{ label: "Read" },
					{ label: "Follow and manage feeds" },
				]}
				title="Follow and manage feeds"
				description="Follow a site, check it now, choose how long its posts stay, or unfollow it."
			/>
			<Feeds t={t} figures={FIGURES} locale="en" />
		</DocsLayout>,
	);
}

/** The element a slot names inside the mounted shell. */
function slot(name: string): HTMLElement {
	let element = mounted!.$(`[data-slot="${name}"]`) as HTMLElement | null;
	if (!element) throw new Error(`No ${name} in the mounted shell`);
	return element;
}

describe("help shell", () => {
	test.each(WIDTHS)("scrolls nothing sideways at %ipx", async (width) => {
		await page.viewport(width, 900);
		mountGuide();

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test.each([320, 1440])(
		"keeps a wide table scrolling inside its own box at %ipx",
		async (width) => {
			await page.viewport(width, 900);
			mountGuide();

			let table = slot("docs-prose").querySelector("table")!;
			let box = table.getBoundingClientRect();

			expect(getComputedStyle(table).overflowX).toBe("auto");
			expect(box.right).toBeLessThanOrEqual(window.innerWidth);
		},
	);

	test("sets the body for reading and lets section headings outrank it", async () => {
		await page.viewport(1280, 900);
		mountGuide();

		let paragraph = slot("docs-prose").querySelector(":scope > p") as HTMLElement;
		let heading = slot("docs-prose").querySelector("h2") as HTMLElement;
		let body = Number.parseFloat(getComputedStyle(paragraph).fontSize);
		let leading = Number.parseFloat(getComputedStyle(paragraph).lineHeight) / body;

		expect(body).toBe(16);
		expect(leading).toBeGreaterThanOrEqual(1.6);
		expect(Number.parseFloat(getComputedStyle(heading).fontSize)).toBeGreaterThanOrEqual(
			body * 1.4,
		);
	});

	test("keeps the docs bar right under the site header while a phone scrolls", async () => {
		await page.viewport(375, 800);
		mountGuide();

		window.scrollTo(0, 1500);

		await expect.poll(() => slot("docs-bar").getBoundingClientRect().top).toBe(64);
	});

	test("draws the heading rail only where there is room beside the prose", async () => {
		await page.viewport(1440, 900);
		mountGuide();
		expect(slot("docs-rail").getBoundingClientRect().width).toBeGreaterThan(0);

		mounted?.cleanup();
		await page.viewport(1024, 900);
		mountGuide();
		expect(getComputedStyle(slot("docs-rail")).display).toBe("none");
	});

	test("pins a way to reach a person at the foot of the sidebar", async () => {
		await page.viewport(1280, 900);
		mountGuide();

		let support = slot("docs-sidebar").querySelector('a[href^="mailto:"]');

		expect(support?.textContent).toContain("Contact support");
	});
});
