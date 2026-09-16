/**
 * Tests the `/settings` controller: the guard on the page, what it says about the schedule
 * its feeds are checked on — which is a sentence rather than a control, since the cadence
 * is one number for every reader — the transfer section, and the sentence each outcome an
 * import returns here with is reported as.
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
import { createUserStoreDouble, DEFAULT_SETTINGS } from "~/app/lib/test/store";
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

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("GET /settings", () => {
	test("sends an anonymous visitor home", async () => {
		let response = await fetchRoute(createRouter(null), routes.settings.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.home.href());
		expect(store.getSettings).not.toHaveBeenCalled();
	});

	test("says what the schedule is and where a reader goes for a feed sooner", async () => {
		let response = await fetchRoute(createRouter(VIEWER), routes.settings.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("How your feeds are checked");
		expect(html).toContain("Every feed is checked once a day.");
		expect(html).toContain("Check feed");
	});

	/**
	 * The cadence is withdrawn rather than hidden, so the page offers nothing to submit it
	 * with: a field left behind would be a promise the store has no method to keep.
	 */
	test("offers no control for choosing a cadence", async () => {
		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

		expect(html).not.toContain("refreshIntervalHours");
		expect(html).not.toContain("Every hour");
		expect(html).not.toMatch(/name="(cadence|interval|checkInterval)"/);
	});

	test("shows when the feeds were last checked", async () => {
		let lastRefreshedAt = Date.UTC(2026, 2, 14, 12, 0, 0);
		store.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, lastRefreshedAt });

		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

		expect(html).toContain("Last checked");
		/**
		 * The line says how long ago in the words the rest of the app dates things in, and
		 * carries the exact date in the tooltip that stands behind it.
		 */
		expect(html).toContain(
			new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(lastRefreshedAt),
		);
	});

	test("says so when the feeds have never been checked", async () => {
		let html = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

		expect(html).toContain("Not checked yet");
	});
});

describe("the transfer section", () => {
	test("offers the subscription list as a download", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

		expect(body).toContain(`href="${routes.feeds.export.href()}"`);
		expect(body).toContain("Download as OPML");
	});

	test("uploads an OPML document in the encoding that carries its bytes", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

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
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

		expect(/<input[^>]*type="file"[^>]*\brequired\b/.test(body)).toBe(false);
	});

	test("ties the picker to the passage saying what it asks for", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

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
		let url = `${routes.settings.href()}?${new URLSearchParams(query)}`;
		return fetchRoute(createRouter(VIEWER), url).then((response) => response.text());
	}

	test("says nothing on a page nobody was returned to", async () => {
		let body = await (await fetchRoute(createRouter(VIEWER), routes.settings.href())).text();

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

	/**
	 * A styled trigger hides the input, so nothing says which file was chosen and there is
	 * no script here to say it. The platform's own control names the file it holds.
	 */
	test("offers a real file input, labelled and typed as one", async () => {
		let body = await afterImport({});

		let input = body.match(/<input[^>]*type="file"[^>]*>/)?.[0];
		expect(input, "the import field is a file input").toBeTruthy();
		expect(input).toContain('name="file"');

		let id = input?.match(/id="([^"]+)"/)?.[1];
		expect(body).toContain(`for="${id}"`);
	});

	/**
	 * The client runtime navigates a link by fetching it, and a file it is handed has
	 * nowhere to go — so the export has to stay the browser's own navigation.
	 */
	test("leaves the export to the browser rather than the client runtime", async () => {
		let body = await afterImport({});

		let link = body.match(new RegExp(`<a[^>]*href="${routes.feeds.export.href()}"[^>]*>`))?.[0];
		expect(link, "the export is a link").toBeTruthy();
		expect(link).toContain("data-rmx-document");
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
