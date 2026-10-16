/**
 * The session the page middleware loads, carried across requests by its cookie and kept in the
 * in-memory KV store tests receive as the `SESSIONS` binding.
 */

import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { sessionCookie, sessionStorage } from "~/app/initializers/session";

/** A router that counts each visitor's requests in their session. */
function createCounter() {
	let router = createRouter({ middleware: [session(sessionCookie, sessionStorage)] });
	router.get("/", (ctx) => {
		let count = Number(ctx.session.get("count") ?? 0) + 1;
		ctx.session.set("count", count);
		return Response.json({ count });
	});
	return router;
}

describe("session", () => {
	test("keeps a value from one request to the next", async () => {
		let router = createCounter();

		let first = await router.fetch("https://example.com/");
		let cookie = first.headers.get("set-cookie")?.split(";")[0] ?? "";
		let second = await router.fetch(new Request("https://example.com/", { headers: { cookie } }));

		expect(first.headers.get("set-cookie")).toContain("HttpOnly");
		expect(await second.json()).toEqual({ count: 2 });
	});
});
