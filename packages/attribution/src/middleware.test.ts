/**
 * Tests for `attribution()`: what it stores, when it writes, what it publishes as
 * `ctx.attribution`, and the requests it leaves alone. Requests carry the headers a browser
 * navigation sends unless a case is about a request that is not one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Attribution } from "./types.js";

import { attribution } from "./middleware.js";

const CHROME =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** The headers a browser sends when it loads a page. */
const NAVIGATION = { "User-Agent": CHROME, "Sec-Fetch-Dest": "document", Accept: "text/html" };

const DAY_MS = 24 * 60 * 60 * 1000;

/** A signed cookie store, as an app without a session configures one. */
function cookieStore() {
	return createCookie("attribution", { path: "/", httpOnly: true, secrets: ["s3cr3t"] });
}

/** What one request through the router answered, and what its handler saw. */
interface Outcome {
	response: Response;
	seen: Attribution | undefined;
	/** The `name=value` pair of a cookie the response set, for the next request to send. */
	cookie: string | null;
}

/** A router carrying `middleware`, whose every page answers HTML with `headers`. */
function app(middleware: Middleware[], headers: Record<string, string> = {}) {
	return async (
		url: string,
		init: { method?: string; headers?: Record<string, string> } = {},
	): Promise<Outcome> => {
		let seen: Attribution | undefined;
		let router = createRouter({ middleware });
		router.route("ANY", "/*path", (ctx) => {
			seen = ctx.attribution;
			return new Response("<p>ok</p>", { headers: { "Content-Type": "text/html", ...headers } });
		});
		let response = await router.fetch(
			new Request(url, { ...init, headers: { ...NAVIGATION, ...init.headers } }),
		);
		let setCookie = response.headers.get("Set-Cookie");
		return { response, seen, cookie: setCookie === null ? null : setCookie.split(";")[0]! };
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("cookie store", () => {
	test("records the first visit as both first and last touch", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let { response, seen, cookie } = await visit(
			"https://example.com/pricing?utm_source=newsletter&utm_medium=email",
		);

		expect(seen?.current?.channel).toBe("email");
		expect(seen?.first).toEqual(seen?.current);
		expect(seen?.last).toEqual(seen?.current);
		expect(cookie).toMatch(/^attribution=/);
		expect(response.headers.get("Cache-Control")).toBe("private");
	});

	test("keeps the campaign through a direct revisit, and writes nothing", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let landing = await visit("https://example.com/?utm_source=newsletter&utm_medium=email");
		let revisit = await visit("https://example.com/sample", {
			headers: { Cookie: landing.cookie!, Referer: "https://example.com/" },
		});

		expect(revisit.seen?.current?.channel).toBe("direct");
		expect(revisit.seen?.first?.utm?.source).toBe("newsletter");
		expect(revisit.seen?.last?.utm?.source).toBe("newsletter");
		expect(revisit.cookie).toBeNull();
		expect(revisit.response.headers.get("Cache-Control")).toBeNull();
	});

	test("moves the last touch to a new campaign and keeps the first", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let landing = await visit("https://example.com/?utm_source=newsletter");
		let second = await visit("https://example.com/?gclid=abc", {
			headers: { Cookie: landing.cookie!, Referer: "https://www.google.com/" },
		});

		expect(second.seen?.first?.utm?.source).toBe("newsletter");
		expect(second.seen?.last?.channel).toBe("paid-search");
		expect(second.cookie).not.toBeNull();
	});

	test("replaces a first touch older than the window", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.parse("2026-01-01T00:00:00Z"));
		let visit = app([attribution({ store: cookieStore(), window: "30 days" })]);
		let landing = await visit("https://example.com/?utm_source=old");

		vi.setSystemTime(Date.parse("2026-01-01T00:00:00Z") + 29 * DAY_MS);
		let within = await visit("https://example.com/", { headers: { Cookie: landing.cookie! } });
		expect(within.seen?.first?.utm?.source).toBe("old");

		vi.setSystemTime(Date.parse("2026-01-01T00:00:00Z") + 31 * DAY_MS);
		let after = await visit("https://example.com/later", { headers: { Cookie: landing.cookie! } });
		expect(after.seen?.first?.landingPath).toBe("/later");
		expect(after.seen?.last?.utm?.source).toBe("old");
	});

	test("reads a forged or malformed cookie as no record", async () => {
		let store = cookieStore();
		let visit = app([attribution({ store })]);

		let unsigned = await visit("https://example.com/", {
			headers: { Cookie: `attribution=${btoa(JSON.stringify({ first: null, last: null }))}` },
		});
		expect(unsigned.seen?.first?.landingPath).toBe("/");

		let malformed = await store.serialize(JSON.stringify({ first: { at: "yesterday" }, last: 1 }));
		let wrong = await visit("https://example.com/x", {
			headers: { Cookie: malformed.split(";")[0]! },
		});
		expect(wrong.seen?.first?.landingPath).toBe("/x");

		let notJson = await store.serialize("{");
		let broken = await visit("https://example.com/y", {
			headers: { Cookie: notJson.split(";")[0]! },
		});
		expect(broken.seen?.first?.landingPath).toBe("/y");
	});

	test("marks a cached response private when it sets the cookie", async () => {
		let visit = app([attribution({ store: cookieStore() })], {
			"Cache-Control": "public, max-age=60, s-maxage=600",
		});
		let { response } = await visit("https://example.com/?utm_source=x");
		expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
	});
});

describe("consent", () => {
	test("honors Global Privacy Control: publishes the current touch and stores nothing", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let { seen, cookie } = await visit("https://example.com/?utm_source=x", {
			headers: { "Sec-GPC": "1" },
		});

		expect(seen?.current?.utm?.source).toBe("x");
		expect(seen?.first).toBeNull();
		expect(seen?.last).toBeNull();
		expect(cookie).toBeNull();
	});

	test("expires a stored record when consent is withdrawn", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let landing = await visit("https://example.com/?utm_source=x");
		let { response, seen } = await visit("https://example.com/", {
			headers: { Cookie: landing.cookie!, "Sec-GPC": "1" },
		});

		expect(seen?.first).toBeNull();
		expect(response.headers.get("Set-Cookie")).toMatch(/Max-Age=0/i);
	});

	test("asks the app's own consent function", async () => {
		let visit = app([attribution({ store: cookieStore(), consent: () => false })]);
		let { cookie } = await visit("https://example.com/?utm_source=x");
		expect(cookie).toBeNull();
	});
});

describe("requests that are not a visitor loading a page", () => {
	test("a bot reads the stored record and writes nothing", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let { seen, cookie } = await visit("https://example.com/?utm_source=x", {
			headers: { "User-Agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
		});

		expect(seen).toEqual({ current: null, first: null, last: null });
		expect(cookie).toBeNull();
	});

	test("a form submission reads the stored record and writes nothing", async () => {
		let visit = app([attribution({ store: cookieStore() })]);
		let landing = await visit("https://example.com/?utm_source=newsletter");
		let { seen, cookie } = await visit("https://example.com/subscribe?utm_source=other", {
			method: "POST",
			headers: { Cookie: landing.cookie! },
		});

		expect(seen?.current).toBeNull();
		expect(seen?.first?.utm?.source).toBe("newsletter");
		expect(cookie).toBeNull();
	});

	test.each([
		["a fetch", { "Sec-Fetch-Dest": "empty" }, "GET"],
		["an image", { "Sec-Fetch-Dest": "image", Accept: "image/*" }, "GET"],
		["a HEAD probe", {}, "HEAD"],
	])("%s records nothing", async (_, headers, method) => {
		let visit = app([attribution({ store: cookieStore() })]);
		let { seen, cookie } = await visit("https://example.com/?utm_source=x", { method, headers });
		expect(seen?.current ?? null).toBeNull();
		expect(cookie).toBeNull();
	});

	test("a browser without Sec-Fetch-Dest is a navigation when it accepts HTML", async () => {
		let router = createRouter({ middleware: [attribution({ store: cookieStore() })] });
		let seen: Attribution | undefined;
		router.get("/", (ctx) => {
			seen = ctx.attribution;
			return new Response("ok");
		});
		await router.fetch(
			new Request("https://example.com/?utm_source=x", {
				headers: { "User-Agent": CHROME, Accept: "text/html,application/xhtml+xml" },
			}),
		);
		expect(seen?.current?.utm?.source).toBe("x");
	});
});

describe("redirect", () => {
	test("answers a campaign link with a 302 to the clean URL, setting the cookie on it", async () => {
		let visit = app([attribution({ store: cookieStore(), redirect: true })]);
		let { response, cookie } = await visit("https://example.com/post?p=1&utm_source=x&fbclid=y");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://example.com/post?p=1");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(cookie).toMatch(/^attribution=/);
	});

	test("redirects a bot too, without storing anything", async () => {
		let visit = app([attribution({ store: cookieStore(), redirect: true })]);
		let { response, cookie } = await visit("https://example.com/?utm_source=x", {
			headers: { "User-Agent": "facebookexternalhit/1.1" },
		});
		expect(response.status).toBe(302);
		expect(cookie).toBeNull();
	});

	test("serves a clean URL as is", async () => {
		let visit = app([attribution({ store: cookieStore(), redirect: true })]);
		let { response } = await visit("https://example.com/post?p=1");
		expect(response.status).toBe(200);
	});
});

describe("session store", () => {
	/** A session middleware over memory storage, as an app with anonymous sessions installs. */
	function sessionMiddleware(): Middleware {
		let cookie = createCookie("session", { path: "/", secrets: ["s3cr3t"] });
		return session(cookie, createMemorySessionStorage()) as Middleware;
	}

	test("keeps the record in the session across requests", async () => {
		let visit = app([sessionMiddleware(), attribution({ store: "session" })]);
		let landing = await visit("https://example.com/?utm_source=newsletter");
		let revisit = await visit("https://example.com/docs", { headers: { Cookie: landing.cookie! } });

		expect(revisit.seen?.first?.utm?.source).toBe("newsletter");
		expect(revisit.seen?.current?.channel).toBe("direct");
	});

	test("unsets the record when consent is withdrawn", async () => {
		let sessions: (Session | undefined)[] = [];
		let middleware = [sessionMiddleware(), attribution({ store: "session" })];
		let router = createRouter({ middleware });
		router.get("/*path", (ctx) => {
			sessions.push(ctx.get(Session));
			return new Response("ok");
		});

		let landing = await router.fetch(
			new Request("https://example.com/?utm_source=x", { headers: NAVIGATION }),
		);
		let cookie = landing.headers.get("Set-Cookie")!.split(";")[0]!;
		await router.fetch(
			new Request("https://example.com/", {
				headers: { ...NAVIGATION, Cookie: cookie, "Sec-GPC": "1" },
			}),
		);

		expect(sessions[1]?.has("attribution")).toBe(false);
	});

	test("publishes no stored touches on a route without a session", async () => {
		let visit = app([attribution({ store: "session" })]);
		let { seen } = await visit("https://example.com/?utm_source=x");
		expect(seen?.current?.utm?.source).toBe("x");
	});
});
