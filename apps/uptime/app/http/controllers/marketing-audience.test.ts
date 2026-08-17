/**
 * Tests the `/for/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `audiences` record renders that page's content (200) along with its canonical URL and
 * `FAQPage` structured data, and an unknown slug renders the same not-found page the
 * router's `defaultHandler` uses (404).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

import i18n from "~/app/http/middleware/i18n";
import {
	BASE_PRICE_USD,
	formatPings,
	formatUsd,
	FREE_TRIAL_DAYS,
	INCLUDED_PINGS,
} from "~/app/lib/pricing";
import { createTestDatabase } from "~/app/lib/test/db";
import { audiences } from "~/resources/content/marketing";
import routes from "~/routes/web";

import marketingAudience from "./marketing-audience";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/for/:slug` as an anonymous visitor. */
async function getAudience(slug: string) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.marketing.audience, marketingAudience);

	let request = new Request(`https://uptime.test${routes.marketing.audience.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /for/:slug", () => {
	test("renders a real audience page", async () => {
		let slug = Object.keys(audiences)[0];
		if (!slug) throw new Error("expected at least one audience page");
		let content = audiences[slug]!;

		let response = await getAudience(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
	});

	test("advertises its canonical URL and FAQ structured data", async () => {
		let slug = Object.keys(audiences)[0];
		if (!slug) throw new Error("expected at least one audience page");
		let content = audiences[slug]!;

		let response = await getAudience(slug);

		let body = await response.text();
		// Canonical on the production origin, not the `uptime.test` host that served it.
		expect(body).toContain(`<link rel="canonical" href="https://uptime.sergiodxa.com/for/${slug}"`);
		if (content.faqs.length > 0) expect(body).toContain('"@type":"FAQPage"');
	});

	/**
	 * `/for/agencies` is the page personalized outreach links point at, so it is the one
	 * audience page whose content is pinned rather than sampled. What is asserted is what an
	 * agency has to be able to read without clicking further: the positioning, the free offer,
	 * the two "unlimited" facts that answer per-site pricing, and a way to start.
	 */
	test("the agency page carries its positioning, the free offer, and a CTA", async () => {
		let response = await getAudience("agencies");
		let body = await response.text();

		expect(response.status).toBe(200);

		// The positioning, which is the whole reason this page reads differently from the others.
		expect(body).toContain("before they call you");

		// The pricing objection an agency actually raises, answered in its own words.
		expect(body).toContain("Unlimited");
		expect(body).toContain(formatUsd(BASE_PRICE_USD));
		expect(body).toContain(formatPings(INCLUDED_PINGS));

		// The offer, stated with the same duration the trial actually runs for.
		expect(body).toContain(`${FREE_TRIAL_DAYS} days`);

		// And somewhere to go. The shared page chrome points its calls to action at `/try`, which
		// is where a visitor with no account can start without talking to anyone.
		expect(body).toContain(`href="${routes.trial.check.index.href()}"`);
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getAudience("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});
});
