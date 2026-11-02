/**
 * Tests Pulse, the ops dashboard demo, through the real router: its list filters really
 * filter the fixtures from the address, an empty query shows the no-results state, the peek
 * sheet opens from `?peek=`, and every form answers with the redirect and toast it promises.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { withoutToastNonce } from "~/app/test/demo-apps";
import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";
import pulse from "~/resources/views/demo-apps/pulse";

/** Pulse's screen addresses. */
const href = demoAppHref("pulse");

/** Pulse's form addresses. */
const action = demoAppActionHref("pulse");

/** Fetches a Pulse screen's HTML. */
async function page(path: string): Promise<string> {
	return await (await fetchApp(href(path))).text();
}

/** Posts a form to Pulse and returns where it redirected. */
async function post(path: string, fields: Record<string, string | string[]>): Promise<Response> {
	let body = new URLSearchParams();
	for (let [name, value] of Object.entries(fields)) {
		for (let one of [value].flat()) body.append(name, one);
	}
	return await fetchApp(action(path), { method: "POST", body });
}

describe("Pulse services list", () => {
	test("a status filter keeps only the matching services", async () => {
		let body = await page("services?status=down");

		expect(body).toContain(href("services/checkout-api"));
		expect(body).not.toContain(href("services/auth-service"));
	});

	test("a region filter and a search narrow the list together", async () => {
		let body = await page("services?region=sin&q=search");

		expect(body).toContain(href("services/search-gateway"));
		expect(body).not.toContain(href("services/notifications"));
	});

	test("a query that matches nothing shows the no-results state with Clear filters", async () => {
		let body = await page("services?q=billing");

		expect(body).toContain("No services match");
		expect(body).toContain("Clear filters");
		expect(body).not.toContain(href("services/checkout-api"));
	});

	test("a peek opens the service in a sheet beside the list, with its position", async () => {
		let body = await page("services?peek=checkout-api");

		expect(body).toContain('id="pulse-peek"');
		expect(body).toContain("Incidents and deploys");
	});

	test("an unknown peek leaves the sheet closed", async () => {
		expect(await page("services?peek=no-such-service")).not.toContain('id="pulse-peek"');
	});

	test("the loading and failed previews replace only the table", async () => {
		expect(await page("services?state=error")).toContain("Couldn't load services");
		expect(await page("services?state=loading")).toContain("Loading services");
	});
});

describe("Pulse frames", () => {
	test("every frame a screen streams answers with its part", async () => {
		let sources = new Set<string>();
		for (let screen of pulse.screens) {
			let body = await page(screen);
			for (let match of body.matchAll(/\/demo\/frames\/apps\/pulse\/[^"'<\s]+/g)) {
				sources.add(match[0].replaceAll("&amp;", "&"));
			}
		}

		expect(sources).toContain(demoAppFrameHref("pulse")("overview/stats?metric=uptime&range=24h"));
		expect(sources).toContain(demoAppFrameHref("pulse")("services/checkout-api/peek"));
		for (let source of sources) {
			expect([source, (await fetchApp(source)).status]).toEqual([source, 200]);
		}
	});

	test("a part or service Pulse lacks answers 404", async () => {
		let frame = demoAppFrameHref("pulse");
		expect((await fetchApp(frame("services/no-such-service/chart"))).status).toBe(404);
		expect((await fetchApp(frame("services/checkout-api/nothing"))).status).toBe(404);
		expect((await fetchApp(frame("overview/nothing"))).status).toBe(404);
	});

	test("the loading preview draws the stats in place without a frame", async () => {
		let body = await page("?state=loading");
		expect(body).toContain("Loading metrics");
		expect(body).not.toContain(demoAppFrameHref("pulse")("overview/stats"));
	});
});

describe("Pulse forms", () => {
	test("a bulk pause returns to the same filtered list with its toast", async () => {
		let response = await post("services", {
			intent: "pause",
			service: ["checkout-api", "search-gateway"],
			next: "services?status=down",
		});

		expect(response.status).toBe(303);
		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("services")}?status=down&toast=services-paused`,
		);
	});

	test("a bulk post with an unknown intent is rejected", async () => {
		expect((await post("services", { intent: "explode", service: "checkout-api" })).status).toBe(
			400,
		);
	});

	test("deleting a service offers Undo in its toast", async () => {
		let response = await post("services/checkout-api/delete", {});
		let location = response.headers.get("Location")!;

		expect(withoutToastNonce(location)).toBe(`${href("services")}?toast=service-deleted`);
		expect(await (await fetchApp(location)).text()).toContain("Undo");
	});

	test("each post's toast shows once, and a reload of its address adds no second one", async () => {
		let first = (await post("services/checkout-api/delete", {})).headers.get("Location")!;
		let second = (await post("services/checkout-api/delete", {})).headers.get("Location")!;
		let ids = async (location: string) =>
			[
				...(await (await fetchApp(location)).text()).matchAll(
					/data-slot="toast-item"[^>]*id="([^"]+)"|id="([^"]+)"[^>]*data-slot="toast-item"/g,
				),
			].map((match) => match[1] ?? match[2]);

		expect(first).not.toBe(second);
		expect(await ids(first)).toHaveLength(1);
		expect(await ids(first)).toEqual(await ids(first));
		expect(await ids(first)).not.toEqual(await ids(second));
	});

	test("a row action never follows a `next` outside the services list", async () => {
		let response = await post("services/checkout-api/pause", { next: "settings" });

		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("services/checkout-api")}?toast=service-paused`,
		);
	});

	test("a post for a service Pulse never watched is rejected", async () => {
		expect((await post("services/no-such-service/pause", {})).status).toBe(400);
	});

	test("deleting the workspace needs its slug typed exactly", async () => {
		let wrong = await post("settings/delete", { confirmation: "north" });
		let right = await post("settings/delete", { confirmation: "northwind" });

		expect(withoutToastNonce(wrong.headers.get("Location"))).toBe(
			`${href("settings")}?toast=not-deleted`,
		);
		expect(withoutToastNonce(right.headers.get("Location"))).toBe(
			`${href()}?toast=workspace-deleted`,
		);
	});

	test("an invalid escalation email comes back as not saved", async () => {
		let response = await post("settings/escalation", { email: "nope", after: "15" });

		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("settings/notifications")}?toast=not-saved`,
		);
	});

	test("saving a service's settings lands on its settings tab", async () => {
		let response = await post("services/auth-service/settings", {
			name: "auth-service",
			interval: "60",
			timeoutMs: "10000",
		});

		expect(withoutToastNonce(response.headers.get("Location"))).toBe(
			`${href("services/auth-service")}?tab=settings&toast=service-saved`,
		);
	});
});
