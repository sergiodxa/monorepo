/**
 * Covers the WebSub side of a CMS write: a stored change pings the hub once with every
 * feed the route names, a read or a rejected form pings nothing, and the feeds advertise
 * the same hub in the document and the `Link` header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createRouter } from "remix/router";
import { get, post } from "remix/routes";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const HUB = "https://hub.test/";

/** Work the middleware handed to `waitUntil`, awaited before asserting. */
let pending: Array<Promise<unknown>> = [];

vi.doMock("cloudflare:workers", () => ({
	env: { WEBSUB_HUB: HUB },
	waitUntil: (promise: Promise<unknown>) => pending.push(promise),
}));

let { default: pingHubFor } = await import("./ping-hub");
let { advertiseHub } = await import("~/app/services/websub");

/** Every ping the hub received, as the `hub.url` topics it named. */
let pings: string[][] = [];

let server = setupServer(
	http.post(HUB, async ({ request }) => {
		let form = new URLSearchParams(await request.text());
		expect(form.get("hub.mode")).toBe("publish");
		pings.push(form.getAll("hub.url"));
		return new HttpResponse(null, { status: 204 });
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	pings = [];
	pending = [];
});
afterAll(() => server.close());

const FEED = get("/rss");
const ARTICLES_FEED = get("/articles.rss");

/** Sends one CMS-shaped request through the middleware and waits for its deferred ping. */
async function submit(method: "GET" | "POST", respond: () => Response) {
	let router = createRouter();
	let route = method === "GET" ? get("/cms/articles") : post("/cms/articles");
	router.map(route, { middleware: [pingHubFor(FEED, ARTICLES_FEED)], handler: respond });

	await router.fetch(new Request("https://sergiodxa.com/cms/articles", { method }));
	await Promise.all(pending);
}

describe("pingHubFor", () => {
	test("pings the hub with every feed the route names after a stored write", async () => {
		await submit(
			"POST",
			() => new Response(null, { status: 303, headers: { Location: "/cms/articles" } }),
		);

		expect(pings).toEqual([["https://sergiodxa.com/rss", "https://sergiodxa.com/articles.rss"]]);
	});

	test("stays quiet for a read", async () => {
		await submit("GET", () => new Response("index"));

		expect(pings).toEqual([]);
	});

	test("stays quiet when the form came back rejected", async () => {
		await submit("POST", () => new Response("invalid", { status: 422 }));

		expect(pings).toEqual([]);
	});

	test("keeps the response when the hub refuses the ping", async () => {
		server.use(http.post(HUB, () => new HttpResponse(null, { status: 500 })));
		let router = createRouter();
		router.map(post("/cms/articles"), {
			middleware: [pingHubFor(FEED)],
			handler: () => new Response(null, { status: 303, headers: { Location: "/cms" } }),
		});

		let response = await router.fetch(
			new Request("https://sergiodxa.com/cms/articles", { method: "POST" }),
		);
		await Promise.all(pending);

		expect(response.status).toBe(303);
	});
});

describe("advertiseHub", () => {
	test("declares the hub and the topic in the feed and in the Link header", () => {
		let hub = advertiseHub("https://sergiodxa.com/rss");

		expect(hub.hubUrl).toBe(HUB);
		expect(hub.atomLink).toEqual([
			{ rel: "self", href: "https://sergiodxa.com/rss", type: "application/rss+xml" },
			{ rel: "hub", href: HUB },
		]);
		expect(hub.headers.link).toBe(
			'<https://hub.test/>; rel="hub", <https://sergiodxa.com/rss>; rel="self"',
		);
	});
});
