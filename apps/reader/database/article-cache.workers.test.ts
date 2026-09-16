/**
 * Drives the shared article cache the way the app does: inside workerd, against the real
 * KV namespace this app binds, with the publishers standing behind MSW.
 *
 * What only the real store can show is asserted here — that two readers opening one link
 * cost one fetch and one entry, that the key is a digest naming nobody, that a failure is
 * remembered briefly and replaced when the site recovers, and that a page asking not to be
 * archived is read for whoever asked and kept for no one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { readArticle } from "~/app/lib/article";
import { articleKey, robotsKey } from "~/database/article-cache";

/** MSW server standing in for the origins the articles are published from. */
let server = setupServer();

/** What the reader already had, which every extraction here is measured against. */
const SUMMARY = "A sentence of excerpt.";

/** Prose long enough to score as an article and to beat the excerpt above. */
const BODY =
	"<p>The harbour was quiet that morning, and the boats, tied close together, barely moved against the stone wall.</p>".repeat(
		4,
	);

/** A page carrying an article, as a publisher serves one. */
function page(): string {
	return `<!doctype html><html><head><title>A Headline</title></head><body><article>${BODY}</article></body></html>`;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * A host no other test in this file uses. KV outlives a test and the whole point of the
 * cache is that one URL is one entry, so each test gets an origin of its own rather than
 * depending on the order the tests ran in.
 */
function origin(): string {
	return `https://${crypto.randomUUID()}.example.com`;
}

/** Serves an origin with no `robots.txt`, which permits everything. */
function noRobots(at: string) {
	return http.get(`${at}/robots.txt`, () => new HttpResponse(null, { status: 404 }));
}

describe("the shared article cache", () => {
	test("costs one fetch and one entry however many readers open the same link", async () => {
		let at = origin();
		let fetched = 0;

		server.use(
			noRobots(at),
			http.get(`${at}/post`, () => {
				fetched += 1;
				return HttpResponse.html(page());
			}),
		);

		let first = await readArticle({ url: `${at}/post`, summary: SUMMARY });
		let second = await readArticle({ url: `${at}/post`, summary: SUMMARY });

		expect(first.outcome).toBe("extracted");
		expect(second.outcome).toBe("extracted");
		expect(second.html).toBe(first.html);
		expect(fetched).toBe(1);

		let key = await articleKey(`${at}/post`);
		let stored = await env.KV.list({ prefix: "article:" });
		expect(stored.keys.filter((entry) => entry.name === key)).toHaveLength(1);
	});

	test("keys an entry by a digest of the URL, carrying no reader identifier", async () => {
		let url = `${origin()}/post`;
		let key = await articleKey(url);

		expect(key).toMatch(/^article:[\da-f]{64}$/u);
		expect(key).not.toContain(url);
		expect(key).not.toContain("example.com");
		expect(await articleKey(url)).toBe(key);
		expect(await articleKey(`${url}?other`)).not.toBe(key);
	});

	test("extracts again once the entry is gone, and writes it again", async () => {
		let at = origin();
		let fetched = 0;

		server.use(
			noRobots(at),
			http.get(`${at}/post`, () => {
				fetched += 1;
				return HttpResponse.html(page());
			}),
		);

		await readArticle({ url: `${at}/post`, summary: SUMMARY });

		/** What an entry past its TTL amounts to: KV expiry is the key ceasing to exist. */
		await env.KV.delete(await articleKey(`${at}/post`));

		let again = await readArticle({ url: `${at}/post`, summary: SUMMARY });

		expect(again.outcome).toBe("extracted");
		expect(fetched).toBe(2);
		expect(await env.KV.get(await articleKey(`${at}/post`))).not.toBeNull();
	});

	test("remembers a refusal, and replaces it when the site recovers", async () => {
		let at = origin();
		let refusing = true;

		server.use(
			noRobots(at),
			http.get(`${at}/post`, () => {
				if (refusing) return new HttpResponse(null, { status: 403 });
				return HttpResponse.html(page());
			}),
		);

		expect((await readArticle({ url: `${at}/post`, summary: SUMMARY })).outcome).toBe("refused");

		/** Read back rather than re-fetched, which is what stops a blocked site being retried. */
		refusing = false;
		expect((await readArticle({ url: `${at}/post`, summary: SUMMARY })).outcome).toBe("refused");

		await env.KV.delete(await articleKey(`${at}/post`));

		expect((await readArticle({ url: `${at}/post`, summary: SUMMARY })).outcome).toBe("extracted");
	});

	test("treats an extraction no longer than the excerpt as nothing to read", async () => {
		let at = origin();

		server.use(
			noRobots(at),
			http.get(`${at}/teaser`, () =>
				HttpResponse.html(
					`<!doctype html><html><body><article><p>Subscribe to read the rest of this.</p></article></body></html>`,
				),
			),
		);

		let article = await readArticle({
			url: `${at}/teaser`,
			summary: "A summary rather longer than the teaser the paywall left behind here.",
		});

		expect(article.outcome).toBe("empty");
		expect(article.html).toBeNull();
	});

	test("refuses a path the origin disallows, and remembers the origin's answer", async () => {
		let at = origin();
		let asked = 0;

		server.use(
			http.get(`${at}/robots.txt`, () => {
				asked += 1;
				return HttpResponse.text("User-agent: *\nDisallow: /private/");
			}),
			http.get(`${at}/private/post`, () => HttpResponse.html(page())),
			http.get(`${at}/open/post`, () => HttpResponse.html(page())),
		);

		expect((await readArticle({ url: `${at}/private/post`, summary: SUMMARY })).outcome).toBe(
			"refused",
		);
		expect((await readArticle({ url: `${at}/open/post`, summary: SUMMARY })).outcome).toBe(
			"extracted",
		);

		expect(asked).toBe(1);
		expect(await env.KV.get(robotsKey(at))).not.toBeNull();
	});

	test("reads a page asking not to be archived, and keeps it for nobody", async () => {
		let at = origin();
		let fetched = 0;

		server.use(
			noRobots(at),
			http.get(`${at}/post`, () => {
				fetched += 1;
				return HttpResponse.html(page(), { headers: { "x-robots-tag": "noarchive" } });
			}),
		);

		let article = await readArticle({ url: `${at}/post`, summary: SUMMARY });

		expect(article.outcome).toBe("extracted");
		expect(await env.KV.get(await articleKey(`${at}/post`))).toBeNull();

		await readArticle({ url: `${at}/post`, summary: SUMMARY });
		expect(fetched).toBe(2);
	});

	test("writes nothing into any reader's object", async () => {
		let at = origin();

		server.use(
			noRobots(at),
			http.get(`${at}/post`, () => HttpResponse.html(page())),
		);

		await readArticle({ url: `${at}/post`, summary: SUMMARY });

		let store = env.USER.get(env.USER.idFromName("01J0READER0000000000000000"));
		let entitlement = await store.entitlement();

		expect(entitlement.posts).toBe(0);
	});
});
