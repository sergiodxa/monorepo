/**
 * Tests the `/rules` controller: the guard on the page, the rules read back as sentences,
 * the preview a candidate in the query asks for, and what writing one reports back.
 *
 * Every assertion is against rendered English copy rather than a translation key, since a
 * key-name assertion passes for a page whose copy was never written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: rules } = await import("./manage");

/** A router with the rules controller mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.rules, rules);
	return router;
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /rules", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await fetchRoute(createRouter(null), routes.rules.index.href());

		expect(response.status).toBe(303);
		expect(store.listRules).not.toHaveBeenCalled();
	});

	test("says what a filter is, and what a filter on the summary actually reads", async () => {
		let html = await (await fetchRoute(createRouter(VIEWER), routes.rules.index.href())).text();

		expect(html).toContain("decides what happens to that post as it arrives");
		expect(html).toContain("which is the line under the title");
	});

	test("reads each rule back as the sentence it is, and says a rule has never matched", async () => {
		store.listRules = vi.fn(async () => [
			{
				id: "rule_1",
				feedId: null,
				field: "title" as const,
				value: "Sponsored",
				action: "drop" as const,
				matches: 0,
				lastMatchedAt: null,
			},
		]);

		let html = await (await fetchRoute(createRouter(VIEWER), routes.rules.index.href())).text();

		expect(html).toContain("When the title of a post contains");
		expect(html).toContain("Sponsored");
		expect(html).toContain("has never matched a post");
	});

	test("takes no preview until the reader has typed something to look for", async () => {
		await fetchRoute(createRouter(VIEWER), routes.rules.index.href());

		expect(store.previewRule).not.toHaveBeenCalled();
	});

	test("previews the candidate the query carries, and warns when it catches everything", async () => {
		store.previewRule = vi.fn(async () => ({
			ok: true,
			scanned: 2,
			matched: 2,
			items: [],
			feeds: [],
		}));

		let query = new URLSearchParams({ field: "title", value: "the", action: "drop" });
		let html = await (
			await fetchRoute(createRouter(VIEWER), `${routes.rules.index.href()}?${query}`)
		).text();

		expect(store.previewRule).toHaveBeenCalledWith({
			feedId: null,
			field: "title",
			value: "the",
			action: "drop",
		});

		expect(html).toContain("This matches every one of your newest posts");
	});
});

describe("POST /rules", () => {
	test("writes what the form submitted and reports it on the page it returns to", async () => {
		store.createRule = vi.fn(async () => ({
			ok: true,
			rule: {
				id: "rule_1",
				feedId: null,
				field: "title" as const,
				value: "Sponsored",
				action: "drop" as const,
				matches: 0,
				lastMatchedAt: null,
			},
		}));

		let response = await fetchRoute(createRouter(VIEWER), routes.rules.action.href(), {
			field: "title",
			value: "Sponsored",
			action: "drop",
			feed: "",
		});

		expect(store.createRule).toHaveBeenCalledWith({
			feedId: null,
			field: "title",
			value: "Sponsored",
			action: "drop",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${routes.rules.index.href()}?rule=created`);
	});

	test("carries a refusal back as the reason it was refused", async () => {
		store.createRule = vi.fn(async () => ({
			ok: false,
			reason: "rule-limit",
			limit: { limit: "rules", current: 50, allowed: 50, tier: "paid" },
		}));

		let response = await fetchRoute(createRouter(VIEWER), routes.rules.action.href(), {
			field: "title",
			value: "x",
			action: "drop",
			feed: "",
		});

		expect(response.headers.get("location")).toBe(`${routes.rules.index.href()}?rule=rule-limit`);
	});
});
