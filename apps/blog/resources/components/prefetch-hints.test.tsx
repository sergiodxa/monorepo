/**
 * Tests the prefetch hints list pages render: the home timeline, a topic's listing and the
 * topic index each hint the first entries that link on-site, and the header hints its first
 * sections other than the current page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { TopicViewModel } from "~/app/http/view-models/topic";
import type { AppContext } from "~/app/initializers/router";
import type { FeedView } from "~/resources/views/feed";

import { blankSearchFrame } from "~/app/test/frames";
import { pageRenderer } from "~/app/test/renderer";
import { entryPrefetch, PREFETCHED_ENTRIES } from "~/resources/components/prefetch-hints";
import { FeedView as FeedPage } from "~/resources/views/feed";
import { TopicView } from "~/resources/views/topic";
import { TopicsView } from "~/resources/views/topics";
import routes from "~/routes/web";

const ENTRIES = 14;

const BOOKMARK_HREF = "https://example.com/saved";

/** Every `<link rel="prefetch">` target on the page, in document order. */
function prefetchHints(html: string) {
	return Array.from(html.matchAll(/<link rel="prefetch" href="([^"]+)"/g), (match) => match[1]);
}

/** A router serving pages the way production does, with the search dialog's frame mapped. */
function pageRouter() {
	let router = createRouter<AppContext>({ middleware: pageRenderer() });
	router.map(routes.searchFrame, blankSearchFrame);
	return router;
}

/** Requests one page from the router and reads its HTML. */
async function renderPage(router: ReturnType<typeof pageRouter>, path: string) {
	let response = await router.fetch(new Request(new URL(path, "https://blog.test")));
	return await response.text();
}

/** The timeline: an article per row, except a bookmark of another site third. */
function activity(): Array<FeedView.ActivityItem> {
	return Array.from({ length: ENTRIES }, (_, index) =>
		index === 2
			? {
					href: BOOKMARK_HREF,
					label: "Saved",
					date: "2026-01-01",
					preview: false,
					kind: "bookmark",
				}
			: {
					href: `/articles/entry-${index}`,
					label: `Entry ${index}`,
					date: "2026-01-01",
					preview: false,
					kind: "article",
				},
	);
}

/** The on-site entries among the first {@link PREFETCHED_ENTRIES}, the ones a list hints. */
function expectedEntries(hrefs: Array<string>) {
	return hrefs.slice(0, PREFETCHED_ENTRIES).filter((href) => href.startsWith("/"));
}

describe("entryPrefetch", () => {
	test("hints an on-site entry among the first ones", () => {
		expect(entryPrefetch(0, "/articles/a")).toBe("render");
		expect(entryPrefetch(PREFETCHED_ENTRIES - 1, "/articles/a")).toBe("render");
	});

	test("leaves later entries and other origins to load on navigation", () => {
		expect(entryPrefetch(PREFETCHED_ENTRIES, "/articles/a")).toBe("none");
		expect(entryPrefetch(0, BOOKMARK_HREF)).toBe("none");
		expect(entryPrefetch(0, "//example.com/a")).toBe("none");
	});
});

describe("list pages", () => {
	test("the home timeline hints its first on-site entries and two sections", async () => {
		let items = activity();
		let router = pageRouter();
		router.get("/", (ctx) => ctx.render(FeedPage, { activity: items }));
		let page = await renderPage(router, "/");

		expect(prefetchHints(page)).toEqual([
			"/articles",
			"/tutorials",
			...expectedEntries(items.map((item) => item.href)),
		]);
		expect(prefetchHints(page)).toHaveLength(2 + PREFETCHED_ENTRIES - 1);
	});

	test("a topic's listing hints its first entries and the sections it is not", async () => {
		let items: Array<TopicViewModel.Item> = Array.from({ length: ENTRIES }, (_, index) => ({
			type: "page",
			key: `page-${index}`,
			href: `/tutorials/entry-${index}`,
			label: `Entry ${index}`,
			date: "2026-01-01",
			preview: false,
		}));
		let model: TopicViewModel.Page = {
			title: "Tutorials",
			description: null,
			summary: "Tutorials",
			path: "/tutorials",
			feeds: { rss: "/tutorials.rss", atom: "/tutorials.atom", json: "/tutorials.json" },
			subscribeTo: "my tutorials",
			empty: "No tutorials yet.",
			items,
			entries: false,
		};
		let router = pageRouter();
		router.get("/tutorials", (ctx) => ctx.render(TopicView, model));
		let page = await renderPage(router, "/tutorials");

		expect(prefetchHints(page)).toEqual([
			"/",
			"/articles",
			...expectedEntries(items.map((item) => (item.type === "page" ? item.href : ""))),
		]);
	});

	test("the topic index hints its first topics", async () => {
		let topics = Array.from({ length: ENTRIES }, (_, index) => ({
			href: `/topics/topic-${index}`,
			title: `Topic ${index}`,
			summary: "",
		}));
		let router = pageRouter();
		router.get("/topics", (ctx) => ctx.render(TopicsView, { topics }));
		let page = await renderPage(router, "/topics");

		expect(prefetchHints(page)).toEqual([
			"/",
			"/articles",
			"/tutorials",
			...expectedEntries(topics.map((topic) => topic.href)),
		]);
	});
});
