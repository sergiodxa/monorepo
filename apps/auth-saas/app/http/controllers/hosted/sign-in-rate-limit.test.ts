/**
 * Drives `signInSubmit` through a router that also mounts
 * `interactiveCredentialRateLimit`, the way `tenant-app.ts` wires them
 * together: a wrong password spends the request's own unit plus the extra
 * spend `sign-in.tsx` adds on top, so a run of wrong guesses exhausts the
 * shared budget faster than the same number of successful attempts would.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware, RequestHandler } from "remix/router";

import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import i18n from "~/app/http/middleware/i18n";
import render from "~/app/http/middleware/render";
import { tenant } from "~/app/http/middleware/tenant";
import { interactiveCredentialRateLimit } from "~/app/http/middleware/tenant-rate-limit";
import routes from "~/routes/tenant";

import { signInSubmit } from "./sign-in";
import { buildHarness, createTestSubjectWithPassword } from "./test-harness";

/** A rate limiter binding that counts real calls per key, the way Cloudflare's own binding would within one window. */
function countingLimiter(limit: number): RateLimiterBinding {
	let counts = new Map<string, number>();
	return {
		async limit({ key }) {
			let count = (counts.get(key) ?? 0) + 1;
			counts.set(key, count);
			return { success: count <= limit };
		},
	};
}

describe("signInSubmit under interactiveCredentialRateLimit", () => {
	test("a run of wrong passwords exhausts the shared budget before a matching run of successes would", async () => {
		let harness = await buildHarness();
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let limiter = countingLimiter(10);
		let middleware: Middleware[] = [
			tenant(() => harness.tenantDO as unknown as DurableObjectStub<Tenant>),
			render as Middleware,
			formData() as Middleware,
			i18n as Middleware,
		];
		let router = createRouter({ middleware });
		router.map(routes.hostedSignInSubmit, {
			middleware: [interactiveCredentialRateLimit(limiter)],
			handler: signInSubmit as RequestHandler,
		});

		function attempt(password: string) {
			let body = new URLSearchParams({ identifier: "jane@example.com", password });
			return router.fetch(
				harness.request(`/u/sign-in?interaction=int_1`, {
					method: "POST",
					body,
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
				}),
			);
		}

		// Each wrong attempt spends 1 (the request) + 4 (the post-failure spend) = 5
		// units, so two wrong guesses already exhaust the 10-unit budget.
		let first = await attempt("wrong-one");
		let second = await attempt("wrong-two");
		let third = await attempt("wrong-three");

		expect(first.status).toBe(400);
		expect(second.status).toBe(400);
		expect(third.status).toBe(429);
	});

	test("the same number of correct sign-ins does not exhaust the budget", async () => {
		let harness = await buildHarness();
		await createTestSubjectWithPassword(harness.tenantDO, {
			email: "jane@example.com",
			password: "correct horse battery staple",
		});

		let limiter = countingLimiter(10);
		let middleware: Middleware[] = [
			tenant(() => harness.tenantDO as unknown as DurableObjectStub<Tenant>),
			render as Middleware,
			formData() as Middleware,
			i18n as Middleware,
		];
		let router = createRouter({ middleware });
		router.map(routes.hostedSignInSubmit, {
			middleware: [interactiveCredentialRateLimit(limiter)],
			handler: signInSubmit as RequestHandler,
		});

		function attempt() {
			let body = new URLSearchParams({
				identifier: "jane@example.com",
				password: "correct horse battery staple",
			});
			return router.fetch(
				harness.request(`/u/sign-in?interaction=int_1`, {
					method: "POST",
					body,
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
				}),
			);
		}

		let first = await attempt();
		let second = await attempt();
		let third = await attempt();

		expect(first.status).not.toBe(429);
		expect(second.status).not.toBe(429);
		expect(third.status).not.toBe(429);
	});
});
