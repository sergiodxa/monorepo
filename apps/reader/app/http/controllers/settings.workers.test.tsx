/**
 * Drives the `/settings` controller against the reader's real Durable Object, inside
 * workerd, over the `USER` binding. The controller's own tests answer from a store double,
 * which proves the branch a save takes and nothing about what the object stored; this file
 * saves a cadence, follows the redirect the browser would follow, and reads the cadence
 * back off the form that comes with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import settings from "~/app/http/controllers/settings";
import { createTestRouter, fetchRoute } from "~/app/lib/test/controller";
import routes from "~/routes/web";

/**
 * A reader no other test in this file shares. Durable Object storage outlives a test and
 * `getByName` hands back whatever object a name already has, so each test signs in as
 * somebody new rather than depending on the order the file ran in.
 */
function createViewer(): Viewer {
	return {
		id: `sub-${crypto.randomUUID()}`,
		name: "Ada Lovelace",
		email: "ada@example.com",
		avatar: "",
	};
}

/** A router with the real settings controller mapped, signed in as `viewer`. */
function createRouter(viewer: Viewer): Router {
	let router = createTestRouter(viewer);
	router.map(routes.settings, settings);
	return router;
}

/** The cadence the rendered form shows chosen, read off the radio carrying `checked`. */
function checkedInterval(html: string): string | null {
	return /<input[^>]*\bvalue="(\d+)"[^>]*\bchecked\b/.exec(html)?.[1] ?? null;
}

/** Signs a reader in the way a completed sign-in does, creating their settings row. */
async function signIn(viewer: Viewer): Promise<void> {
	await env.USER.getByName(viewer.id).ensureUser(viewer.id);
}

/**
 * A reader whose object nothing has provisioned, which is the state every session older
 * than the settings feature is in: their object was written by the feeds they follow, and
 * the sign-in that would have created their settings row ran before there was one to
 * create. The page has to work from there, so these tests deliberately skip the sign-in.
 */
describe("POST /settings for a reader whose settings row was never written", () => {
	test("saves the cadence and shows it chosen on the page the redirect lands on", async () => {
		let viewer = createViewer();

		let router = createRouter(viewer);

		let before = await (await fetchRoute(router, routes.settings.index.href())).text();
		expect(checkedInterval(before)).toBe("1");

		let saved = await fetchRoute(router, routes.settings.action.href(), {
			refreshIntervalHours: "6",
		});

		expect(saved.status).toBe(303);
		expect(saved.headers.get("location")).toBe(`${routes.settings.index.href()}?saved`);

		// The object is what the reader actually changed, so it is asserted apart from the
		// page: a page that renders the old cadence and a store that kept the old cadence
		// are different defects with different fixes.
		expect(await env.USER.getByName(viewer.id).getSettings()).toMatchObject({
			refreshIntervalHours: 6,
		});

		let landed = await fetchRoute(router, saved.headers.get("location") ?? "");
		let html = await landed.text();

		expect(landed.status).toBe(200);
		expect(html).toContain("Saved.");
		expect(checkedInterval(html)).toBe("6");
	});

	test("keeps the cadence across a fresh request with no redirect behind it", async () => {
		let viewer = createViewer();

		await fetchRoute(createRouter(viewer), routes.settings.action.href(), {
			refreshIntervalHours: "24",
		});

		// A separate router stands in for the reader coming back later: nothing is carried
		// over from the save but the object's own storage.
		let html = await (await fetchRoute(createRouter(viewer), routes.settings.index.href())).text();

		expect(checkedInterval(html)).toBe("24");
		expect(html).not.toContain("Saved.");
	});

	test("refuses a cadence off the offered set without touching the stored one", async () => {
		let viewer = createViewer();

		let router = createRouter(viewer);
		await fetchRoute(router, routes.settings.action.href(), { refreshIntervalHours: "6" });

		let refused = await fetchRoute(router, routes.settings.action.href(), {
			refreshIntervalHours: "2",
		});

		expect(refused.status).toBe(422);
		expect(await env.USER.getByName(viewer.id).getSettings()).toMatchObject({
			refreshIntervalHours: 6,
		});
	});
});

describe("POST /settings for a reader a sign-in has provisioned", () => {
	test("saves the cadence and shows it chosen on the page the redirect lands on", async () => {
		let viewer = createViewer();
		await signIn(viewer);

		let router = createRouter(viewer);

		let before = await (await fetchRoute(router, routes.settings.index.href())).text();
		expect(checkedInterval(before)).toBe("1");

		let saved = await fetchRoute(router, routes.settings.action.href(), {
			refreshIntervalHours: "9",
		});

		expect(saved.status).toBe(303);

		let html = await (await fetchRoute(router, saved.headers.get("location") ?? "")).text();

		expect(html).toContain("Saved.");
		expect(checkedInterval(html)).toBe("9");
	});
});
