/**
 * Lays every page besides the landing out in a real browser — the homepage, the free
 * chapter's form and its reading view, the upgrade form and the 404 — at every width in both
 * schemes, holding each to the guarantees a reviewer checks by eye.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { Scheme } from "~/app/test/mount-page";

import {
	WIDTHS,
	contrastFailures,
	headingLevels,
	horizontalOverflow,
	overflowingElements,
} from "~/app/test/layout-audit";
import { imagesSettled, mountPage } from "~/app/test/mount-page";
import { BOOKS } from "~/config/books";
import { Product } from "~/config/products";
import { BOOK_COPY } from "~/resources/content/books";
import ChapterView from "~/resources/views/book/chapter";
import SampleOffer from "~/resources/views/book/sample-offer";
import UpgradeView from "~/resources/views/book/upgrade";
import HomeView from "~/resources/views/home";
import NotFoundView from "~/resources/views/not-found";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";

const BOOK = BOOKS["react-router-oauth2"];
const COPY = BOOK_COPY[BOOK.slug];
const LANDING = "/react-router-oauth2";

/** A chapter long enough to scroll, with nested sections, a list and a code fence. */
const CHAPTER_SOURCE = `Opening paragraph of the chapter, long enough to wrap across a line or two of the measure.

## First section

A paragraph with \`inline_code\` in it, and a list:

- One item
- Another item

### A subsection

\`\`\`ts
let authorizeUrl = new URL("https://auth.example.com/authorize?client_id=a-very-long-client-identifier");
\`\`\`

## Second section

The last paragraph.
`;

/** The fixture chapter with its headings anchored, as the sample-chapter service hands it over. */
function fixtureChapter() {
	let parsed = unwrap(Markdown.parse(CHAPTER_SOURCE, { frontmatter: s.object({}) }));
	let document = unwrap(Markdown.walk(parsed.document, highlight));
	let children = document.children.map((node) =>
		node.type === "heading"
			? {
					...node,
					attributes: {
						...node.attributes,
						id: `section-${node.level}-${node.position?.start.line}`,
					},
				}
			: node,
	);
	return toRemix({ ...document, children });
}

/** The pages under test, each as its controller composes it. */
const PAGES: Record<string, () => RemixNode> = {
	home: () => <HomeView title={BOOK.title} copy={COPY} subscribeAction="/api/subscribe" />,
	sample: () => (
		<Chrome>
			<SampleOffer
				copy={COPY}
				action={`${LANDING}/sample`}
				error={"Invalid email address. \nPlease try with another email address."}
			/>
		</Chrome>
	),
	chapter: () => (
		<Chrome>
			<ChapterView
				bookTitle={COPY.shortTitle}
				title="OAuth2 in Simple Terms"
				chapter={fixtureChapter()}
				sections={[
					{
						title: "First section",
						fragment: "section-2-3",
						sections: [{ title: "A subsection", fragment: "section-3-10" }],
					},
					{ title: "Second section", fragment: "section-2-16" },
				]}
				minutes={10}
				download="/sample/download?expires=1&signature=a"
				filename="oauth2-handbook-sample.epub"
				pricing={`${LANDING}#pricing`}
			/>
		</Chrome>
	),
	upgrade: () => (
		<Chrome>
			<UpgradeView
				from={COPY.packages[Product.Essentials] ?? never()}
				to={COPY.packages[Product.Complete] ?? never()}
				action={`${LANDING}/upgrade`}
			/>
		</Chrome>
	),
	"not found": () => (
		<Chrome>
			<NotFoundView landing={LANDING} copy={COPY} home="/" />
		</Chrome>
	),
};

/** The header and footer every book page wraps its `<main>` in. */
function Chrome(handle: { props: { children: RemixNode } }) {
	return () => (
		<>
			<BookHeader landing={LANDING} title={COPY.shortTitle} sample />
			{handle.props.children}
			<BookFooter
				landing={LANDING}
				title={COPY.shortTitle}
				tagline={BOOK.description}
				sample={`${LANDING}/sample`}
				upgrade={`${LANDING}/upgrade`}
			/>
		</>
	);
}

/** Fails a fixture whose copy lost a package the page needs. */
function never(): never {
	throw new Error("The book's copy is missing a package");
}

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

async function mount(name: string, scheme: Scheme = "light") {
	let render = PAGES[name] ?? never;
	mounted = await mountPage(render(), scheme);
	await imagesSettled(mounted.container);
	return mounted.container;
}

describe.each(Object.keys(PAGES))("the %s page", (name) => {
	for (let scheme of ["light", "dark"] as const) {
		test.each(WIDTHS)(`never scrolls sideways at %ipx (${scheme})`, async (width) => {
			await page.viewport(width, 900);
			let container = await mount(name, scheme);

			expect(overflowingElements(container)).toEqual([]);
			expect(horizontalOverflow()).toBe(0);
		});

		test.each([375, 1280])(
			`keeps every text run at WCAG contrast at %ipx (${scheme})`,
			async (width) => {
				await page.viewport(width, 900);
				let container = await mount(name, scheme);

				expect(contrastFailures(container)).toEqual([]);
			},
		);
	}

	test("has one h1, first, and never skips a heading level", async () => {
		let levels = headingLevels(await mount(name));

		expect(levels.filter((level) => level === 1)).toHaveLength(1);
		expect(levels[0]).toBe(1);
		for (let [index, level] of levels.entries()) {
			expect(level - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
		}
	});
});

describe("the email form", () => {
	test.each([
		["home", 768],
		["home", 1440],
		["sample", 1440],
		["upgrade", 1024],
	])("sets the field and its button on one line on the %s page at %ipx", async (name, width) => {
		await page.viewport(width, 900);
		let container = await mount(name);
		let field = container.querySelector("input[type='email']")?.getBoundingClientRect();
		let button = container.querySelector("button[type='submit']")?.getBoundingClientRect();

		expect(field && button).toBeTruthy();
		expect(Math.abs((field?.top ?? 0) - (button?.top ?? 1))).toBeLessThanOrEqual(1);
		expect(Math.abs((field?.height ?? 0) - (button?.height ?? 1))).toBeLessThanOrEqual(1);
	});
});

describe("the chapter", () => {
	test("lists its sections beside the text from a wide screen, at a reading measure", async () => {
		await page.viewport(1280, 900);
		let container = await mount("chapter");
		let navs = [...container.querySelectorAll("nav[aria-label='In this chapter']")].filter(
			(nav) => nav.getBoundingClientRect().width > 0,
		);
		let details = container.querySelector("details");
		let article = container.querySelector(
			"[data-slot='typeset'], .typeset, [data-preset='reading']",
		);

		expect(navs).toHaveLength(1);
		expect(details?.getBoundingClientRect().height).toBe(0);
		expect(navs[0]?.getBoundingClientRect().right).toBeLessThan(
			article?.getBoundingClientRect().left ?? 0,
		);
		expect(article?.getBoundingClientRect().width).toBeLessThanOrEqual(704);
	});

	test("folds its sections into a disclosure above the text on a phone", async () => {
		await page.viewport(375, 900);
		let container = await mount("chapter");
		let details = container.querySelector("details");
		let sideNav = [...container.querySelectorAll("nav[aria-label='In this chapter']")].find(
			(nav) => !nav.closest("details"),
		);

		expect(details?.getBoundingClientRect().height).toBeGreaterThan(0);
		expect(details?.open).toBe(false);
		expect(sideNav?.getBoundingClientRect().width).toBe(0);
	});

	test("links every listed section to a heading in the text", async () => {
		let container = await mount("chapter");
		let targets = [...container.querySelectorAll("nav a[href^='#']")].map((link) =>
			link.getAttribute("href")?.slice(1),
		);

		expect(targets.length).toBeGreaterThan(0);
		for (let id of targets)
			expect(container.querySelector(`[id='${id}']`)?.tagName).toMatch(/^H[23]$/);
	});

	test.each([
		[900, "sticky"],
		[600, "static"],
	])(
		"keeps the side contents still while scrolling, sticking only in a %ipx-tall window",
		async (height, position) => {
			await page.viewport(1280, height);
			let container = await mount("chapter");
			let sideNav = [...container.querySelectorAll("nav[aria-label='In this chapter']")].find(
				(nav) => !nav.closest("details"),
			);
			let style = getComputedStyle(sideNav ?? document.body);

			expect(style.position).toBe(position);
			expect(style.overflowY).toBe("visible");
			expect(style.maxBlockSize).toBe("none");
		},
	);
});
