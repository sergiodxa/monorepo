/**
 * Tests the `/` controller: it renders the public marketing homepage inside the
 * shared document/marketing chrome for anonymous and signed-in viewers, with the
 * hero CTA switching between a sign-in form and a dashboard link, full head
 * metadata and `WebSite` structured data, every marketing section from the
 * hero screenshot through the FAQ, and the try-it box's honeypot fields.
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
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { SEO } from "~/app/initializers/seo";
import { findClaimViolations } from "~/app/services/public-claims";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { honeypotFields, TEST_HONEYPOT, testHoneypot } from "~/app/test/honeypot";
import {
	BASE_PRICE_USD,
	FLOW_INTERVALS_SECONDS,
	formatPings,
	formatUsd,
	INCLUDED_PINGS,
} from "~/config/pricing";
import routes from "~/routes/web";

/**
 * Whether this deployment has a Turnstile site key, deciding whether the try-it
 * box carries a challenge. Mocked since the `cloudflare:workers` stub always
 * returns a placeholder, the only way to reach the unconfigured case.
 */
let trialTurnstileSiteKey = vi.fn((): string | null => null);

vi.doMock("~/app/services/trial/guard", () => ({ trialTurnstileSiteKey }));

let { default: home } = await import("./home");

/** Renders through `renderToString`, sufficient since this page emits a plain node tree. */
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
 * Dispatches a real GET request to `/` with the given signed-in state. Uses the
 * real `i18n` middleware since `home.tsx` renders through `ctx.intl.t()`, and
 * an empty database whose only bearing is a saved locale, defaulting to English.
 */
async function getHome(viewer: Viewer | null) {
	let { db } = createTestDatabase();

	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			seedAuth(viewer),
			i18n as Middleware,
			testHoneypot(),
			testAssets(),
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.home, home);

	let request = new Request(`https://uptime.test${routes.home.href()}`);
	return router.fetch(request);
}

beforeEach(() => {
	trialTurnstileSiteKey.mockReset();
	trialTurnstileSiteKey.mockImplementation(() => null);
});

describe("GET /", () => {
	test("renders the marketing homepage for an anonymous visitor", async () => {
		let response = await getHome(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Uptime by Sergio Xalambrí</title>");
		expect(body).toContain("Monitor your services");
		expect(body).toContain("with confidence");
		expect(body).toContain("Start Monitoring");
	});

	test("marks the signed-out CTA form as a document submission", async () => {
		let response = await getHome(null);
		let body = await response.text();

		let cta = body.match(new RegExp(`<form[^>]*action="${routes.auth.action.href()}"[^>]*>`));
		expect(cta?.[0]).toContain("data-rmx-document");
	});

	/**
	 * Pinned in full because a regression in the canonical host or a dropped
	 * `og:url` is invisible to any narrower assertion.
	 */
	test("emits the whole head metadata set and the WebSite structured data", async () => {
		let response = await getHome(null);
		let body = await response.text();
		let { marketingCardVersion, socialCardUrl } = await import("~/app/services/social-card");
		let description =
			"Uptime monitoring built for developers and agents — REST API and Streamable HTTP MCP, with scoped keys.";
		let card = socialCardUrl(
			"/",
			marketingCardVersion("Uptime by Sergio Xalambrí", description, "/"),
		);

		expect(body).toContain(
			[
				"<title>Uptime by Sergio Xalambrí</title>",
				`<meta name="description" content="${description}" />`,
				`<link rel="canonical" href="${SEO.baseUrl}/" />`,
				'<meta property="og:type" content="website" />',
				`<meta property="og:url" content="${SEO.baseUrl}/" />`,
				'<meta property="og:site_name" content="Uptime" />',
				'<meta property="og:title" content="Uptime by Sergio Xalambrí" />',
				`<meta property="og:description" content="${description}" />`,
				`<meta property="og:image" content="${card}" />`,
				'<meta property="og:image:alt" content="Uptime by Sergio Xalambrí" />',
				'<meta property="og:image:width" content="1200" />',
				'<meta property="og:image:height" content="630" />',
				'<meta name="twitter:card" content="summary_large_image" />',
				'<meta name="twitter:title" content="Uptime by Sergio Xalambrí" />',
				`<meta name="twitter:description" content="${description}" />`,
				`<meta name="twitter:image" content="${card}" />`,
			].join(""),
		);
		expect(body).toContain(`"@type":"WebSite","name":"Uptime","url":"${SEO.baseUrl}"`);
	});

	test("renders the hero screenshot with a preloaded variant per color scheme", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain(
			'<link rel="preload" href="/screenshot-light.webp" as="image" media="(prefers-color-scheme: light)" />',
		);
		expect(body).toContain(
			'<link rel="preload" href="/screenshot-dark.webp" as="image" media="(prefers-color-scheme: dark)" />',
		);
		expect(body).toContain('srcset="/screenshot-dark.webp"');
		expect(body).toContain('src="/screenshot-light.webp"');
		expect(body).toContain("Screenshot of the Uptime dashboard");
	});

	/**
	 * The trust strip states only capabilities Uptime controls end to end: monitor
	 * types, data retention, and the check-interval floor its validator enforces.
	 */
	test("renders the trust indicators, feature grid, and use-case grid", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("Monitor Types");
		expect(body).toContain("365");

		expect(body).not.toContain("99.9%");
		expect(body).not.toContain("SLA");

		expect(body).not.toContain("&lt;1s");
		expect(body).not.toContain("<1s");
		expect(body).not.toContain("Alert Latency");
		expect(body).toContain("1min");
		expect(body).toContain("Min Check Interval");

		expect(body).toContain(`href="${routes.marketing.feature.href({ slug: "monitors" })}"`);
		expect(body).toContain(`href="${routes.browserFlows.href()}"`);
		expect(body).toContain("Learn more");

		expect(body).toContain("Test in a real browser");

		expect(body).toContain("Maintenance Windows");
		expect(body).toContain("Cron Job Monitoring");

		expect(body).toContain(
			`href="${routes.marketing.useCase.href({ slug: "website-monitoring" })}"`,
		);
		expect(body).toContain(`href="${routes.marketing.audience.href({ slug: "agencies" })}"`);
	});

	/**
	 * Three audience links carry the row, chosen over all six `/for/:slug` pages
	 * so the ones the product fits best keep more prominence than the ones it fits
	 * least. Every page still links from the header menu, the footer and the sitemap.
	 */
	test("gives three audiences the prominent row and leaves the rest to the chrome", async () => {
		let response = await getHome(null);
		let body = await response.text();
		let main = body.slice(body.indexOf("<main"), body.indexOf("</main>"));

		for (let slug of ["agencies", "solo-devs", "startups"]) {
			expect(main).toContain(`href="${routes.marketing.audience.href({ slug })}"`);
		}

		for (let slug of ["indie-hackers", "enterprises", "devops"]) {
			expect(main).not.toContain(`href="${routes.marketing.audience.href({ slug })}"`);
			expect(body).toContain(`href="${routes.marketing.audience.href({ slug })}"`);
		}
	});

	/**
	 * The flows band explains a run with the documented sign-in flow, and its schedule
	 * line quotes the shortest interval `config/pricing.ts` offers a flow monitor.
	 */
	test("walks through a flow monitor run with the real shortest interval", async () => {
		let body = await (await getHome(null)).text();

		expect(body).toContain('id="flows"');
		expect(body).toContain("Check the whole journey, not one URL");
		expect(body).toContain("session.json.token");
		expect(body).toContain(`As often as every ${FLOW_INTERVALS_SECONDS[0] / 60} minutes`);
		expect(body).toContain(`href="${routes.marketing.feature.href({ slug: "flows" })}"`);
		expect(body).toContain(`href="${routes.browserFlows.href()}"`);
	});

	/**
	 * Assembled against the rendered headings, so a section whose copy was never
	 * written cannot pass on a key name alone, and the benefits sit ahead of the
	 * capability grid so a visitor judges fit before reading which checks run.
	 */
	test("renders the three benefit rows between the hero and the feature grid", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain('id="benefits"');

		for (let title of ["Everything included", "No monitor math", "Pay for actual usage"]) {
			expect(body).toContain(title);
		}

		expect(body).toContain(`${formatUsd(BASE_PRICE_USD)} a month includes`);
		expect(body).toContain(formatPings(INCLUDED_PINGS));

		expect(body.indexOf('id="benefits"')).toBeLessThan(body.indexOf('id="features"'));
	});

	/**
	 * A section heading that renders as `landing.benefits.badge` is a missing locale key, and
	 * it looks like ordinary copy in a screenshot. Asserting no `landing.` key name survives
	 * into the HTML catches the whole class at once, for this section and every other.
	 */
	test("renders no unresolved locale keys", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).not.toMatch(/landing\.[a-zA-Z]+\./);
	});

	/**
	 * The cost benefit quotes the pricing model, so a hard-coded figure instead of
	 * one interpolated from `config/pricing` is the one way it drifts. Checked
	 * against the source, since `$5` and `{$price}` render identically at runtime.
	 */
	test("states no price of its own", () => {
		let source = readFileSync(new URL("./home.tsx", import.meta.url), "utf8");

		expect(findClaimViolations(source)).toEqual([]);
	});

	/**
	 * Every decorative glyph — across the trust, feature, capability and use-case
	 * icons — must serve `aria-hidden="true"`: the bare JSX shorthand renders as
	 * `aria-hidden=""`, an empty value that overrides the icon's own correct default.
	 */
	test("hides every decorative icon with the token, never with an empty value", async () => {
		let response = await getHome(null);
		let body = await response.text();

		let hidden = body.match(/aria-hidden(="[^"]*")?/g) ?? [];

		expect(hidden.length).toBeGreaterThan(0);
		expect([...new Set(hidden)]).toEqual(['aria-hidden="true"']);
	});

	/**
	 * 4,032 is 28 days of checks at a 10-minute interval, the default the pricing
	 * calculator opens with, fully covered by the base subscription.
	 */
	test("server-renders the pricing calculator's initial estimate", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("Pricing Calculator");
		expect(body).toContain('type="range"');
		expect(body).toContain('min="1"');
		expect(body).toContain('max="60"');
		expect(body).toContain("4,032");
		expect(body).toContain("Total monthly cost:");
		expect(body).toContain("How pricing works");
	});

	test("renders every FAQ entry across two accordion columns", async () => {
		let response = await getHome(null);
		let body = await response.text();

		let main = body.slice(body.indexOf("<main"), body.indexOf("</main>"));
		expect(main.match(/<details/g)).toHaveLength(21);
		expect(body).toContain("How does Uptime monitor my services?");
		expect(body).toContain("From which regions can I monitor my services?");
		expect(body).toContain("Can I monitor a login or a checkout flow?");
		expect(body).toContain("How are browser flows billed?");
	});

	/**
	 * Only a real submission fires the `POST` that spends a free check — link
	 * previews, crawlers, and a pasted `/try?url=…` all stay at a `GET`, so
	 * they never touch the check budget.
	 */
	test("renders the try-it box as a POST that runs the check on the first click", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain(`<form method="post" action="${routes.trial.check.action.href()}"`);
		expect(body).toContain('name="url"');
		expect(body).toContain("Run a check");
	});

	test("renders the try-it box's honeypot trap out of reach of people and autofill", async () => {
		let body = await (await getHome(null)).text();

		expect(body).toMatch(/<div aria-hidden="true" inert class="[^"]+"><label for="hp_[a-z]+">/);
		expect(body).toMatch(
			/<input type="text" id="hp_[a-z]+" name="hp_[a-z]+" value="" tabindex="-1" autocomplete="off"/,
		);
	});

	test("issues try-it fields that the check's honeypot verifies", async () => {
		let fields = honeypotFields(await (await getHome(null)).text());
		let form = new URLSearchParams({
			[fields.tokenField]: fields.token,
			[fields.trapField]: "",
			url: "example.com",
		});

		expect((await TEST_HONEYPOT.verify(form)).status).toBe("success");
	});

	test("renders no Turnstile widget when the deployment has no site key", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).not.toContain("cf-turnstile");
		expect(body).not.toContain("challenges.cloudflare.com");
	});

	/**
	 * Both halves are asserted together: the widget markup alone is inert, and
	 * only the loader turns the container into a challenge and writes the token
	 * a submission needs to be trusted as coming from a browser.
	 */
	test("renders the Turnstile widget and its loader when a site key is configured", async () => {
		trialTurnstileSiteKey.mockImplementation(() => "0x-site-key");

		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain('class="cf-turnstile"');
		expect(body).toContain('data-sitekey="0x-site-key"');
		expect(body).toContain('data-response-field-name="cf-turnstile-response"');
		expect(body).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("keeps the trial's selling copy off the landing page", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).not.toContain("What the week looks like");
		expect(body).not.toContain("Watch this URL for a week");
		expect(body).not.toContain(routes.trial.lead.href());
	});

	test("renders the marketing homepage for a signed-in viewer with a dashboard CTA", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getHome(viewer);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Open Dashboard");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});

	test("prefetches landing-page links on intent", async () => {
		let response = await getHome(null);
		let body = await response.text();

		let destinations = [
			routes.docs.index.href(),
			routes.marketing.comparison.href({ slug: "uptimerobot" }),
			routes.marketing.feature.href({ slug: "alerts" }),
			routes.marketing.audience.href({ slug: "agencies" }),
			routes.legal.privacy.href(),
		];
		for (let href of destinations) {
			let anchors = body.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`, "g")) ?? [];
			expect(anchors.length, href).toBeGreaterThan(0);
			for (let anchor of anchors) expect(anchor, href).toContain('data-rmx-prefetch="intent"');
		}
	});

	test("leaves the dashboard CTA unprefetched", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getHome(viewer);
		let body = await response.text();

		let anchors = body.match(new RegExp(`<a[^>]*href="${routes.app.index.href()}"[^>]*>`, "g"));
		expect(anchors?.length).toBeGreaterThan(0);
		for (let anchor of anchors ?? []) expect(anchor).not.toContain("data-rmx-prefetch");
	});
});
