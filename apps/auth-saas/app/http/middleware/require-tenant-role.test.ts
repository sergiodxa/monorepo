/**
 * Behavioural tests for the `requireTenantRole` middleware: the allow/deny
 * decision it makes for each tenant role against the roles a route requires, and
 * its rule that safe (read-only) methods always pass so viewers keep read access.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test, vi } from "vitest";

import requireTenantRole from "./require-tenant-role";

/** A role value as stored on `context.tenant.role`. */
type Role = "owner" | "admin" | "viewer";

/**
 * Builds the minimal request context the middleware reads: the HTTP method and
 * the resolved tenant role. Anything else the middleware never touches.
 */
function buildContext(method: string, role: Role | undefined) {
	return {
		request: new Request("https://example.test/dashboard", { method }),
		tenant: role === undefined ? undefined : { role },
	} as never;
}

/** A `next` that records it ran and returns a sentinel 200 response. */
function passthroughNext() {
	let next = vi.fn(async () => new Response("ok", { status: 200 }));
	return next;
}

describe("requireTenantRole", () => {
	test("allows a mutating request when the role is in the allow-list", async () => {
		let middleware = requireTenantRole("owner", "admin");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", "admin"), next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("denies a mutating request when the role is not in the allow-list", async () => {
		let middleware = requireTenantRole("owner");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", "admin"), next);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	test("returns the permission error message on denial", async () => {
		let middleware = requireTenantRole("owner");
		let next = passthroughNext();

		let response = await middleware(buildContext("DELETE", "viewer"), next);
		let body = await response.text();

		expect(response.status).toBe(403);
		expect(body).toContain("You do not have permission to perform this action.");
	});

	test("denies a mutating request when no tenant role is resolved", async () => {
		let middleware = requireTenantRole("owner", "admin", "viewer");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", undefined), next);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	describe("safe methods always pass through regardless of role", () => {
		for (let method of ["GET", "HEAD", "OPTIONS"]) {
			test(`${method} passes even when the role is not allowed`, async () => {
				// Owner-only route, but a viewer issuing a read must still be let through.
				let middleware = requireTenantRole("owner");
				let next = passthroughNext();

				let response = await middleware(buildContext(method, "viewer"), next);

				expect(next).toHaveBeenCalledTimes(1);
				expect(response.status).toBe(200);
			});
		}

		test("a safe method passes even with no tenant role resolved", async () => {
			let middleware = requireTenantRole("owner");
			let next = passthroughNext();

			let response = await middleware(buildContext("GET", undefined), next);

			expect(next).toHaveBeenCalledTimes(1);
			expect(response.status).toBe(200);
		});
	});

	test("method matching is case-insensitive", async () => {
		let middleware = requireTenantRole("owner");
		let next = passthroughNext();

		// Lowercase "get" must still be treated as a safe method.
		let response = await middleware(buildContext("get", "viewer"), next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("a mutating method other than POST/DELETE is still enforced", async () => {
		// PATCH is not in the safe set, so the role gate applies.
		let middleware = requireTenantRole("owner", "admin");
		let next = passthroughNext();

		let response = await middleware(buildContext("PATCH", "viewer"), next);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	test("owner is allowed when owner is required", async () => {
		let middleware = requireTenantRole("owner");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", "owner"), next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(200);
	});

	test("viewer is denied a mutation on an admin-or-owner route", async () => {
		let middleware = requireTenantRole("owner", "admin");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", "viewer"), next);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});

	test("admin is denied on an owner-only mutation (e.g. billing)", async () => {
		// Admins have full access except billing, which is owner-gated.
		let middleware = requireTenantRole("owner");
		let next = passthroughNext();

		let response = await middleware(buildContext("POST", "admin"), next);

		expect(next).not.toHaveBeenCalled();
		expect(response.status).toBe(403);
	});
});
