/**
 * Covers the blog's WebSub publishing: feeds advertise the owner's hub only when one is set,
 * a write pings that hub with the global feed and the type's own feed, and a blog with no
 * hub, or a hub that refuses, leaves the write untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { PostTypeDefinition } from "../post-types/models/post-type.js";

import { PostType } from "../post-types/models/post-type.js";
import routes from "../routes.js";
import { Settings } from "../settings/models/settings.js";
import { database } from "../shared/middleware/database.js";
import { createTestDatabase } from "../shared/test/db.js";

import { feedRss } from "./controllers/rss.js";
import { advertiseHub, feedsFor, pingHub } from "./websub.js";

const HUB = "https://hub.test/";
const ORIGIN = "https://blog.example.com";

/** Every ping the hub received, as the `hub.url` topics it named. */
let pings: string[][] = [];

let server = setupServer(
	http.post(HUB, async ({ request }) => {
		let form = new URLSearchParams(await request.text());
		pings.push(form.getAll("hub.url"));
		return new HttpResponse(null, { status: 204 });
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	pings = [];
});
afterAll(() => server.close());

let db: Database;
let article: PostTypeDefinition;

beforeEach(async () => {
	({ db } = await createTestDatabase());
	let found = await PostType.findByName(db, "article");
	if (!found) throw new Error("The built-in article type is missing.");
	article = found;
});

describe("advertiseHub", () => {
	test("declares nothing for a blog without a hub", () => {
		expect(advertiseHub(null, `${ORIGIN}/rss.xml`)).toEqual({ atomLink: [], headers: {} });
	});

	test("declares the hub and the topic in the feed and the Link header", () => {
		let hub = advertiseHub(HUB, `${ORIGIN}/rss.xml`);

		expect(hub.atomLink).toEqual([
			{ rel: "self", href: `${ORIGIN}/rss.xml`, type: "application/rss+xml" },
			{ rel: "hub", href: HUB },
		]);
		expect(hub.headers).toEqual({
			link: `<${HUB}>; rel="hub", <${ORIGIN}/rss.xml>; rel="self"`,
		});
	});
});

describe("feedsFor", () => {
	test("names the global feed and a public type's own feed", () => {
		expect(feedsFor(ORIGIN, article)).toEqual([
			`${ORIGIN}/rss.xml`,
			`${ORIGIN}/${article.path}.rss`,
		]);
	});

	test("leaves out the feed of a type that is not public", () => {
		expect(feedsFor(ORIGIN, { ...article, visible: false })).toEqual([`${ORIGIN}/rss.xml`]);
	});
});

describe("pingHub", () => {
	test("pings nothing for a blog without a hub", async () => {
		await pingHub(db, ORIGIN, article);

		expect(pings).toEqual([]);
	});

	test("pings the owner's hub with the feeds the write changed", async () => {
		await Settings.set(db, "websub_hub", HUB);

		await pingHub(db, ORIGIN, article);

		expect(pings).toEqual([feedsFor(ORIGIN, article)]);
	});

	test("settles when the hub refuses the ping", async () => {
		await Settings.set(db, "websub_hub", HUB);
		server.use(http.post(HUB, () => new HttpResponse(null, { status: 500 })));

		await expect(pingHub(db, ORIGIN, article)).resolves.toBeUndefined();
	});
});

describe("GET /rss.xml", () => {
	/** Fetches the global feed through a router carrying the blog's database. */
	async function fetchFeed(): Promise<Response> {
		let router = createRouter({ middleware: [database(() => db)] });
		router.map(routes.rss, feedRss);
		return await router.fetch(new Request(`${ORIGIN}/rss.xml`));
	}

	test("advertises no hub until the owner sets one", async () => {
		let response = await fetchFeed();

		expect(response.headers.get("link")).toBeNull();
		expect(await response.text()).not.toContain('rel="hub"');
	});

	test("advertises the owner's hub in the Link header and the document", async () => {
		await Settings.set(db, "websub_hub", HUB);

		let response = await fetchFeed();

		expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
		expect(response.headers.get("link")).toBe(
			`<${HUB}>; rel="hub", <${ORIGIN}/rss.xml>; rel="self"`,
		);
		expect(await response.text()).toContain(`href="${HUB}"`);
	});
});
