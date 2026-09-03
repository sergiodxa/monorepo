/**
 * Tests the `/vs/:slug` controller: a real slug from `resources/content/marketing.ts`'s
 * `comparisons` record renders that page's content plus its head-to-head comparison
 * table and its `<head>` SEO metadata (200), and an unknown slug renders the same
 * not-found page the router's `defaultHandler` uses (404).
 *
 * The three optional sections (honest take, "perfect for" banner, cost
 * comparison) are covered against fixture records this file registers in the
 * `comparisons` map, since real competitor records fill in that content over
 * time and would assert nothing while still missing it.
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
import { afterAll, describe, expect, test } from "vitest";

import type { MarketingContent } from "~/resources/content/marketing";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { comparisons } from "~/resources/content/marketing";
import routes from "~/routes/web";

import marketingComparison from "./marketing-comparison";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/**
 * Dispatches a real GET request to `/vs/:slug` as an anonymous visitor. Includes the
 * real `i18n` middleware — this controller renders its FAQ section header through
 * `ctx.i18next.t()` — backed by an empty test database.
 */
async function getComparison(slug: string) {
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
	router.map(routes.marketing.comparison, marketingComparison);

	let request = new Request(`https://uptime.test${routes.marketing.comparison.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

/** A comparison record with exactly the fields {@link MarketingContent.ComparisonPage} requires. */
function createFixture(slug: string): MarketingContent.ComparisonPage {
	return {
		slug,
		metaTitle: "Uptime vs Fixture",
		metaDescription: "Fixture comparison page.",
		badge: "Uptime vs Fixture",
		title: "Uptime vs",
		highlight: "Fixture",
		description: "Fixture description.",
		highlights: ["First highlight", "Second highlight", "Third highlight"],
		competitor: "Fixture",
		summary: "Fixture summary.",
		rows: [{ label: "Pricing model", us: "Usage-based", them: "Tiered" }],
		features: [{ title: "Fixture feature", description: "Fixture feature description." }],
		steps: [{ title: "Fixture step", description: "Fixture step description." }],
		faqs: [{ question: "Fixture question?", answer: "Fixture answer." }],
	};
}

/** Slugs the fixture records are registered under, removed again once this file's tests finish. */
const WITH_SECTIONS_SLUG = "fixture-with-optional-sections";
const WITHOUT_SECTIONS_SLUG = "fixture-without-optional-sections";

comparisons[WITH_SECTIONS_SLUG] = {
	...createFixture(WITH_SECTIONS_SLUG),
	honestTake: [{ title: "Fixture concession", description: "Where the competitor wins." }],
	perfectFor: {
		title: "Perfect for fixtures",
		description: "Who this is the right call for.",
		highlights: ["Fixture highlight"],
	},
	pricingScenarios: [
		{
			scenario: "Fixture scenario",
			/**
			 * 10 monitors every 30 minutes is 13,440 pings — inside the included
			 * allowance, so this row prices at the bare base subscription and the
			 * yearly saving is (29 - 5) x 12.
			 */
			usage: { monitors: 10, intervalMinutes: 30 },
			theirCost: "$29/mo",
			theirCostUsd: 29,
		},
	],
};
comparisons[WITHOUT_SECTIONS_SLUG] = createFixture(WITHOUT_SECTIONS_SLUG);

afterAll(() => {
	delete comparisons[WITH_SECTIONS_SLUG];
	delete comparisons[WITHOUT_SECTIONS_SLUG];
});

describe("GET /vs/:slug", () => {
	test("renders a real comparison page with its head-to-head table", async () => {
		let slug = Object.keys(comparisons)[0];
		if (!slug) throw new Error("expected at least one comparison page");
		let content = comparisons[slug]!;

		let response = await getComparison(slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${content.metaTitle}</title>`);
		expect(body).toContain(content.title);
		expect(body).toContain(`>${content.competitor}</th>`);
		expect(body).toContain(`>${content.rows[0]!.label}</td>`);
	});

	test("wires the page's SEO metadata and structured data", async () => {
		let slug = Object.keys(comparisons)[0];
		if (!slug) throw new Error("expected at least one comparison page");
		let content = comparisons[slug]!;

		let response = await getComparison(slug);
		let body = await response.text();

		expect(body).toContain(`<meta name="description" content="${content.metaDescription}"`);
		expect(body).toContain(`<link rel="canonical" href="https://uptime.sergiodxa.com/vs/${slug}"`);
		expect(body).toContain('<meta property="og:type" content="website"');
		expect(body).toContain('type="application/ld+json"');
		expect(body).toContain("SoftwareApplication");
		expect(body).toContain("FAQPage");
		expect(body).toContain(content.faqs[0]!.question);
	});

	test("renders the honest take, perfect-for banner, and cost comparison", async () => {
		let content = comparisons[WITH_SECTIONS_SLUG]!;

		let response = await getComparison(WITH_SECTIONS_SLUG);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(content.honestTake![0]!.title);
		expect(body).toContain(content.honestTake![0]!.description);
		expect(body).toContain(`When ${content.competitor} might be better`);
		expect(body).toContain(content.perfectFor!.title);
		expect(body).toContain(content.perfectFor!.highlights[0]!);
		expect(body).toContain(`>${content.pricingScenarios![0]!.scenario}</td>`);
		/**
		 * Both our cost and the saving are computed from the pricing model at
		 * render time, so the table always reflects the model's current numbers.
		 */
		expect(body).toContain(">$5/mo</td>");
		expect(body).toContain(">~$288/year</td>");
		expect(body).toContain(">Savings</th>");
	});

	test("skips the optional sections for a page whose record omits them", async () => {
		let response = await getComparison(WITHOUT_SECTIONS_SLUG);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).not.toContain("might be better");
		expect(body).not.toContain(">Savings</th>");
		expect(body).not.toContain("Real cost comparison");
		expect(body).not.toContain("Fixture regions");
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getComparison("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("Page Not Found");
	});
});
