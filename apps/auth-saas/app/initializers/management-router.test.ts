/**
 * The production management router answers every session-policy route through its own
 * controller: an unauthenticated call reaches the route's bearer-token check, so the
 * route is mapped, while a path no route claims still falls through to the `404` handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { managementRouter } from "~/app/initializers/management-router";

/** Sends `method path` to the production router with no credential. */
async function unauthenticated(method: string, path: string): Promise<Response> {
	return await managementRouter.fetch(
		new Request(`https://api.auth.example.com${path}`, { method }),
	);
}

describe("managementRouter", () => {
	test.each([
		["GET", "/tenants/tenant-1/session-policy"],
		["POST", "/tenants/tenant-1/session-policy"],
	])("maps %s %s to a controller that demands a bearer token", async (method, path) => {
		let response = await unauthenticated(method, path);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
	});

	test("answers 404 for a tenant path no route claims", async () => {
		let response = await unauthenticated("GET", "/tenants/tenant-1/unmapped");

		expect(response.status).toBe(404);
	});
});
