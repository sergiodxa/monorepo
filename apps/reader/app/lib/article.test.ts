/**
 * Tests what reading an article does when the shared store will not answer. Everything a
 * cache can do wrong is absorbed where the value can be computed instead, so a reader gets
 * their article at the cost of a fetch rather than an apology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CacheError } from "@sdxc/cache";
import { failure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

/** Prose long enough to score as an article and to beat the excerpt below. */
const BODY =
	"<p>The harbour was quiet that morning, and the boats, tied close together, barely moved against the stone wall.</p>".repeat(
		4,
	);

/** What the reader already had, which an extraction has to beat to be worth anything. */
const SUMMARY = "A sentence of excerpt.";

/** What every call on a store nobody can reach answers with. */
function down(key: string): CacheError {
	return new CacheError("The store could not be reached", { code: "unavailable", key });
}

/** How many times the store was asked to hold something, which a failing store never does. */
let writes = 0;

/** A store that cannot be reached, which is what KV being down looks like to a caller. */
const UNREACHABLE = {
	async read() {
		return failure(down("article"));
	},
	async write() {
		writes += 1;
		return failure(down("article"));
	},
	async fetch(_key: string, load: () => Promise<unknown>) {
		await load();
		return failure(down("robots"));
	},
	async delete() {
		return failure(down("article"));
	},
};

vi.doMock("~/database/article-cache", () => ({
	ARTICLE_TTL: "7 days",
	FAILURE_TTL: "1 hour",
	ROBOTS_TTL: "24 hours",
	MAX_STORED_BYTES: 512 * 1024,
	articleCache: () => UNREACHABLE,
	articleKey: async (url: string) => `article:${url}`,
	robotsKey: (origin: string) => `robots:${origin}`,
}));

let { readArticle } = await import("./article");

let server = setupServer(
	http.get("https://example.com/robots.txt", () => new HttpResponse(null, { status: 404 })),
	http.get("https://example.com/post", () =>
		HttpResponse.html(`<!doctype html><html><body><article>${BODY}</article></body></html>`),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("with the shared store unreachable", () => {
	test("still answers the reader with an article, at the cost of a fetch", async () => {
		writes = 0;

		let article = await readArticle({ url: "https://example.com/post", summary: SUMMARY });

		expect(article.outcome).toBe("extracted");
		expect(article.html).toContain("The harbour was quiet");
		expect(writes).toBeGreaterThan(0);
	});
});
