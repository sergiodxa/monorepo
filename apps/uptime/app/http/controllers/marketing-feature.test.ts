/**
 * Tests the `/features/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `features` record renders that page's content (200) along with its canonical URL and
 * `SoftwareApplication`/`FAQPage` structured data, and an unknown slug renders the same
 * not-found page the router's `defaultHandler` uses (404). Every page's steps sit beside a
 * mockup, code stage, diagram or scene of its own, under band titles no other page shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { features } from "~/resources/content/marketing";
import de from "~/resources/locales/de";
import en from "~/resources/locales/en";
import es from "~/resources/locales/es";
import fr from "~/resources/locales/fr";
import it from "~/resources/locales/it";
import ja from "~/resources/locales/ja";
import routes from "~/routes/web";

import marketingFeature from "./marketing-feature";

/** Each feature page's band titles, keyed by slug, as English declares them. */
type FeatureBands = typeof en.landing.marketingPage.featureBands;

const LOCALES = { en, es, de, fr, it, ja };

/** `text` as the renderer escapes it inside an element or attribute. */
function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#x27;");
}

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/features/:slug` as an anonymous visitor. */
async function getFeature(slug: string) {
	let { db } = createTestDatabase();

	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			i18n as Middleware,
			testAssets(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.marketing.feature, marketingFeature);

	let request = new Request(`https://uptime.test${routes.marketing.feature.href({ slug })}`);
	return router.fetch(request);
}

describe("GET /features/:slug", () => {
	test("renders a real feature page", async () => {
		let slug = Object.keys(features)[0];
		if (!slug) throw new Error("expected at least one feature page");
		let content = features[slug]!;

		let response = await getFeature(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
	});

	test("advertises its canonical URL and structured data", async () => {
		let slug = Object.keys(features)[0];
		if (!slug) throw new Error("expected at least one feature page");
		let content = features[slug]!;

		let response = await getFeature(slug);

		let body = await response.text();
		expect(body).toContain(
			`<link rel="canonical" href="https://uptime.sergiodxa.com/features/${slug}"`,
		);
		expect(body).toContain('"@type":"SoftwareApplication"');
		if (content.faqs.length > 0) expect(body).toContain('"@type":"FAQPage"');
	});

	test.each(Object.keys(features))(
		"shows a product visual beside the %s page's steps",
		async (slug) => {
			let response = await getFeature(slug);

			let body = await response.text();
			let band = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));
			expect(band).toContain(features[slug]!.steps[0]!.title);
			expect(band).toMatch(/role="img"|data-variant="code"|<ol[^>]*aria-label=/);
		},
	);

	test.each(Object.keys(features))(
		"titles the %s page's bands with its own claims",
		async (slug) => {
			let titles = en.landing.marketingPage.featureBands[slug as keyof FeatureBands];

			let response = await getFeature(slug);

			let body = await response.text();
			let capabilities = body.slice(
				body.indexOf('id="features"'),
				body.indexOf('id="how-it-works"'),
			);
			let steps = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));
			expect(capabilities).toContain(escapeHtml(titles.features));
			expect(steps).toContain(escapeHtml(titles.steps));
			expect(capabilities).not.toContain(">Everything you need<");
			expect(steps).not.toContain(">How it works<");
		},
	);

	test("gives no two feature pages the same band title", () => {
		let titles = Object.keys(features).flatMap((slug) => {
			let band = en.landing.marketingPage.featureBands[slug as keyof FeatureBands];
			return [band.features, band.steps];
		});

		expect(new Set(titles).size).toBe(titles.length);
	});

	test.each(Object.entries(LOCALES))("%s titles every feature page's bands", (_, messages) => {
		for (let slug of Object.keys(features)) {
			let band = messages.landing.marketingPage.featureBands[slug as keyof FeatureBands];
			expect(band?.features, slug).toBeTruthy();
			expect(band?.steps, slug).toBeTruthy();
		}
	});

	test("lists the SSL page's one-line capabilities without card chrome", async () => {
		let response = await getFeature("ssl");

		let body = await response.text();
		let grid = body.match(/<div[^>]*data-slot="feature-grid"[^>]*>/)?.[0] ?? "";
		expect(grid).toContain('data-variant="list"');
	});

	test.each(["alerts", "integrations", "ssl"] as const)(
		"shows the %s page's own moment beside its steps",
		async (slug) => {
			let response = await getFeature(slug);

			let body = await response.text();
			let band = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));
			expect(band).toContain(
				`aria-label="${escapeHtml(en.landing.marketingPage.companions[slug])}"`,
			);
			expect(band).not.toContain(escapeHtml(en.landing.mockups.monitor));
		},
	);

	/**
	 * The flows page shows runs landing on the fastest schedule with the failing run's spec line,
	 * so the claim that an alert names its line is shown, not stated.
	 */
	test("shows the flows page's runs with the failing spec line", async () => {
		let response = await getFeature("flows");

		let body = await response.text();
		let band = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));
		expect(band).toContain(`aria-label="${escapeHtml(en.landing.flows.runs.name)}"`);
		expect(band).toContain("expect account.status 200 → got 401");
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getFeature("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});

	test("permanently redirects browser-flows to the dedicated landing", async () => {
		let response = await getFeature("browser-flows");

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe(routes.browserFlows.href());
	});
});
