/**
 * The document shell, which is where a reader's scheme has to be decided.
 *
 * Every assertion here is about the first response body rather than about what a page
 * settles into: a preference applied after the document has been painted is a white page
 * turning dark on every navigation, so the class, the `color-scheme` and the absence of any
 * script deciding either are what these check.
 *
 * The 404 handler is the page under test because it composes the shell and asks nothing of
 * a reader's storage, which makes it the smallest page this app renders.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import defaultHandler from "~/app/http/controllers/default-handler";
import { writePresentation } from "~/app/http/cookies";
import i18n from "~/app/http/middleware/i18n";
import presentation from "~/app/http/middleware/presentation";
import { createTestRenderer, ORIGIN } from "~/app/lib/test/controller";

/**
 * A page rendered through the middleware that decides how it is painted, carrying whatever
 * cookie the request was made with.
 *
 * @param cookie - The `Cookie` header to send, or nothing for a browser carrying none.
 */
async function render(cookie?: string): Promise<string> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			i18n,
			presentation,
			renderWith(createTestRenderer) as Middleware,
		],
		defaultHandler,
	});

	let response = await router.fetch(
		new Request(new URL("/nowhere", ORIGIN), { headers: cookie ? { cookie } : undefined }),
	);

	return await response.text();
}

/**
 * The scheme and the face the document opened with. The `mix` on `<html>` adds a generated
 * class beside the scheme's own, so the class is read as a list rather than as one word.
 *
 * @param html - The response body to read.
 */
function shell(html: string): { theme: string | undefined; face: string | null } {
	let tag = /<html[^>]*>/.exec(html)?.[0] ?? "";

	return {
		theme: /class="([^"]*)"/.exec(tag)?.[1]?.split(" ")[0],
		face: /data-face="([^"]*)"/.exec(tag)?.[1] ?? null,
	};
}

/** The `Cookie` header a browser holding this answer would send. */
async function cookieFor(theme: "system" | "light" | "dark", face: "sans" | "serif") {
	let header = await writePresentation({ theme, face });
	return header.split(";")[0] ?? "";
}

describe("DocumentLayout", () => {
	test("follows the reader's system when no cookie says otherwise", async () => {
		let html = await render();

		expect(shell(html)).toEqual({ theme: "system", face: "sans" });
		expect(html).toContain("color-scheme: light dark");
	});

	test("paints a stored dark in the first response body", async () => {
		let html = await render(await cookieFor("dark", "sans"));

		expect(shell(html).theme).toBe("dark");
		expect(html).toContain("color-scheme: only dark");
		expect(html).not.toContain("color-scheme: only light");
	});

	test("pins the browser's own chrome to a forced light", async () => {
		let html = await render(await cookieFor("light", "sans"));

		expect(shell(html).theme).toBe("light");
		expect(html).toContain("color-scheme: only light");
	});

	test("carries the reading face as an attribute nothing branches on", async () => {
		let html = await render(await cookieFor("system", "serif"));

		expect(shell(html).face).toBe("serif");
	});

	test("renders the defaults for a cookie holding something else entirely", async () => {
		let html = await render("reader:presentation=not-a-cookie");

		expect(shell(html)).toEqual({ theme: "system", face: "sans" });
	});

	/**
	 * The class is settled by the markup rather than by anything that runs, so there is no
	 * moment at which the page is painted in a scheme the reader did not choose.
	 */
	test("decides the scheme before the body, with no script deciding it", async () => {
		let html = await render(await cookieFor("dark", "serif"));

		expect(html.indexOf("<html")).toBeLessThan(html.indexOf("<body"));
		expect(shell(html).theme).toBe("dark");

		/** Every script on the page is a file this app serves, and none of them is inline. */
		expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
	});

	/** What bounds a publisher's host to the origin when this page fetches from it. */
	test("carries the referrer meta on every document", async () => {
		let html = await render();

		expect(html).toContain(`name="referrer"`);
		expect(html).toContain("strict-origin-when-cross-origin");
	});
});
