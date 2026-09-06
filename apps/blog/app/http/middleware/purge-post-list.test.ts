/**
 * Covers the guarantee this middleware exists for: that a CMS write invalidates
 * the shared post-list tag without the action having to remember to, and that a
 * request which changed nothing does not purge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRecordingCache } from "@sdxc/workers-cache";
import workersCache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";
import { del, get, patch, post, put } from "remix/routes";
import { describe, expect, test } from "vitest";

import purgePostList from "./purge-post-list";

const PATH = "/cms/articles";

/** The CMS resource route for each method, built the way the route map builds it. */
const ROUTES = {
	GET: get(PATH),
	POST: post(PATH),
	PUT: put(PATH),
	PATCH: patch(PATH),
	DELETE: del(PATH),
};

/**
 * Routes one CMS-shaped request through the real cache middleware, so the purge
 * is observed where production observes it: on the cache the middleware holds.
 */
async function submit(method: keyof typeof ROUTES, respond: () => Response) {
	let cache = createRecordingCache();
	let router = createRouter({ middleware: [workersCache({ cache: () => cache })] });

	router.map(ROUTES[method], { middleware: [purgePostList], handler: respond });

	await router.fetch(new Request(`https://blog.test${PATH}`, { method }));

	return cache;
}

/** The See Other every CMS mutation answers with once the write landed. */
function redirected() {
	return new Response(null, { status: 303, headers: { Location: "/cms/articles" } });
}

describe("the CMS post-list purge", () => {
	test("runs for a write the action never asked to purge", async () => {
		let cache = await submit("POST", redirected);

		expect(cache.purgedTags).toEqual(["posts"]);
	});

	test.each(["PUT", "PATCH", "DELETE"] as const)("runs for %s too", async (method) => {
		let cache = await submit(method, redirected);

		expect(cache.purgedTags).toEqual(["posts"]);
	});

	test("stays quiet for a read", async () => {
		let cache = await submit("GET", () => new Response("index"));

		expect(cache.purges).toEqual([]);
	});

	test("stays quiet when the form came back rejected", async () => {
		let cache = await submit("POST", () => new Response("invalid", { status: 422 }));

		expect(cache.purges).toEqual([]);
	});
});
