/**
 * Tests the `/` controller: it renders the public marketing homepage inside the
 * shared document/marketing chrome for both anonymous and signed-in viewers, with the
 * hero CTA switching between a sign-in form and a dashboard link, its full head
 * metadata set and `WebSite` structured data, and every section of the page — hero
 * screenshot, trust indicators, benefit rows, feature/use-case grids, the pricing
 * calculator's server-rendered baseline, and the FAQ — present in the markup.
 *
 * Two assertions here are about copy the page must *not* carry: an alert-latency figure,
 * which is a claim about mail and chat infrastructure we don't run, and a price typed into
 * the controller rather than read from `app/lib/pricing`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";
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

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { BASE_PRICE_USD, formatPings, formatUsd, INCLUDED_PINGS } from "~/app/lib/pricing";
import { findClaimViolations } from "~/app/lib/public-claims";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/**
 * Whether this deployment has a Turnstile site key, which is what decides whether the
 * try-it box carries a challenge at all. Mocked because the default `cloudflare:workers`
 * stub answers every binding read with a non-empty placeholder, so the unconfigured case —
 * the one where the widget and its loader must both be absent — is unreachable otherwise.
 */
let trialTurnstileSiteKey = mock((): string | null => null);

mock.module("~/app/services/trial-guard", () => ({ trialTurnstileSiteKey }));

let { default: home } = await import("./home");

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
 * Dispatches a real GET request to `/` with the given signed-in state. Includes the
 * real `i18n` middleware — `home.tsx` renders its copy through `ctx.i18next.t()` —
 * backed by an empty test database (only consulted for a signed-in viewer's saved
 * language preference, which none of these tests set, so it falls back to English).
 */
async function getHome(viewer: Viewer | null) {
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
	router.map(routes.home, home);

	let request = new Request(`https://uptime.test${routes.home.href()}`);
	return container.scope(() => router.fetch(request));
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

	test("emits the whole head metadata set and the WebSite structured data", async () => {
		let response = await getHome(null);
		let body = await response.text();

		// The tag set is pinned in full because a regression here — a canonical on the
		// serving host, a dropped `og:url` — is invisible to every other assertion.
		expect(body).toContain(
			[
				"<title>Uptime by Sergio Xalambrí</title>",
				'<meta name="description" content="Simple &amp; reliable uptime monitoring for developers" />',
				`<link rel="canonical" href="${SEO.baseUrl}/" />`,
				'<meta property="og:type" content="website" />',
				`<meta property="og:url" content="${SEO.baseUrl}/" />`,
				'<meta property="og:site_name" content="Uptime" />',
				'<meta property="og:title" content="Uptime by Sergio Xalambrí" />',
				'<meta property="og:description" content="Simple &amp; reliable uptime monitoring for developers" />',
				'<meta name="twitter:card" content="summary_large_image" />',
				'<meta name="twitter:title" content="Uptime by Sergio Xalambrí" />',
				'<meta name="twitter:description" content="Simple &amp; reliable uptime monitoring for developers" />',
			].join(""),
		);
		// The root is the one URL that keeps its trailing slash.
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
		// The `<img>` fallback for engines that don't pick a `<source>`.
		expect(body).toContain('src="/screenshot-light.webp"');
		expect(body).toContain("Screenshot of the Uptime dashboard");
	});

	test("renders the trust indicators, feature grid, and use-case grid", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("Monitor Types");
		expect(body).toContain("365");

		// The strip states product facts only. An availability figure here would be a
		// reliability claim about ourselves, which the Terms explicitly decline to make.
		expect(body).not.toContain("99.9%");
		expect(body).not.toContain("SLA");

		// Same rule, one step further: an alert-latency figure is a claim about how fast
		// somebody else's inbox, webhook endpoint or chat provider accepts a message, so
		// it can't be true end to end no matter what we measure. What replaced it is the
		// check-interval floor the monitor validator actually enforces.
		expect(body).not.toContain("&lt;1s");
		expect(body).not.toContain("<1s");
		expect(body).not.toContain("Alert Latency");
		expect(body).toContain("1min");
		expect(body).toContain("Min Check Interval");

		// Feature cards link to their own page and carry the "learn more" affordance.
		expect(body).toContain(`href="${routes.marketing.feature.href({ slug: "monitors" })}"`);
		expect(body).toContain("Learn more");

		// The secondary capability rows, which have no destination of their own.
		expect(body).toContain("Maintenance Windows");
		expect(body).toContain("Cron Job Monitoring");

		expect(body).toContain(
			`href="${routes.marketing.useCase.href({ slug: "website-monitoring" })}"`,
		);
		expect(body).toContain(`href="${routes.marketing.audience.href({ slug: "agencies" })}"`);
	});

	/**
	 * Three audience pills, not all six `/for/:slug` pages. Six of equal weight say nothing
	 * about who the product is for, and they hand the audiences it fits least the same
	 * prominence as the ones it fits best. The rest stay in the footer's solutions column
	 * and in the sitemap — narrowing this row must never cost a page its links.
	 */
	test("gives three audiences the prominent row and leaves the rest to the chrome", async () => {
		let response = await getHome(null);
		let body = await response.text();

		for (let slug of ["agencies", "solo-devs", "startups"]) {
			expect(body).toContain(`href="${routes.marketing.audience.href({ slug })}"`);
		}

		// Present exactly once each — the footer's own link — rather than absent, which is
		// what tells the two cases apart: a deleted page would be missing from both.
		for (let slug of ["indie-hackers", "enterprises", "devops"]) {
			let href = `href="${routes.marketing.audience.href({ slug })}"`;
			expect(body.split(href)).toHaveLength(2);
		}
	});

	test("renders the three benefit rows between the hero and the feature grid", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain('id="benefits"');

		// The rendered headings, not the key names: a key-name assertion would have gone on
		// passing for a section whose copy was never written.
		for (let title of ["Everything included", "No monitor math", "Pay for actual usage"]) {
			expect(body).toContain(title);
		}

		// And the one benefit that quotes the pricing model, with the figures interpolated.
		expect(body).toContain(`${formatUsd(BASE_PRICE_USD)} a month includes`);
		expect(body).toContain(formatPings(INCLUDED_PINGS));

		// Ahead of the capability grid, which is the ordering the section exists for: a
		// visitor decides whether the product is for them before they read which checks it
		// runs.
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
	 * The cost benefit quotes the pricing model, and the one way that copy goes stale is a
	 * figure typed into this controller instead of interpolated from `app/lib/pricing`.
	 * Asserted against the source, since at runtime `$5` and `{{price}}` render the same
	 * characters — the same reason `public-claims.test.ts` scans source for the locale and
	 * marketing-content modules.
	 */
	test("states no price of its own", () => {
		let source = readFileSync(new URL("./home.tsx", import.meta.url), "utf8");

		expect(findClaimViolations(source)).toEqual([]);
	});

	/**
	 * This page is the densest decorative-icon surface in the app — a glyph per trust
	 * indicator, feature card, capability row and use case — and every one of them was
	 * being announced.
	 *
	 * `aria-hidden` takes a token, not a flag, and the renderer writes a `true` prop the
	 * way HTML wants a boolean attribute written: as the bare name. So the JSX shorthand
	 * these icons carried reached the document as `aria-hidden=""`, which is not a token
	 * ARIA recognizes, leaving the glyph exposed. Worse, passing it at all suppressed the
	 * correct `aria-hidden="true"` the icon component adds for itself, so the shorthand
	 * replaced a right value with a wrong one.
	 *
	 * Asserted on the served HTML rather than on the source, because the fix is a deletion
	 * and the thing that has to be true is what the icon renders in its place.
	 */
	test("hides every decorative icon with the token, never with an empty value", async () => {
		let response = await getHome(null);
		let body = await response.text();

		let hidden = body.match(/aria-hidden(="[^"]*")?/g) ?? [];

		expect(hidden.length).toBeGreaterThan(0);
		expect([...new Set(hidden)]).toEqual(['aria-hidden="true"']);
	});

	test("server-renders the pricing calculator's initial estimate", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("Pricing Calculator");
		// One monitor's slider, bounded at 1 and 60 minutes.
		expect(body).toContain('type="range"');
		expect(body).toContain('min="1"');
		expect(body).toContain('max="60"');
		// 28 days × 24 h × 60 min ÷ 10 min, which the base subscription fully covers.
		expect(body).toContain("4,032");
		expect(body).toContain("Total monthly cost:");
		expect(body).toContain("How pricing works");
	});

	test("renders every FAQ entry across two accordion columns", async () => {
		let response = await getHome(null);
		let body = await response.text();

		// One `<details>` per entry, all nineteen of them.
		expect(body.match(/<details/g)).toHaveLength(19);
		expect(body).toContain("How does Uptime monitor my services?");
		expect(body).toContain("From which regions can I monitor my services?");
	});

	test("renders the try-it box as a POST that runs the check on the first click", async () => {
		let response = await getHome(null);
		let body = await response.text();

		// The method is the security property, not a style choice: only a `POST` runs a
		// probe, and neither a link preview, a crawler, nor a pasted `/try?url=…` issues one,
		// so none of them can spend one of the free checks.
		expect(body).toContain(`<form method="post" action="${routes.trial.check.action.href()}"`);
		expect(body).toContain('name="url"');
		expect(body).toContain("Run a check");
	});

	test("renders no Turnstile widget when the deployment has no site key", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).not.toContain("cf-turnstile");
		expect(body).not.toContain("challenges.cloudflare.com");
	});

	test("renders the Turnstile widget and its loader when a site key is configured", async () => {
		// Both halves, because the widget alone is inert: without the loader the container
		// never becomes a challenge, no token is written into the form, and every submission
		// from this page is refused as one that could not be confirmed to come from a browser.
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
});
