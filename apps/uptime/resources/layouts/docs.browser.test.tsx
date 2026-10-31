/**
 * Lays the docs shell out in a real browser inside the marketing chrome: the page header
 * keeps its distance from the body, the docked columns stay under the sticky site header,
 * the hub widens past the reading measure, and nothing scrolls sideways on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { DocsPageHeader, Typeset, UiLabel } from "@sdxc/ui";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { DocSection } from "~/app/services/docs";

import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
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

/** The marketing header's height in pixels, which every sticky column clears. */
const HEADER_HEIGHT = 64;

/** One section of two guides, enough to draw the sidebar. */
const SECTIONS: DocSection[] = [
	{
		title: "Getting Started",
		order: 1,
		docs: ["Introduction", "Quick Start Guide"].map((title, order) => ({
			path: `/docs/${order}`,
			frontmatter: {
				title,
				description: title,
				section: { title: "Getting Started", order: 1 },
				order,
				lastUpdated: undefined,
				notice: undefined,
				next: undefined,
				keywords: undefined,
			},
		})),
	},
];

/** Headings for the rail, enough to draw it. */
const ANCHORS = [
	{ id: "first", text: "First", level: 2 as const },
	{ id: "second", text: "Second", level: 2 as const },
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** The box of the one element `selector` matches, failing the test when nothing does. */
function rectOf(view: RenderResult, selector: string): DOMRect {
	let element = view.$(selector);
	if (!element) throw new Error(`Nothing matches ${selector}`);
	return element.getBoundingClientRect();
}

/** Mounts the shell around `children` with English labels. */
function mount(children: RemixNode, measure?: string, pageEnd?: RemixNode) {
	let { t } = translate("en");
	mounted = render(
		<DocsLayout
			isSignedIn={false}
			chrome={buildMarketingChrome(t)}
			sections={SECTIONS}
			activePath="/docs/0"
			labels={buildDocsLabels(t)}
			anchors={ANCHORS}
			measure={measure}
			pageEnd={pageEnd}
		>
			{children}
		</DocsLayout>,
	);
	return mounted;
}

describe("DocsLayout", () => {
	test("keeps the page header's last line apart from the body's first", async () => {
		await page.viewport(1280, 900);
		let view = mount(
			<article>
				<DocsPageHeader
					title="Add a monitor"
					description="Watch a URL."
					updated={{ label: "Last updated", date: "2026-10-31" }}
				/>
				<Typeset preset="docs">
					<p id="body">The first paragraph.</p>
				</Typeset>
			</article>,
		);

		let header = rectOf(view, '[data-slot="docs-page-header"]');
		let body = rectOf(view, "#body");

		expect(body.top - header.bottom).toBeGreaterThanOrEqual(32);
	});

	test("docks the sidebar and the rail below the sticky site header after a scroll", async () => {
		await page.viewport(1440, 900);
		let view = mount(
			<article>
				<h2 id="first">First</h2>
				<div style={{ blockSize: "3000px" }} />
				<h2 id="second">Second</h2>
			</article>,
		);
		window.scrollTo(0, 1200);
		await new Promise(requestAnimationFrame);

		let sidebar = rectOf(view, '[data-slot="docs-sidebar"]');
		let rail = rectOf(view, '[data-slot="docs-rail"]');

		expect(sidebar.top).toBeGreaterThanOrEqual(HEADER_HEIGHT);
		expect(rail.top).toBeGreaterThanOrEqual(HEADER_HEIGHT);
	});

	test("widens the article past the reading measure when a page asks", async () => {
		await page.viewport(1440, 900);
		let view = mount(<div id="hub" />, "64rem");

		let article = rectOf(view, '[data-slot="docs-article"]');

		expect(article.width).toBeGreaterThan(48 * 16);
	});

	test("scrolls a long code line inside its block on a 320px phone", async () => {
		await page.viewport(320, 700);
		mount(
			<article>
				<pre>
					<code>{"curl -X POST https://uptime.sergiodxa.com/api/v1/monitors/http ".repeat(4)}</code>
				</pre>
			</article>,
		);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});

	test("wraps a control chip longer than a 320px phone's line", async () => {
		await page.viewport(320, 700);
		mount(
			<Typeset preset="docs">
				<p>
					Pick <UiLabel>Team-wide (every monitor) alerts for the whole workspace</UiLabel>.
				</p>
			</Typeset>,
		);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});

	test("spaces the page end from the article and its blocks from each other", async () => {
		await page.viewport(1280, 900);
		let view = mount(
			<article id="article">
				<p>The last paragraph.</p>
			</article>,
			undefined,
			<>
				<div id="feedback">Was this page helpful?</div>
				<div id="next">Up next</div>
			</>,
		);

		let article = rectOf(view, "#article");
		let feedback = rectOf(view, "#feedback");
		let next = rectOf(view, "#next");

		expect(feedback.top - article.bottom).toBeGreaterThanOrEqual(40);
		expect(next.top - feedback.bottom).toBeGreaterThanOrEqual(32);
	});
});
