/**
 * Guards the routes whose patterns overlap, which no controller's own test can show
 * because each maps one leaf alone: `/reading/read` is a `POST` that clears the queue and
 * would otherwise read as a feed named `read` under `/reading/:feed`, and `/feeds/:feedId`
 * is a `DELETE` a browser form reaches through the method override, since a form can send
 * nothing but `GET` and `POST`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import routes from "~/routes/web";

/** Maps every overlapping leaf, in the order the real bootstrap maps them. */
function router() {
	let r = createRouter({
		middleware: [asyncContext(), formData() as Middleware, methodOverride()],
	});

	r.map(routes.reading, () => new Response("QUEUE"));
	r.map(routes.feed, () => new Response("FEED"));
	r.map(routes.readAll, () => new Response("READ ALL"));
	r.map(routes.feeds.unfollow, () => new Response("UNFOLLOW"));
	return r;
}

test("a GET under the queue reaches the feed controller", async () => {
	let res = await router().fetch(new Request("https://reader.test/reading/feed_1"));
	expect(await res.text()).toBe("FEED");
});

test("clearing the queue is a POST, and no feed named read takes it", async () => {
	let res = await router().fetch(
		new Request("https://reader.test/reading/read", { method: "POST" }),
	);
	expect(await res.text()).toBe("READ ALL");
});

test("a POST carrying the DELETE override reaches the unfollow controller", async () => {
	let res = await router().fetch(
		new Request("https://reader.test/feeds/feed_1", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ _method: "DELETE" }),
		}),
	);
	expect(await res.text()).toBe("UNFOLLOW");
});
