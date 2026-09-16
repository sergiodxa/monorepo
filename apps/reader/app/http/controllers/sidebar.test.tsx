/**
 * Tests `GET /sidebar/feeds`: the band the rail redraws on its own, now drawn under the
 * reader's folder names with the feeds filed nowhere below them, and each folder heading
 * carrying what the rows beneath it add up to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { CachedFeed } from "~/app/http/controllers/chrome";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import routes from "~/routes/web";

/**
 * The rail's own list, which is read from KV in production. Everything else in the module
 * is the real thing, so the grouping and the sums under test are the ones that ship.
 */
let railFeeds = vi.fn(async (_subject: string): Promise<CachedFeed[]> => []);

let chrome = await vi.importActual<typeof import("~/app/http/controllers/chrome")>(
	"~/app/http/controllers/chrome",
);

vi.doMock("~/app/http/controllers/chrome", () => ({ ...chrome, railFeeds }));

let { default: sidebar } = await import("./sidebar");

const TECH = { id: "01J0FOLDER00000000000000A1", title: "Tech" };

/**
 * One feed as the rail's cache holds it.
 *
 * @param title - The feed's name.
 * @param unreadCount - How many of its posts are waiting.
 * @param folder - The folder it is filed in, or nothing for an unfiled feed.
 */
function feed(
	title: string,
	unreadCount: number,
	folder?: { id: string; title: string },
): CachedFeed {
	return {
		id: `feed-${title}`,
		title,
		unreadCount,
		imageUrl: null,
		folderId: folder?.id ?? null,
		folderTitle: folder?.title ?? null,
	};
}

/** Requests the band the way the chrome fetches it. */
function getBand() {
	let router = createTestRouter(VIEWER);
	router.map(routes.sidebar.feeds, sidebar);
	return fetchRoute(router, routes.sidebar.feeds.href());
}

/** The copy a reader sees, with the markup carrying it stripped out. */
function readsAs(html: string): string {
	return html.replace(/<[^>]*>/g, " ");
}

beforeEach(() => {
	railFeeds.mockReset();
	railFeeds.mockResolvedValue([]);
});

describe("GET /sidebar/feeds", () => {
	test("draws each folder as a heading leading into its own stream", async () => {
		railFeeds.mockResolvedValue([feed("Rust Blog", 4, TECH), feed("Weekly", 7, TECH)]);

		let body = await (await getBand()).text();

		expect(body).toContain(`href="${routes.folder.href({ folder: TECH.id })}"`);
		expect(readsAs(body)).toContain("Tech");
		expect(body).toContain(`href="${routes.feed.href({ feed: "feed-Rust Blog" })}"`);
	});

	/** The heading's number is the rows beneath it added up, so the two cannot disagree. */
	test("heads a folder with what the feeds in it add up to", async () => {
		railFeeds.mockResolvedValue([feed("Rust Blog", 4, TECH), feed("Weekly", 7, TECH)]);

		let body = await (await getBand()).text();

		expect(readsAs(body)).toContain("11 unread");
	});

	test("draws the feeds filed nowhere under the heading that names them", async () => {
		railFeeds.mockResolvedValue([feed("Rust Blog", 4, TECH), feed("Loose", 1)]);

		let body = readsAs(await (await getBand()).text());

		expect(body).toContain("Feeds");
		expect(body).toContain("Loose");
	});

	test("draws no heading for a reader who follows nothing", async () => {
		let body = readsAs(await (await getBand()).text());

		expect(body).not.toContain("Feeds");
		expect(body).not.toContain("Tech");
	});
});
