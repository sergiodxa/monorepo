/**
 * Tests the frame resolver in `app/http/render.tsx`: a frame that answers with content is
 * written into the page as it came, and one that does not leaves the note saying a piece
 * of the page is missing rather than the status line it failed with.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";
import type { Middleware } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { get, route } from "remix/routes";
import { describe, expect, test } from "vitest";

import i18n_ from "~/app/http/middleware/i18n";
import { isFrameRequest, resolveFrame } from "~/app/http/render";

/** The origin every test request is made against. */
const ORIGIN = "https://reader.test";

/** The routes a frame in these tests can point at: one that answers, and two that do not. */
const routes = route({
	content: get("/fragment"),
	broken: get("/broken"),
	thrown: get("/thrown"),
});

/** The dictionary the note is written in, resolved the way a request resolves one. */
async function dictionary(): Promise<i18n> {
	let resolved: i18n | null = null;

	let router = createRouter({ middleware: [asyncContext(), i18n_] });
	router.map(routes.content, (ctx) => {
		resolved = ctx.i18next;
		return new Response("ok");
	});

	await router.fetch(new Request(new URL(routes.content.href(), ORIGIN)));
	if (!resolved) throw new Error("the language middleware answers before a handler runs");

	return resolved;
}

/** A router answering each of the three frames a test can ask for. */
function frameRouter() {
	let router = createRouter({ middleware: [asyncContext() as Middleware] });

	router.map(routes.content, () => new Response("<p>the fragment</p>"));
	router.map(routes.broken, () => new Response("nope", { status: 500 }));
	router.map(routes.thrown, () => {
		throw new Error("the feed store is on fire");
	});

	return router;
}

/**
 * Resolves one frame as the renderer would.
 *
 * @param path - The frame's address.
 */
async function resolve(path: string): Promise<string> {
	let request = new Request(new URL("/reading", ORIGIN));
	return await resolveFrame(frameRouter(), request, await dictionary(), path);
}

describe("resolveFrame", () => {
	test("writes a frame that answered into the page as it came", async () => {
		expect(await resolve(routes.content.href())).toContain("<p>the fragment</p>");
	});

	test("answers a frame that failed with a note a reader can act on", async () => {
		let html = await resolve(routes.broken.href());

		expect(html).toContain("This part of the page did not load.");
		expect(html).toContain("Reload");
		/** Announced, since it stands where a reader was expecting something else. */
		expect(html).toContain('role="status"');
		/** And offering the page around it, which is what asking again means for a fragment. */
		expect(html).toContain(`href="${ORIGIN}/reading"`);
	});

	test("keeps the status it failed with off the page", async () => {
		let html = await resolve(routes.broken.href());

		/** Read as a reader reads it, since a generated class name holds all sorts of digits. */
		let words = html.replaceAll(/<style[\s\S]*?<\/style>/g, "").replaceAll(/<[^>]*>/g, "");

		expect(words).not.toContain("500");
		expect(words).not.toContain("Internal Server Error");
		expect(html).not.toContain("<pre>");
	});

	test("carries its own rules and opens no second document head", async () => {
		let html = await resolve(routes.broken.href());

		/** It is written into a page that has a head already, and a body may hold a style. */
		expect(html).not.toContain("<head>");
		expect(html).toContain("<style");
	});

	test("keeps a thrown message off the page too", async () => {
		let html = await resolve(routes.thrown.href());

		expect(html).toContain("This part of the page did not load.");
		expect(html).not.toContain("the feed store is on fire");
	});
});

describe("isFrameRequest", () => {
	test("reads a frame off the address a frame is asked for with", () => {
		expect(isFrameRequest(new Request(`${ORIGIN}/reading?frame=1`))).toBe(true);
		expect(isFrameRequest(new Request(`${ORIGIN}/reading`))).toBe(false);
	});

	test("reads one off the header the server's own resolver sends", () => {
		let request = new Request(`${ORIGIN}/reading`, { headers: { "x-remix-frame": "true" } });
		expect(isFrameRequest(request)).toBe(true);
	});
});
