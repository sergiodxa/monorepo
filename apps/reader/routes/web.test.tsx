/**
 * Guards the one pair of routes that share a path: `/feeds/:feedId` is a `GET` for the
 * feed and a `DELETE` for unfollowing it. Each controller's own test maps one leaf alone,
 * so only a test that maps both can show that the pair still resolves — and that a browser
 * form, which can send nothing but `GET` and `POST`, reaches the `DELETE`.
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

/** Maps both leaves sharing `/feeds/:feedId`, in the order the real bootstrap maps them. */
function router() {
	let r = createRouter({
		middleware: [asyncContext(), formData() as Middleware, methodOverride()],
	});

	r.map(routes.feeds.show, () => new Response("SHOW"));
	r.map(routes.feeds.unfollow, () => new Response("UNFOLLOW"));
	return r;
}

test("a GET reaches the show controller", async () => {
	let res = await router().fetch(new Request("https://reader.test/feeds/feed_1"));
	expect(await res.text()).toBe("SHOW");
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
