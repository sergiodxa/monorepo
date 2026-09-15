/**
 * Tests the `/settings` controller: the guard on the page, the cadence form it renders from
 * the reader's stored preferences, the redirect a save answers with, and the refusal a
 * cadence outside the offered set earns. Then the transfer section, and the sentence each
 * outcome an import returns here with is reported as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, fetchRoute, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble, DEFAULT_SETTINGS } from "~/app/lib/test/store";
import { REFRESH_INTERVALS } from "~/database/schema";
import routes from "~/routes/web";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: settings } = await import("./settings");

/** A router with the settings controller mapped, signed in as `viewer` or as nobody. */
function createRouter(viewer: typeof VIEWER | null): Router {
	let router = createTestRouter(viewer);
	router.map(routes.settings, settings);
	return router;
}

/** The cadence the rendered form shows chosen, read off the radio carrying `checked`. */
function checkedInterval(html: string): string | null {
	return /<input[^>]*\bvalue="(\d+)"[^>]*\bchecked\b/.exec(html)?.[1] ?? null;
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /settings", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await fetchRoute(createRouter(null), routes.settings.index.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.getSettings).not.toHaveBeenCalled();
	});

	test("offers every cadence, with the stored one chosen", async () => {
		store.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, refreshIntervalHours: 3 });

		let response = await fetchRoute(createRouter(VIEWER), routes.settings.index.href());
		let html = await response.text();

		expect(response.status).toBe(200);

		for (let hours of REFRESH_INTERVALS) {
			expect(html).toContain(`value="${hours}"`);
		}

		expect(html).toContain("Every hour");
		expect(html).toContain("Every 3 hours");
		expect(html).toContain("Every 24 hours");
		expect(checkedInterval(html)).toBe("3");
	});

	test("names the group and explains what checking more often costs", async () => {
		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(html).toContain("How often to check for new posts");
		expect(html).toContain("costs the sites you read a little more");
	});

	test("shows when the feeds were last checked", async () => {
		let lastRefreshedAt = Date.UTC(2026, 2, 14, 12, 0, 0);
		store.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, lastRefreshedAt });

		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(html).toContain("Last checked");
		expect(html).toContain(new Intl.DateTimeFormat("en").format(lastRefreshedAt));
	});

	test("says so when the feeds have never been checked", async () => {
		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(html).toContain("Not checked yet");
	});

	test("shows the saved note only when the redirect reports one", async () => {
		let router = createRouter(VIEWER);

		let plain = await (await fetchRoute(router, routes.settings.index.href())).text();
		let saved = await (await fetchRoute(router, `${routes.settings.index.href()}?saved`)).text();

		expect(plain).not.toContain("Saved.");
		expect(saved).toContain("Saved.");
	});
});

describe("POST /settings", () => {
	test("saves the cadence and redirects so a reload does not resubmit", async () => {
		let router = createRouter(VIEWER);

		let response = await fetchRoute(router, routes.settings.action.href(), {
			refreshIntervalHours: "6",
		});

		expect(store.setRefreshInterval).toHaveBeenCalledWith(6);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${routes.settings.index.href()}?saved`);

		let landed = await fetchRoute(router, response.headers.get("location") ?? "");

		expect(await landed.text()).toContain("Saved.");
	});

	test("refuses a cadence that is not on offer", async () => {
		let response = await fetchRoute(createRouter(VIEWER), routes.settings.action.href(), {
			refreshIntervalHours: "2",
		});
		let html = await response.text();

		expect(store.setRefreshInterval).not.toHaveBeenCalled();
		expect(response.status).toBe(422);
		expect(html).toContain("That is not one of the schedules on offer.");
		expect(html).toContain("How often to check for new posts");
		expect(html).not.toContain("Saved.");
	});

	test("shows the same refusal when the store rejects the cadence", async () => {
		store.setRefreshInterval.mockResolvedValue({ ok: false, reason: "invalid-interval" });

		let response = await fetchRoute(createRouter(VIEWER), routes.settings.action.href(), {
			refreshIntervalHours: "12",
		});

		expect(response.status).toBe(422);
		expect(await response.text()).toContain("That is not one of the schedules on offer.");
	});

	test("sends an anonymous visitor home without touching the store", async () => {
		let response = await fetchRoute(createRouter(null), routes.settings.action.href(), {
			refreshIntervalHours: "6",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.setRefreshInterval).not.toHaveBeenCalled();
	});
});

describe("the transfer section", () => {
	test("offers the subscription list as a download", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(body).toContain(`href="${routes.feeds.export.href()}"`);
		expect(body).toContain("Download as OPML");
	});

	test("uploads an OPML document in the encoding that carries its bytes", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(body).toContain(
			`<form method="post" action="${routes.feeds.import.href()}" enctype="multipart/form-data"`,
		);
		expect(body).toContain('type="file"');
		expect(body).toContain('name="file"');
		expect(body).toContain('accept=".opml,.xml,application/xml,text/xml"');
		expect(body).toContain("OPML file");
		expect(body).toContain("A subscription list exported from another reader.");
		expect(body).toContain("Import");
	});

	test("leaves the picker optional, since the hidden input is one no reader can focus", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(/<input[^>]*type="file"[^>]*\brequired\b/.test(body)).toBe(false);
	});

	test("ties the picker to the passage saying what it asks for", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		let describedBy = /<input[^>]*type="file"[^>]*aria-describedby="([^"]+)"/.exec(body)?.[1];

		expect(describedBy).toBeDefined();
		expect(body).toContain(`id="${describedBy}"`);
	});
});

describe("what an import returns here with", () => {
	/**
	 * Requests the page the way a finished import returns the reader to it.
	 *
	 * @param query - The outcome and counts the redirect carries.
	 */
	function afterImport(query: Record<string, string>) {
		let url = `${routes.settings.index.href()}?${new URLSearchParams(query)}`;
		return fetchRoute(createRouter(VIEWER), url).then((response) => response.text());
	}

	test("says nothing on a page nobody was returned to", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.index.href())).text();

		expect(body).not.toContain("Followed");
		expect(body).not.toContain("That file lists no feeds.");
		expect(body).not.toContain("Choose an OPML file to import.");
	});

	test("counts what an import followed and what it already followed", async () => {
		let body = await afterImport({ imported: "done", added: "2", following: "1", failed: "0" });

		expect(body).toContain("Followed 2 new feeds.");
		expect(body).toContain("1 was already followed.");
		expect(body).not.toContain("could not be retrieved.");
	});

	test("reads a partial import as a success, with its failures alongside", async () => {
		let body = await afterImport({ imported: "done", added: "47", following: "0", failed: "3" });

		expect(body).toContain("Followed 47 new feeds.");
		expect(body).toContain("3 could not be retrieved.");
		expect(body).not.toContain("was already followed.");
		expect(body).not.toContain("That file could not be read as OPML.");
	});

	test("counts a single followed feed in the singular", async () => {
		let body = await afterImport({ imported: "done", added: "1", following: "0", failed: "0" });

		expect(body).toContain("Followed 1 new feed.");
	});

	test("reads a count that did not arrive as none of them", async () => {
		let body = await afterImport({ imported: "done" });

		expect(body).toContain("Followed 0 new feeds.");
		expect(body).not.toContain("was already followed.");
		expect(body).not.toContain("could not be retrieved.");
	});

	test("reports a document that lists no feeds", async () => {
		let body = await afterImport({ imported: "empty" });

		expect(body).toContain("That file lists no feeds.");
	});

	test("reports a file that could not be read", async () => {
		let body = await afterImport({ imported: "unreadable" });

		expect(body).toContain("That file could not be read as OPML.");
	});

	test("says a file is past the size this reads, rather than calling it unreadable", async () => {
		let body = await afterImport({ imported: "too-large" });

		expect(body).toContain("larger than this app will read");
		expect(body).not.toContain("could not be read as OPML");
	});

	test("names the transfer section, so the controls below it are not unlabelled", async () => {
		let body = await afterImport({});

		expect(body).toContain("Carrying your subscriptions");
	});

	test("asks for a file when the form arrived without one", async () => {
		let body = await afterImport({ imported: "missing" });

		expect(body).toContain("Choose an OPML file to import.");
	});

	test("reports nothing for an outcome it has no sentence for", async () => {
		let body = await afterImport({ imported: "somethingelse" });

		expect(body).not.toContain("Followed");
		expect(body).not.toContain("That file lists no feeds.");
		expect(body).not.toContain("That file could not be read as OPML.");
		expect(body).not.toContain("Choose an OPML file to import.");
	});
});
