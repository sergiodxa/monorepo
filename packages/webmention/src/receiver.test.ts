/**
 * Exercises the receiver: every rule a request is rejected by, the exact-link check,
 * the summary built from a source's microformats, and verification against a mocked
 * network, bounds and non-HTML sources included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { parse } from "@sdxc/microformats";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { accepted, linksTo, parseRequest, rejected, summarize, verify } from "./receiver.js";

import { WebmentionRequestError } from "./index.js";

/** What every verification in this file asks under. */
const AGENT = "ExampleReceiver/1.0 (+https://example.com/receiver)";

/** The post receiving mentions. */
const TARGET = new URL("https://example.com/articles/hello");

/** The page mentioning it. */
const SOURCE = new URL("https://ada.example.com/replies/1");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A form-encoded Webmention request, and the body the form middleware would have read. */
function request(
	fields: Record<string, string>,
	contentType = "application/x-www-form-urlencoded",
): [Request, FormData] {
	let formData = new FormData();
	for (let [name, value] of Object.entries(fields)) formData.set(name, value);
	let req = new Request("https://example.com/webmention", {
		method: "POST",
		headers: { "Content-Type": contentType },
		body: new URLSearchParams(fields),
	});
	return [req, formData];
}

/** Accepts mentions for posts on this origin only. */
function acceptsOwnPosts(target: URL): boolean {
	return target.origin === "https://example.com" && target.pathname.startsWith("/articles/");
}

/** A reply page carrying an `h-entry` with an author card. */
const REPLY = `<!doctype html>
<html><head><title>Ada's reply</title></head><body>
<article class="h-entry">
	<div class="p-author h-card"><a class="u-url p-name" href="https://ada.example.com/">Ada</a><img class="u-photo" src="/ada.jpg" alt=""></div>
	<a class="u-in-reply-to" href="https://example.com/articles/hello">In reply to</a>
	<div class="e-content">Great post! <script>alert(1)</script><a href="/more">more</a></div>
	<a class="u-url" href="/replies/1"><time class="dt-published" datetime="2026-09-20T10:00:00Z">Sep 20</time></a>
</article>
</body></html>`;

describe("parseRequest", () => {
	test("reads the pair from a valid request", async () => {
		let [req, formData] = request({ source: SOURCE.href, target: TARGET.href });

		let result = await parseRequest(req, { formData, accepts: acceptsOwnPosts });

		expect(isSuccess(result) && result.data).toEqual({ source: SOURCE, target: TARGET });
	});

	test.each([
		["media-type", { source: SOURCE.href, target: TARGET.href }, "application/json"],
		["missing", { target: TARGET.href }, undefined],
		["missing", { source: SOURCE.href, target: " " }, undefined],
		["invalid-url", { source: "ftp://ada.example.com/1", target: TARGET.href }, undefined],
		["invalid-url", { source: "http://127.0.0.1/1", target: TARGET.href }, undefined],
		["invalid-url", { source: "https://wiki.corp.internal/1", target: TARGET.href }, undefined],
		["invalid-url", { source: "https://ada.example/1", target: TARGET.href }, undefined],
		["invalid-url", { source: "https://u:p@ada.example.com/1", target: TARGET.href }, undefined],
		["invalid-url", { source: SOURCE.href, target: "/articles/hello" }, undefined],
		["invalid-url", { source: SOURCE.href, target: "mailto:someone@example.com" }, undefined],
		["same-url", { source: TARGET.href, target: TARGET.href }, undefined],
		[
			"target-not-accepted",
			{ source: SOURCE.href, target: "https://other.example.com/" },
			undefined,
		],
	] as const)("rejects with %s", async (reason, fields, contentType) => {
		let [req, formData] = request(fields, contentType);

		let result = await parseRequest(req, { formData, accepts: acceptsOwnPosts });

		expect(isFailure(result) && result.error.reason).toBe(reason);
	});

	test("awaits an asynchronous accepts check", async () => {
		let [req, formData] = request({ source: SOURCE.href, target: TARGET.href });

		let result = await parseRequest(req, { formData, accepts: async () => false });

		expect(isFailure(result) && result.error.reason).toBe("target-not-accepted");
	});

	test("reads a content type carrying parameters", async () => {
		let [req, formData] = request(
			{ source: SOURCE.href, target: TARGET.href },
			"application/x-www-form-urlencoded; charset=utf-8",
		);

		let result = await parseRequest(req, { formData, accepts: acceptsOwnPosts });

		expect(isSuccess(result)).toBe(true);
	});
});

describe("accepted and rejected", () => {
	test("accepted answers 202, with a status page when given", () => {
		expect(accepted().status).toBe(202);
		expect(accepted().headers.get("location")).toBeNull();
		expect(accepted("https://example.com/webmention/1").headers.get("location")).toBe(
			"https://example.com/webmention/1",
		);
	});

	test("rejected answers 400 with the reason as text", async () => {
		let response = rejected(new WebmentionRequestError("same-url", "Same URL."));
		expect(response.status).toBe(400);
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe("Same URL.");
	});
});

describe("linksTo", () => {
	/** Parses markup for the link check. */
	function tree(html: string) {
		return unwrap(parseDocument(html));
	}

	test.each([
		["an absolute href", `<a href="https://example.com/articles/hello">x</a>`],
		["a relative href", `<a href="/articles/hello">x</a>`],
		["an href with a fragment", `<a href="/articles/hello#comments">x</a>`],
		["an image src", `<img src="https://example.com/articles/hello">`],
		["a video poster", `<video poster="https://example.com/articles/hello"></video>`],
		["an object data", `<object data="https://example.com/articles/hello"></object>`],
		["a base href", `<base href="https://example.com/articles/"><a href="hello">x</a>`],
	])("finds %s", (_, html) => {
		expect(linksTo(tree(html), "https://example.com/elsewhere/page", TARGET)).toBe(true);
	});

	test.each([
		["a link in a comment", `<p>x</p><!-- <a href="/articles/hello">x</a> -->`],
		["escaped markup", `<code>&lt;a href="/articles/hello"&gt;</code>`],
		["the URL as text", `<p>https://example.com/articles/hello</p>`],
		["a longer URL", `<a href="/articles/hello-world">x</a>`],
		["a different query", `<a href="/articles/hello?x=1">x</a>`],
	])("ignores %s", (_, html) => {
		expect(linksTo(tree(html), "https://example.com/elsewhere/page", TARGET)).toBe(false);
	});
});

describe("summarize", () => {
	test("reads a reply's author, content, url and date", () => {
		let document = unwrap(parse(REPLY, SOURCE));
		let mention = summarize(document, SOURCE, TARGET);

		expect(mention.kind).toBe("reply");
		expect(mention.url).toBe("https://ada.example.com/replies/1");
		expect(mention.author).toEqual({
			name: "Ada",
			url: "https://ada.example.com/",
			photo: "https://ada.example.com/ada.jpg",
		});
		expect(mention.content?.text).toContain("Great post!");
		expect(mention.content?.html).toContain(`href="https://ada.example.com/more"`);
		expect(mention.content?.html).not.toContain("script");
		expect(mention.published?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
		expect(mention.name).toBeNull();
	});

	test.each([
		["like-of", "like"],
		["repost-of", "repost"],
		["bookmark-of", "bookmark"],
	])("reads %s as a %s", (property, kind) => {
		let html = `<div class="h-entry"><a class="u-${property}" href="${TARGET.href}">x</a></div>`;
		let mention = summarize(unwrap(parse(html, SOURCE)), SOURCE, TARGET);
		expect(mention.kind).toBe(kind);
	});

	test("names an article by its title", () => {
		let html = `<div class="h-entry"><h1 class="p-name">On Linking</h1>
			<div class="e-content">Some prose that links <a href="${TARGET.href}">here</a>.</div></div>`;
		let mention = summarize(unwrap(parse(html, SOURCE)), SOURCE, TARGET);
		expect(mention.kind).toBe("mention");
		expect(mention.name).toBe("On Linking");
	});

	test("falls back to the page title and representative card with no entry", () => {
		let html = `<div class="h-card"><a class="u-url u-uid p-name" href="${SOURCE.href}">Ada</a></div>
			<p><a href="${TARGET.href}">a link</a></p>`;
		let mention = summarize(unwrap(parse(html, SOURCE)), SOURCE, TARGET, "A Page");
		expect(mention).toEqual({
			kind: "mention",
			url: SOURCE.href,
			author: { name: "Ada", url: SOURCE.href, photo: null },
			content: null,
			name: "A Page",
			published: null,
		});
	});
});

describe("verify", () => {
	let pair = { source: SOURCE, target: TARGET };

	test("verifies a linking HTML source and summarizes it", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.html(REPLY)));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result) || result.data.status !== "linked") return;
		expect(result.data.mention.kind).toBe("reply");
		expect(result.data.finalUrl).toBe(SOURCE.href);
		expect(result.data.document.items[0]?.type).toEqual(["h-entry"]);
	});

	test("resolves relative links against the URL after redirects", async () => {
		server.use(
			http.get(SOURCE.href, () => HttpResponse.redirect("https://example.com/moved/", 301)),
			http.get("https://example.com/moved/", () =>
				HttpResponse.html(`<p><a href="../articles/hello">x</a></p>`),
			),
		);

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status).toBe("linked");
	});

	test("sends the user agent and asks for HTML", async () => {
		let headers: Headers | null = null;
		server.use(
			http.get(SOURCE.href, ({ request: req }) => {
				headers = req.headers;
				return HttpResponse.html(REPLY);
			}),
		);

		await verify(pair, { userAgent: AGENT });

		expect(headers!.get("user-agent")).toBe(AGENT);
		expect(headers!.get("accept")).toContain("text/html");
	});

	test("reports a 410 source as gone", async () => {
		server.use(http.get(SOURCE.href, () => new HttpResponse("Gone", { status: 410 })));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({ status: "gone" });
	});

	test.each([404, 403])("reports a %i source as unlinked", async (status) => {
		server.use(http.get(SOURCE.href, () => new HttpResponse(null, { status })));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({ status: "unlinked" });
	});

	test("reports a source that no longer links as unlinked", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.html(`<p>Nothing to see.</p>`)));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({ status: "unlinked" });
	});

	test("reports an image source as unlinked without reading it", async () => {
		server.use(
			http.get(SOURCE.href, () =>
				HttpResponse.arrayBuffer(new ArrayBuffer(8), { headers: { "Content-Type": "image/png" } }),
			),
		);

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data).toEqual({ status: "unlinked" });
	});

	test("links a JSON source holding the target as a string", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.json({ reply: { to: [TARGET.href] } })));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status).toBe("linked");
		if (!isSuccess(result) || result.data.status !== "linked") return;
		expect(result.data.mention.kind).toBe("mention");
		expect(result.data.mention.url).toBe(SOURCE.href);
	});

	test("reads a microformats JSON source like an HTML one", async () => {
		let body = {
			items: [{ type: ["h-entry"], properties: { "like-of": [TARGET.href], url: [SOURCE.href] } }],
			rels: {},
			"rel-urls": {},
		};
		server.use(http.get(SOURCE.href, () => HttpResponse.json(body)));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status === "linked" && result.data.mention.kind).toBe(
			"like",
		);
	});

	test("leaves a JSON source without the target unlinked", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.json({ text: "hello" })));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status).toBe("unlinked");
	});

	test("links a plain-text source containing the target", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.text(`Read ${TARGET.href} today.`)));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isSuccess(result) && result.data.status).toBe("linked");
	});

	test("reports a 5xx source as a retryable failure", async () => {
		server.use(http.get(SOURCE.href, () => new HttpResponse(null, { status: 502 })));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("refuses a redirect into a private host for good", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.redirect("http://10.0.0.1/", 302)));

		let result = await verify(pair, { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("refuses a body over the cap for good", async () => {
		server.use(http.get(SOURCE.href, () => HttpResponse.html(`<p>${"x".repeat(4096)}</p>`)));

		let result = await verify(pair, { userAgent: AGENT, maxBytes: 1024 });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("reports a source slower than the deadline as retryable", async () => {
		server.use(
			http.get(SOURCE.href, async () => {
				await delay(500);
				return HttpResponse.html(REPLY);
			}),
		);

		let result = await verify(pair, { userAgent: AGENT, timeoutMs: 20 });

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("stops a redirect chain at the limit", async () => {
		server.use(
			http.get("https://ada.example.com/loop/:n", ({ params }) =>
				HttpResponse.redirect(`https://ada.example.com/loop/${Number(params.n) + 1}`, 302),
			),
		);

		let result = await verify(
			{ source: new URL("https://ada.example.com/loop/0"), target: TARGET },
			{ userAgent: AGENT, maxRedirects: 2 },
		);

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});

	test("reports a source whose body breaks off mid-read as retryable", async () => {
		server.use(
			http.get(SOURCE.href, () => {
				let body = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(new TextEncoder().encode("<p>"));
						controller.error(new Error("connection reset"));
					},
				});
				return new HttpResponse(body, { headers: { "content-type": "text/html" } });
			}),
		);

		let result = await verify(pair, { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(true);
	});

	test("refuses a redirect to a reserved name for good", async () => {
		server.use(
			http.get(SOURCE.href, () => HttpResponse.redirect("https://admin.corp.internal/", 302)),
		);

		let result = await verify(pair, { userAgent: AGENT });

		expect(isFailure(result) && result.error.retryable).toBe(false);
	});
});
