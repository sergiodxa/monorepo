/**
 * Tests the `/privacy` controller: it renders the static Privacy Policy page inside
 * the shared document/marketing chrome for both anonymous and signed-in viewers, with
 * the `MarketingLayout` header CTA switching between the two, carries the Cloudflare
 * Turnstile disclosure and its link to Cloudflare's privacy addendum, and emits its
 * canonical URL and meta description in `<head>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import privacy from "./privacy";

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
 * Dispatches a real GET request to `/privacy` with the given signed-in state. Includes
 * the real `i18n` middleware (required by `getViewer()`'s downstream usage in the
 * shared chrome) backed by an empty test database.
 */
async function getPrivacy(viewer: Viewer | null) {
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
	router.map(routes.legal.privacy, privacy);

	let request = new Request(`https://uptime.test${routes.legal.privacy.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /privacy", () => {
	test("renders the Privacy Policy page for an anonymous visitor", async () => {
		let response = await getPrivacy(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Privacy Policy | Uptime</title>");
		expect(body).toContain("<h1>Privacy Policy</h1>");
		expect(body).toContain(`action="${routes.auth.action.href()}"`);
	});

	/** Canonical resolves through `SEO.baseUrl`, the product's own origin, no matter which host the request arrived on. */
	test("emits the canonical URL and meta description in <head>", async () => {
		let response = await getPrivacy(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.legal.privacy.href()}" />`,
		);
		expect(body).toContain(
			'<meta name="description" content="Privacy Policy for Uptime. Learn how we collect, use, and protect your data when using our uptime monitoring service." />',
		);
	});

	/** Cloudflare requires this disclosure before the Turnstile widget can run in invisible mode. */
	test("discloses Cloudflare Turnstile and links to its privacy addendum", async () => {
		let response = await getPrivacy(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<h2>9. Bot Protection</h2>");
		expect(body).toContain("protected by Cloudflare Turnstile");
		expect(body).toContain(
			'<a href="https://www.cloudflare.com/en-gb/turnstile-privacy-policy/" target="_blank" rel="noreferrer">Turnstile Privacy Addendum</a>',
		);
	});

	test("renders the Privacy Policy page for a signed-in viewer", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getPrivacy(viewer);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<h1>Privacy Policy</h1>");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});
});
