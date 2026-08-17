/**
 * Tests the `/trust` controller: it renders the trust page inside the shared
 * document/marketing chrome for both anonymous and signed-in viewers, emits its canonical
 * URL, names and links the person who operates the service, links the service's own status
 * page, and points at the Privacy Policy and Terms instead of restating them.
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

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { findClaimViolations } from "~/app/lib/public-claims";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import trust from "./trust";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
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
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			seedAuth(viewer),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trust, trust);

	let request = new Request(`https://uptime.test${routes.trust.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /trust", () => {
	test("renders the trust page for an anonymous visitor", async () => {
		let response = await getTrust(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<article");
		// Anonymous: the header CTA is a sign-in form posting to the auth action.
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
	});

	test("emits the canonical URL in <head>", async () => {
		let response = await getTrust(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		// Canonical is normalized onto the product's own origin, not the request host.
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
		expect(body).toContain(`<a href="${routes.legal.privacy.href()}">`);
		expect(body).toContain(`<a href="${routes.legal.terms.href()}">`);
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

	test("claims no availability percentage and no service level agreement", async () => {
		let response = await getTrust(null);

		let body = await response.text();
		let article = body.slice(body.indexOf("<article"), body.indexOf("</article>"));

		// An availability figure is a promise this service does not make anywhere — not as a
		// percentage, and not as the bare "99" that always introduces one.
		expect(article).not.toMatch(/\d+(?:[.,]\d+)?\s?%/);
		expect(article).not.toMatch(/\b99(?:[.,]\d+)?\b/);
		// The acronym only ever appears in copy offering one, which the Terms decline to do.
		expect(article).not.toMatch(/\bSLA\b/);
		// The page may say a region is *not* a guarantee; it may never make one.
		expect(article).not.toMatch(/\bguaranteed\b/i);
		expect(article).not.toMatch(/\bwe guarantee\b/i);
		expect(article).not.toMatch(/\buptime guarantee\b/i);
	});

	test("its copy passes the public-claims guard", () => {
		let source = readFileSync(new URL("./trust.tsx", import.meta.url), "utf8");

		expect(findClaimViolations(source)).toEqual([]);
	});
});
