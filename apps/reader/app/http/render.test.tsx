/**
 * Tests the app's rendering chain end to end: a page drawing a `<Frame>` through the router,
 * where a frame that answers with content is written into the page as it came, and one that
 * fails behind `frameFallback` leaves the note saying a piece of the page is missing rather
 * than the status line or message it failed with, inside a page that still arrives whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Frame } from "remix/component";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { get, route } from "remix/routes";
import { describe, expect, test } from "vitest";

import frameFallback from "~/app/http/middleware/frame-fallback";
import i18n from "~/app/http/middleware/i18n";
import { htmlRendering, isFrameRequest } from "~/app/http/render";

/** The origin every test request is made against. */
const ORIGIN = "https://reader.test";

/** The page drawing a frame, and the frames it can draw: one that answers, two that fail. */
const routes = route({
	page: get("/page"),
	content: get("/fragment"),
	broken: get("/broken"),
	thrown: get("/thrown"),
});

/** A whole error document, the kind of body a failed route answers a browser with. */
const ERROR_DOCUMENT =
	"<!DOCTYPE html><html><head><title>500</title></head><body><pre>Internal Server Error</pre></body></html>";

/**
 * A router serving a page that draws one blocking frame, named by the page's `src` query
 * parameter, and the three frames it can point at.
 */
function pageRouter() {
	let router = createRouter({
		middleware: [asyncContext() as Middleware, i18n, ...htmlRendering()],
	});

	router.map(routes.page, (ctx) =>
		ctx.render(
			<html lang="en">
				<head>
					<title>page</title>
				</head>
				<body>
					<main>
						<Frame src={ctx.url.searchParams.get("src") ?? routes.content.href()} />
					</main>
					<footer>the rest of the page</footer>
				</body>
			</html>,
		),
	);

	router.map(routes.content, (ctx) => ctx.render(<p>the fragment</p>));
	router.map(routes.broken, {
		middleware: [frameFallback],
		handler: () =>
			new Response(ERROR_DOCUMENT, {
				status: 500,
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
	});
	router.map(routes.thrown, {
		middleware: [frameFallback],
		handler() {
			throw new Error("the feed store is on fire");
		},
	});

	return router;
}

/**
 * Renders the page around the frame at `src`.
 *
 * @param src - The frame's address.
 */
async function renderPage(src: string): Promise<string> {
	let url = new URL(routes.page.href(), ORIGIN);
	url.searchParams.set("src", src);

	let response = await pageRouter().fetch(new Request(url));
	return await response.text();
}

/** The page's own body, between its tags, where a frame's markup lands. */
function body(html: string): string {
	return /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
}

/** The markup alone, without the renderer's flush markers. */
function withoutComments(html: string): string {
	return html.replaceAll(/<!--[\s\S]*?-->/g, "");
}

describe("a frame on a page", () => {
	test("writes a frame that answered into the page as it came", async () => {
		let html = await renderPage(routes.content.href());

		expect(body(html)).toContain("<p>the fragment</p>");
	});

	test("answers a frame that failed with a note a reader can act on", async () => {
		let html = await renderPage(routes.broken.href());

		expect(body(html)).toContain("This part of the page did not load.");
		expect(body(html)).toContain("Reload");
		/** Announced, since it stands where a reader was expecting something else. */
		expect(body(html)).toContain('role="status"');
		/** And offering the page around it, which is what asking again means for a fragment. */
		expect(html).toContain(`href="${ORIGIN}${routes.page.href()}?src=`);
	});

	test("keeps the status it failed with off the page", async () => {
		let html = await renderPage(routes.broken.href());

		/** Read as a reader reads it, since a generated class name holds all sorts of digits. */
		let words = html.replaceAll(/<style[\s\S]*?<\/style>/g, "").replaceAll(/<[^>]*>/g, "");

		expect(words).not.toContain("500");
		expect(words).not.toContain("Internal Server Error");
		expect(html).not.toContain("<pre>");
	});

	test("opens no second document inside the page", async () => {
		let html = await renderPage(routes.broken.href());

		expect(html.match(/<html/g)).toHaveLength(1);
		expect(html.match(/<body/g)).toHaveLength(1);
		expect(html).not.toContain("<title>500</title>");
	});

	test("keeps a thrown message off the page too, and the page arrives whole", async () => {
		let html = await renderPage(routes.thrown.href());

		expect(body(html)).toContain("This part of the page did not load.");
		expect(html).not.toContain("the feed store is on fire");
		expect(html).toContain("<footer>the rest of the page</footer>");
		expect(withoutComments(html).trimEnd()).toMatch(/<\/html>$/);
	});
});

describe("isFrameRequest", () => {
	test("reads a frame off the address a frame is asked for with", () => {
		expect(isFrameRequest(new Request(`${ORIGIN}/reading?frame=1`))).toBe(true);
		expect(isFrameRequest(new Request(`${ORIGIN}/reading`))).toBe(false);
	});

	test("reads one off the header the server's own renderer sends", () => {
		let request = new Request(`${ORIGIN}/reading`, { headers: { "x-remix-frame": "true" } });
		expect(isFrameRequest(request)).toBe(true);
	});
});
