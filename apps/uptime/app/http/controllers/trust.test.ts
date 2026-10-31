/**
 * Tests the `/trust` controller: it renders the trust page inside the shared
 * document/marketing chrome for both anonymous and signed-in viewers, emits its canonical
 * URL, names and links the person who operates the service, links the service's own status
 * page, and links to the Privacy Policy and Terms as their single source of truth.
 *
 * It also guards the page's copy against the two claims it must never make: an availability
 * percentage or a service level agreement (the Terms decline to offer one, so a marketing
 * surface promising it would contradict the contract), and the pricing/social-proof
 * literals `findClaimViolations` scans every public surface for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { renderToString } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { SEO } from "~/app/initializers/seo";
import { findClaimViolations } from "~/app/services/public-claims";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { elementStyles } from "~/app/test/rendered-styles";
import routes from "~/routes/web";

import trust from "./trust";

/** Renders through `renderToString`, which suffices for a page built from plain HTML. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. */
function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

/**
 * Dispatches a real GET request to `/trust` with the given signed-in state. Includes the
 * real `i18n` middleware (required by the shared chrome) backed by an empty test database.
 */
async function getTrust(viewer: Viewer | null) {
	let { db } = createTestDatabase();

	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			seedAuth(viewer),
			i18n as Middleware,
			testAssets(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trust, trust);

	let request = new Request(`https://uptime.test${routes.trust.href()}`);
	return router.fetch(request);
}

describe("GET /trust", () => {
	test("renders the trust page for an anonymous visitor", async () => {
		let response = await getTrust(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<article");
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
	});

	test("emits the canonical URL in <head>", async () => {
		let response = await getTrust(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<link rel="canonical" href="${SEO.baseUrl}${routes.trust.href()}" />`);
	});

	test("names and links the person who operates the service", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		expect(body).toContain('<a href="https://sergiodxa.com" target="_blank" rel="noreferrer">');
	});

	test("links the service's own status page", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		expect(body).toContain(
			'<a href="https://uptime.sergiodxa.com/status/uptime" target="_blank" rel="noreferrer">',
		);
	});

	test("defers to the Privacy Policy and the Terms instead of restating them", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		expect(body).toContain(`<a href="${routes.legal.privacy.href()}" data-rmx-prefetch="intent">`);
		expect(body).toContain(`<a href="${routes.legal.terms.href()}" data-rmx-prefetch="intent">`);
	});

	/**
	 * All nine, by their rendered names rather than their key names: a page that lists eight of
	 * them is the failure worth catching, and asserting on keys would have gone on passing for a
	 * page whose copy had never been written.
	 */
	test("lists every region a check can run from", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		for (let region of [
			"Africa",
			"Asia-Pacific",
			"Eastern Europe",
			"Eastern North America",
			"Middle East",
			"Oceania",
			"South America",
			"Western Europe",
			"Western North America",
		]) {
			expect(body).toContain(region);
		}
	});

	/**
	 * Checks both the percentage form and the bare number, since "99" alone is the shorthand
	 * that always precedes an uptime claim; "SLA" and "guaranteed" get the same treatment
	 * because the Terms offer neither, so the copy may never use language that implies one.
	 */
	test("claims no availability percentage and no service level agreement", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		let article = body.slice(body.indexOf("<article"), body.indexOf("</article>"));

		expect(article).not.toMatch(/\d+(?:[.,]\d+)?\s?%/);
		expect(article).not.toMatch(/\b99(?:[.,]\d+)?\b/);
		expect(article).not.toMatch(/\bSLA\b/);
		expect(article).not.toMatch(/\bguaranteed\b/i);
		expect(article).not.toMatch(/\bwe guarantee\b/i);
		expect(article).not.toMatch(/\buptime guarantee\b/i);
	});

	/**
	 * The accountability cards are `h3`s, so their band needs an `h2` of its own: without one the
	 * outline jumped from the page's `h1` straight to the cards.
	 */
	test("never skips a heading level between the title and the cards", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		let main = body.slice(body.indexOf("<main"), body.indexOf("</main>"));
		let levels = [...main.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));

		expect(levels[0]).toBe(1);
		for (let index = 1; index < levels.length; index++) {
			expect(levels[index]! - levels[index - 1]!).toBeLessThanOrEqual(1);
		}
	});

	/**
	 * Nine regions fill a three-column grid exactly. An auto-filled grid fitted four across at a
	 * desktop width and left the ninth region alone on its own row.
	 */
	test("lays the nine regions three to a row on wider screens", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		let styles = elementStyles(body, 'data-slot="check-list"', body.indexOf('id="regions"')).join(
			"\n",
		);

		expect(styles).toMatch(
			/@container \(min-width: 40rem\)[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
		);
		expect(styles).not.toContain("auto-fill");
	});

	test("its copy passes the public-claims guard", () => {
		let source = readFileSync(new URL("./trust.tsx", import.meta.url), "utf8");

		expect(findClaimViolations(source)).toEqual([]);
	});
});
