/**
 * Tests the dedicated `/browser-flows` landing: it renders the hero brand and a
 * click-through spec example, advertises its canonical URL and FAQ structured data,
 * and stays reachable as its own top-level route rather than `/features/:slug`.
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
import { elementStyles } from "~/app/test/rendered-styles";
import { browserFlowsPage } from "~/resources/content/browser-flows";
import routes from "~/routes/web";

import browserFlows from "./browser-flows";

/** Renders through `renderToString` — this page renders no `<Frame>`. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET to `/browser-flows` as an anonymous visitor. */
async function getBrowserFlows() {
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
	router.map(routes.browserFlows, browserFlows);

	let request = new Request(`https://uptime.test${routes.browserFlows.href()}`);
	return router.fetch(request);
}

describe("GET /browser-flows", () => {
	test("renders the dedicated landing with a live spec example", async () => {
		let response = await getBrowserFlows();

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(`<title>${browserFlowsPage.metaTitle}</title>`);
		expect(body).toContain(browserFlowsPage.brand);
		expect(body).toContain(browserFlowsPage.title);
		expect(body).toContain("use browser");
		expect(body).toContain("signing in lands on the dashboard");
		expect(body).toContain("m@example.com");
		expect(body).toContain("monitor-pw");
		expect(body).toContain('id="browser-flow-examples"');
		expect(body).toContain(browserFlowsPage.pricing.figure);
	});

	test("advertises its canonical URL and structured data", async () => {
		let response = await getBrowserFlows();
		let body = await response.text();

		expect(body).toContain(
			'<link rel="canonical" href="https://uptime.sergiodxa.com/browser-flows"',
		);
		expect(body).toContain('"@type":"SoftwareApplication"');
		expect(body).toContain('"@type":"FAQPage"');
	});

	/**
	 * The examples band stacks the spec stage over the example cards; the band's own layout puts
	 * no space between its children, so the cards sat flush against the stage's lower edge.
	 */
	test("separates the example cards from the spec stage above them", async () => {
		let body = await (await getBrowserFlows()).text();

		let styles = elementStyles(body, 'data-slot="feature-grid"', body.indexOf('id="examples"'));

		expect(styles.join("\n")).toContain("margin-block-start");
	});

	/**
	 * Step copy is plain prose rendered as text, so Markdown backticks would show literally; the
	 * DSL keyword stays on the spec lines the diagram beside the steps prints.
	 */
	test("shows each step as prose beside a browser run of the sign-in spec", async () => {
		let body = await (await getBrowserFlows()).text();
		let band = body.slice(body.indexOf('id="how-it-works"'), body.indexOf('id="faq"'));

		for (let step of browserFlowsPage.steps.list) {
			expect(step.description).not.toContain("`");
		}
		expect(band).toContain(`aria-label="${browserFlowsPage.steps.diagram.name}"`);
		expect(band).toContain("browser.open");
		expect(band).toContain("expect browser.heading");
		expect(band).not.toContain("http.post");
	});
});
