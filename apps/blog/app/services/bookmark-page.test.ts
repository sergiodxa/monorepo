/**
 * Reads mocked pages through the bookmark reader, so each outcome a check can reach is
 * pinned to the response that produces it, and a page that is up yields its own title
 * and description while a moved or refused one yields none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { BOOKMARK_USER_AGENT, isMove, readBookmarkPage } from "./bookmark-page";

/** A page declaring the headline and summary a bookmark is filled from. */
const PAGE = `<!doctype html><html><head><title>Window | Site</title>
<meta property="og:title" content="The Headline">
<meta property="og:description" content="What the page is about.">
</head><body><p>Body.</p></body></html>`;

/** The deadline every read in this file runs under. */
const TIMEOUT = 2_000;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every DNS-over-HTTPS lookup with `status`, as the resolver reports a name. */
function dns(status: number) {
	return http.get("https://cloudflare-dns.com/dns-query", () =>
		HttpResponse.json({ Status: status, Answer: [] }),
	);
}

describe("readBookmarkPage", () => {
	test("reads a page that is up, with its title and description", async () => {
		let agent: string | null = null;
		server.use(
			http.get("https://example.com/post", ({ request }) => {
				agent = request.headers.get("user-agent");
				return new HttpResponse(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
			}),
		);

		let reading = await readBookmarkPage("https://example.com/post", { timeout: TIMEOUT });

		expect(reading).toEqual({
			status: "ok",
			httpStatus: 200,
			finalUrl: "https://example.com/post",
			title: "The Headline",
			description: "What the page is about.",
		});
		expect(agent).toBe(BOOKMARK_USER_AGENT);
	});

	test("reads a redirect to https and a trailing slash as the same page", async () => {
		server.use(
			http.get("http://example.com/post", () =>
				HttpResponse.redirect("https://www.example.com/post/", 301),
			),
			http.get("https://www.example.com/post/", () =>
				HttpResponse.text("not a page", { headers: { "content-type": "text/plain" } }),
			),
		);

		let reading = await readBookmarkPage("http://example.com/post", { timeout: TIMEOUT });

		expect(reading.status).toBe("ok");
		expect(reading.finalUrl).toBe("https://www.example.com/post/");
		expect(reading.title).toBeNull();
	});

	test("reads a redirect to another host as moved, without its words", async () => {
		server.use(
			http.get("https://old-site.com/post", () =>
				HttpResponse.redirect("https://new-site.com/post", 301),
			),
			http.get("https://new-site.com/post", () =>
				HttpResponse.text(PAGE, { headers: { "content-type": "text/html" } }),
			),
		);

		let reading = await readBookmarkPage("https://old-site.com/post", { timeout: TIMEOUT });

		expect(reading).toEqual({
			status: "moved",
			httpStatus: 200,
			finalUrl: "https://new-site.com/post",
			title: null,
			description: null,
		});
	});

	test("reads a redirect from an article to the front page as moved", async () => {
		server.use(
			http.get("https://example.com/removed", () =>
				HttpResponse.redirect("https://example.com/", 302),
			),
			http.get("https://example.com/", () => HttpResponse.text("home")),
		);

		let reading = await readBookmarkPage("https://example.com/removed", { timeout: TIMEOUT });

		expect(reading.status).toBe("moved");
	});

	test("reads 404 and 410 as gone", async () => {
		server.use(
			http.get("https://example.com/missing", () => new HttpResponse(null, { status: 404 })),
			http.get("https://example.com/withdrawn", () => new HttpResponse(null, { status: 410 })),
		);

		let missing = await readBookmarkPage("https://example.com/missing", { timeout: TIMEOUT });
		let withdrawn = await readBookmarkPage("https://example.com/withdrawn", { timeout: TIMEOUT });

		expect([missing.status, withdrawn.status]).toEqual(["gone", "gone"]);
		expect(missing.httpStatus).toBe(404);
	});

	test("reads a refusal or a challenge as blocked, since it says nothing of the page", async () => {
		server.use(
			http.get("https://example.com/forbidden", () => new HttpResponse(null, { status: 403 })),
			http.get("https://example.com/limited", () => new HttpResponse(null, { status: 429 })),
			http.get(
				"https://example.com/challenge",
				() => new HttpResponse(null, { status: 503, headers: { "cf-mitigated": "challenge" } }),
			),
		);

		let statuses = await Promise.all(
			["forbidden", "limited", "challenge"].map(
				async (path) =>
					(await readBookmarkPage(`https://example.com/${path}`, { timeout: TIMEOUT })).status,
			),
		);

		expect(statuses).toEqual(["blocked", "blocked", "blocked"]);
	});

	test("reads a server error as flaky", async () => {
		server.use(http.get("https://example.com/down", () => new HttpResponse(null, { status: 502 })));

		let reading = await readBookmarkPage("https://example.com/down", { timeout: TIMEOUT });

		expect(reading.status).toBe("flaky");
	});

	test("reads a failed connection to a name that no longer exists as gone", async () => {
		server.use(
			http.get("https://expired-site.com/post", () => HttpResponse.error()),
			dns(3),
		);

		let reading = await readBookmarkPage("https://expired-site.com/post", { timeout: TIMEOUT });

		expect(reading).toEqual({
			status: "gone",
			httpStatus: null,
			finalUrl: null,
			title: null,
			description: null,
		});
	});

	test("reads a failed connection to a name that still resolves as flaky", async () => {
		server.use(
			http.get("https://example.com/post", () => HttpResponse.error()),
			http.get("https://cloudflare-dns.com/dns-query", ({ request }) => {
				let asksA = new URL(request.url).searchParams.get("type") === "A";
				return HttpResponse.json({
					Status: 0,
					Answer: asksA ? [{ name: "example.com", type: 1, TTL: 60, data: "93.184.215.14" }] : [],
				});
			}),
		);

		let reading = await readBookmarkPage("https://example.com/post", { timeout: TIMEOUT });

		expect(reading.status).toBe("flaky");
	});

	test("reads a redirect loop as gone", async () => {
		server.use(
			http.get("https://example.com/loop", () =>
				HttpResponse.redirect("https://example.com/loop", 302),
			),
		);

		let reading = await readBookmarkPage("https://example.com/loop", { timeout: TIMEOUT });

		expect(reading.status).toBe("gone");
	});
});

describe("isMove", () => {
	test("tells a new home from a new spelling of the same address", () => {
		let move = (from: string, to: string) => isMove(new URL(from), new URL(to));

		expect(move("http://example.com/a", "https://www.example.com/a/")).toBe(false);
		expect(move("https://example.com/", "https://example.com/")).toBe(false);
		expect(move("https://example.com/a", "https://example.org/a")).toBe(true);
		expect(move("https://example.com/a", "https://example.com/")).toBe(true);
		expect(move("https://example.com/a", "https://example.com/b")).toBe(false);
	});
});
