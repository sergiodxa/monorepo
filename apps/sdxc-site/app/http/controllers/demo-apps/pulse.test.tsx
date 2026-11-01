/**
 * Tests Pulse, the ops dashboard demo, through the real router: its list filters really
 * filter the fixtures from the address, an empty query shows the no-results state, the peek
 * sheet opens from `?peek=`, and every form answers with the redirect and toast it promises.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";
import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

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

describe("Pulse forms", () => {
	test("a bulk pause returns to the same filtered list with its toast", async () => {
		let response = await post("services", {
			intent: "pause",
			service: ["checkout-api", "search-gateway"],
			next: "services?status=down",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
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

		expect(location).toBe(`${href("services")}?toast=service-deleted`);
		expect(await (await fetchApp(location)).text()).toContain("Undo");
	});

	test("a row action never follows a `next` outside the services list", async () => {
		let response = await post("services/checkout-api/pause", { next: "settings" });

		expect(response.headers.get("Location")).toBe(
			`${href("services/checkout-api")}?toast=service-paused`,
		);
	});

	test("a post for a service Pulse never watched is rejected", async () => {
		expect((await post("services/no-such-service/pause", {})).status).toBe(400);
	});

	test("deleting the workspace needs its slug typed exactly", async () => {
		let wrong = await post("settings/delete", { confirmation: "north" });
		let right = await post("settings/delete", { confirmation: "northwind" });

		expect(wrong.headers.get("Location")).toBe(`${href("settings")}?toast=not-deleted`);
		expect(right.headers.get("Location")).toBe(`${href()}?toast=workspace-deleted`);
	});

	test("an invalid escalation email comes back as not saved", async () => {
		let response = await post("settings/escalation", { email: "nope", after: "15" });

		expect(response.headers.get("Location")).toBe(
			`${href("settings/notifications")}?toast=not-saved`,
		);
	});

	test("saving a service's settings lands on its settings tab", async () => {
		let response = await post("services/auth-service/settings", {
			name: "auth-service",
			interval: "60",
			timeoutMs: "10000",
		});

		expect(response.headers.get("Location")).toBe(
			`${href("services/auth-service")}?tab=settings&toast=service-saved`,
		);
	});
});
