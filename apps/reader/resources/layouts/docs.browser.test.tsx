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
import { DocsPageHeader, NextSteps } from "@sdxc/ui";
import { DocsHub } from "@sdxc/ui/patterns";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import Feeds, { TOC } from "~/resources/docs/pages/en/feeds";
import GettingStarted from "~/resources/docs/pages/en/getting-started";
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

/** Mounts the quickstart, whose steps run straight into a tip, ending on its next pages. */
function mountQuickstart() {
	let { t } = translate("en");
	let card = (title: string) => ({
		title,
		href: "/docs/x",
		description: "Every post from every feed, newest first, narrowed and marked.",
	});
	mounted = render(
		<DocsLayout t={t} isSignedIn={false} activePath="/docs/getting-started">
			<GettingStarted t={t} figures={FIGURES} locale="en" />
			<NextSteps
				title="Up next"
				items={[
					card("Import from another reader"),
					card("Read your queue"),
					card("Keyboard shortcuts"),
				]}
			/>
		</DocsLayout>,
	);
}

/** Mounts the hub, whose chips and cards are lists the page's prose rules must leave alone. */
function mountHub() {
	let { t } = translate("en");
	let card = (title: string) => ({ title, href: "/docs/x", description: "One line about it." });
	mounted = render(
		<DocsLayout t={t} isSignedIn={false} activePath="/docs">
			<DocsHub
				title="How can we help?"
				start={[card("Start reading"), card("Import from another reader")]}
				topics={["Read your queue", "Search your posts", "Plans"].map((title) => ({
					title,
					href: "/docs/x",
				}))}
				sections={[card("Get started"), card("Read"), card("Find"), card("Fix a problem")]}
				labels={{ start: "Where should I start?", sections: "Browse by topic", topics: "Topics" }}
			/>
		</DocsLayout>,
	);
}

/** Every element a slot names inside the mounted shell. */
function slots(name: string): HTMLElement[] {
	return Array.from(document.querySelectorAll(`[data-slot="${name}"]`)) as HTMLElement[];
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

		let support = slot("docs-sidebar").querySelector('a[href="/support"]');

		expect(support?.textContent).toContain("Contact support");
	});

	test.each(["docs-hub-topic", "docs-hub-start-card", "docs-hub-section-card"])(
		"lines up every %s on one row at the same top and height",
		async (name) => {
			await page.viewport(1440, 900);
			mountHub();

			let boxes = slots(name).map((element) => element.getBoundingClientRect());
			let row = boxes.filter((box) => Math.abs(box.top - boxes[0]!.top) < 8);

			expect(row.length).toBeGreaterThan(1);
			for (let box of row) {
				expect(box.top).toBe(boxes[0]!.top);
				expect(box.height).toBe(boxes[0]!.height);
			}
		},
	);

	test("leaves a full gap between a list of steps and the tip after it", async () => {
		await page.viewport(1280, 900);
		mountQuickstart();

		let steps = slot("docs-prose").querySelector('[data-slot="steps"]')!.getBoundingClientRect();
		let tip = slot("docs-prose").querySelector('[data-slot="callout"]')!.getBoundingClientRect();

		expect(tip.top - steps.bottom).toBeGreaterThanOrEqual(20);
	});

	test("lines up the next-step cards and leaves their text unlinked-looking", async () => {
		await page.viewport(1440, 900);
		mountQuickstart();

		let cards = Array.from(slot("next-steps").querySelectorAll("li"));
		let tops = cards.map((card) => card.getBoundingClientRect().top);
		let link = cards[1]!.querySelector("a")!;

		expect(new Set(tops).size).toBe(1);
		expect(getComputedStyle(link).textDecorationLine).toBe("none");
	});

	test("starts the sidebar's support links where its page links start", async () => {
		await page.viewport(1280, 900);
		mountGuide();

		let sidebar = slot("docs-sidebar");
		let pageLink = sidebar.querySelector('a[href="/docs/feeds"]')!.getBoundingClientRect();
		let support = sidebar.querySelector('a[href="/support"]')!.getBoundingClientRect();

		expect(support.left).toBe(pageLink.left);
	});

	test("keeps two blocks in a row one gap apart, never doubling it", async () => {
		await page.viewport(1280, 900);
		let { t } = translate("en");
		mounted = render(
			<DocsLayout t={t} isSignedIn={false} activePath="/docs/feeds">
				<aside data-slot="first">One</aside>
				<div data-slot="docs-page-end">
					<aside data-slot="second">Two</aside>
				</div>
			</DocsLayout>,
		);

		let gap =
			slot("second").getBoundingClientRect().top - slot("first").getBoundingClientRect().bottom;

		expect(gap).toBe(20);
	});
});
