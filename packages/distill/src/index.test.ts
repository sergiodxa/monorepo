/**
 * Exercises the bounds an arbitrary origin runs under and the judgement that finds
 * an article inside a template, against fixture markup and a mocked network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { distill, distillFrom, isAllowed } from "./index.js";

/** What every retrieval in this file asks under, since the caller always names one. */
const AGENT = "ExampleReader/1.0 (+https://example.com/reader)";

/** A page whose article sits among the furniture a template puts around it. */
function page(body: string, head = ""): string {
	return `<!doctype html><html><head><title>A Headline</title>${head}</head><body>${body}</body></html>`;
}

/** Prose long enough to score, repeated so a container clears the length threshold. */
const PARAGRAPH =
	"<p>The harbour was quiet that morning, and the boats, tied close together, barely moved against the stone.</p>";

const ARTICLE = `<article>${PARAGRAPH.repeat(4)}</article>`;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("distillFrom", () => {
	test("reads the article out of a page and leaves the furniture behind", () => {
		let source = page(`
			<nav><a href="/">Home</a><a href="/about">About</a></nav>
			${ARTICLE}
			<div class="related"><p>You might also like this other long piece we published.</p></div>
			<footer><p>Copyright somebody, all rights reserved, every year since forever.</p></footer>
		`);

		let article = distillFrom(source, "https://example.com/post");

		expect(isSuccess(article)).toBe(true);
		if (!isSuccess(article)) return;

		expect(article.data.html).toContain("The harbour was quiet");
		expect(article.data.html).not.toContain("You might also like");
		expect(article.data.html).not.toContain("all rights reserved");
		expect(article.data.html).not.toContain("About");
	});

	test("reports a shell page as carrying nothing to read", () => {
		let article = distillFrom(page(`<div id="root"></div>`), "https://example.com/post");

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("empty");
	});

	test("prefers the address the page calls its own", () => {
		let source = page(ARTICLE, `<link rel="canonical" href="https://example.com/canonical">`);
		let article = distillFrom(source, "https://example.com/post?utm_source=elsewhere");

		expect(isSuccess(article)).toBe(true);
		if (!isSuccess(article)) return;
		expect(article.data.url).toBe("https://example.com/canonical");
	});

	test("reads the headline and the byline the page declares", () => {
		let source = page(
			ARTICLE,
			`<meta property="og:title" content="The Quiet Harbour"><meta name="author" content="A Writer">`,
		);

		let article = distillFrom(source, "https://example.com/post");

		expect(isSuccess(article)).toBe(true);
		if (!isSuccess(article)) return;
		expect(article.data.title).toBe("The Quiet Harbour");
		expect(article.data.byline).toBe("A Writer");
	});

	test("counts the characters of readable text, which is what tells a teaser apart", () => {
		let teaser = distillFrom(
			page(`<article><p>${"Just a teaser sentence, and no more of it.".repeat(1)}</p></article>`),
			"https://example.com/teaser",
		);
		let full = distillFrom(page(ARTICLE), "https://example.com/post");

		expect(isSuccess(full)).toBe(true);
		if (!isSuccess(full)) return;
		expect(full.data.chars).toBeGreaterThan(isSuccess(teaser) ? teaser.data.chars : 0);
	});
});

describe("distill", () => {
	test("refuses a non-HTTP(S) URL, a literal IP host and localhost before any request", async () => {
		server.use(
			http.all("*", () => {
				throw new Error("nothing should reach the network");
			}),
		);

		for (let address of [
			"file:///etc/passwd",
			"http://127.0.0.1/admin",
			"http://192.168.1.1/",
			"http://localhost:8080/",
			"http://printer.local/",
		]) {
			let article = await distill(address, { userAgent: AGENT });

			expect(isFailure(article)).toBe(true);
			if (!isFailure(article)) return;
			expect(article.error.outcome).toBe("refused");
		}
	});

	test("reports a status the site says no with as a refusal", async () => {
		server.use(http.get("https://example.com/post", () => new HttpResponse(null, { status: 403 })));

		let article = await distill("https://example.com/post", { userAgent: AGENT });

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("refused");
	});

	test("refuses a redirect chain past five hops", async () => {
		server.use(
			http.get("https://example.com/:hop", ({ params }) => {
				let hop = Number(params.hop);
				return new HttpResponse(null, {
					status: 302,
					headers: { location: `https://example.com/${hop + 1}` },
				});
			}),
		);

		let article = await distill("https://example.com/0", { userAgent: AGENT });

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("timeout");
	});

	test("abandons a response past the size cap", async () => {
		server.use(
			http.get("https://example.com/huge", () =>
				HttpResponse.html(page(ARTICLE + "<p>padding</p>".repeat(5_000))),
			),
		);

		let article = await distill("https://example.com/huge", { userAgent: AGENT, maxBytes: 1024 });

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("timeout");
	});

	test("abandons a fetch past the timeout and reports it as an outcome", async () => {
		server.use(
			http.get("https://example.com/slow", async () => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return HttpResponse.html(page(ARTICLE));
			}),
		);

		let article = await distill("https://example.com/slow", { userAgent: AGENT, timeoutMs: 20 });

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("timeout");
	});

	test("sends no cookie and nothing identifying whoever asked", async () => {
		let seen: Headers | null = null;

		server.use(
			http.get("https://example.com/post", ({ request }) => {
				seen = request.headers;
				return HttpResponse.html(page(ARTICLE));
			}),
		);

		await distill("https://example.com/post", { userAgent: AGENT });

		expect(seen).not.toBeNull();
		let headers = seen as unknown as Headers;
		expect(headers.get("cookie")).toBeNull();
		expect(headers.get("authorization")).toBeNull();
		expect(headers.get("referer")).toBeNull();
		expect(headers.get("user-agent")).toBe(AGENT);
	});

	test("reports what a response other than a page carried as nothing to read", async () => {
		server.use(http.get("https://example.com/data", () => HttpResponse.json({ ok: true })));

		let article = await distill("https://example.com/data", { userAgent: AGENT });

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("empty");
	});

	test("says a response asking not to be archived may not be held", async () => {
		server.use(
			http.get("https://example.com/post", () =>
				HttpResponse.html(page(ARTICLE), { headers: { "x-robots-tag": "noarchive" } }),
			),
		);

		let article = await distill("https://example.com/post", { userAgent: AGENT });

		expect(isSuccess(article)).toBe(true);
		if (!isSuccess(article)) return;
		expect(article.data.mayCache).toBe(false);
	});

	test("refuses a path the origin's robots.txt disallows, without asking for it", async () => {
		server.use(
			http.get("https://example.com/private/post", () => {
				throw new Error("nothing should reach the network");
			}),
		);

		let article = await distill("https://example.com/private/post", {
			userAgent: AGENT,
			robots: "User-agent: *\nDisallow: /private/",
		});

		expect(isFailure(article)).toBe(true);
		if (!isFailure(article)) return;
		expect(article.error.outcome).toBe("refused");
	});
});

describe("isAllowed", () => {
	test("permits everything when an origin serves no document", () => {
		expect(isAllowed(null, "/anything", AGENT)).toBe(true);
	});

	test("reads the group naming the agent in place of the wildcard group", () => {
		let robots = "User-agent: *\nDisallow: /\n\nUser-agent: ExampleReader\nDisallow: /private/";

		expect(isAllowed(robots, "/post", AGENT)).toBe(true);
		expect(isAllowed(robots, "/private/post", AGENT)).toBe(false);
	});

	test("lets the longest matching rule decide", () => {
		let robots = "User-agent: *\nDisallow: /posts/\nAllow: /posts/public/";

		expect(isAllowed(robots, "/posts/secret", AGENT)).toBe(false);
		expect(isAllowed(robots, "/posts/public/one", AGENT)).toBe(true);
	});

	test("honours the wildcard and the end-of-path anchor", () => {
		let robots = "User-agent: *\nDisallow: /*.pdf$";

		expect(isAllowed(robots, "/files/report.pdf", AGENT)).toBe(false);
		expect(isAllowed(robots, "/files/report.pdf.html", AGENT)).toBe(true);
	});
});
