/**
 * Covers the dashboard's cache controls: that the purge form actually targets
 * the purge route, and that the operator is told which way the last one went.
 * The button is the escape hatch for a bad cache, so a silent result would be
 * worse than no button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { createHtmlRenderer } from "~/bootstrap/app";
import routes from "~/routes/web";

import { CMSDashboardView } from "./dashboard";

const STATS = { articles: 1, likes: 2, tutorials: 3, glossary: 4 };

/** Renders the dashboard through the renderer production hands the controller. */
async function renderDashboard(purgeResult?: CMSDashboardView.PurgeResult) {
	let router = createRouter();

	router.get("/cms", (ctx) =>
		createHtmlRenderer(ctx)(CMSDashboardView, { stats: STATS, purgeResult }),
	);

	let response = await router.fetch(new Request("https://blog.test/cms"));
	return await response.text();
}

describe("the dashboard cache controls", () => {
	test("submits to the purge route", async () => {
		let html = await renderDashboard();

		expect(html).toContain(`action="${routes.cms.purgeCache.href()}"`);
		expect(html).toContain("Confirm clear");
	});

	test("says nothing about a purge that has not happened", async () => {
		let html = await renderDashboard();

		expect(html).not.toContain("Cache cleared");
		expect(html).not.toContain("did not clear");
	});

	test("reports a purge that worked", async () => {
		let html = await renderDashboard("ok");

		expect(html).toContain("Cache cleared");
	});

	test("reports a purge that did not, rather than implying success", async () => {
		let html = await renderDashboard("failed");

		expect(html).toContain("did not clear");
		expect(html).not.toContain("Cache cleared");
	});
});
