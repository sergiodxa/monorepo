/**
 * Tests the request-side wiring: the middleware publishes the configured
 * platform as `context.billing`, resolves a per-request provider through the
 * factory form, and the guard admits or answers a request from the projection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Billing } from "../core/contract";

import { MemoryBilling } from "../providers/memory";

import type { EntitlementSnapshot } from "./index";

import billing, { Entitlements, requireEntitlement } from "./index";

/** A projection granting one feature, which is what an entitled request carries. */
const ENTITLED: EntitlementSnapshot = { products: ["pro"], features: { flow_monitors: true } };

/** A projection granting nothing, which is what a free subject carries. */
const FREE: EntitlementSnapshot = { products: [], features: {} };

/** Builds the context a middleware is driven against, with no router involved. */
function context(url = "https://example.com/app/flows"): RequestContext {
	return new RequestContext(new Request(url));
}

/** Stands in for the handler behind the middleware under test. */
async function ok(): Promise<Response> {
	return new Response("ok");
}

describe("billing middleware", () => {
	test("publishes the configured provider as context.billing", async () => {
		let provider = new MemoryBilling({ connection: "memory_eu" });
		let ctx = context();
		let seen: Billing | undefined;

		await billing({ provider })(ctx, async () => {
			seen = ctx.billing;
			return new Response("ok");
		});

		expect(seen).toBe(provider);
		expect(seen?.connection).toBe("memory_eu");
	});

	test("resolves the provider per request when given a factory", async () => {
		let tenants = { eu: new MemoryBilling({ connection: "eu" }) };
		let ctx = context("https://example.com/eu/app");
		let urls: string[] = [];

		await billing({
			provider: (current) => {
				urls.push(current.url.pathname);
				return tenants.eu;
			},
		})(ctx, ok);

		expect(urls).toEqual(["/eu/app"]);
		expect(ctx.billing).toBe(tenants.eu);
	});

	test("returns the downstream response unchanged", async () => {
		let ctx = context();

		let response = await billing({ provider: new MemoryBilling() })(
			ctx,
			async () => new Response("body", { status: 201 }),
		);

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("body");
	});
});

describe("requireEntitlement", () => {
	test("admits a request the projection entitles and publishes the snapshot", async () => {
		let ctx = context();
		let reads = 0;

		await billing({
			provider: new MemoryBilling(),
			entitlements: () => {
				reads += 1;
				return ENTITLED;
			},
		})(ctx, ok);

		let response = await requireEntitlement("flow_monitors")(ctx, ok);

		expect(response.status).toBe(200);
		expect(reads).toBe(1);
		expect(ctx.get(Entitlements)).toEqual(ENTITLED);
		expect((ctx as unknown as { entitlements: EntitlementSnapshot }).entitlements).toEqual(
			ENTITLED,
		);
	});

	test("answers 403 and stops the handler when the feature is absent", async () => {
		let ctx = context();
		let reached = false;

		await billing({ provider: new MemoryBilling(), entitlements: () => FREE })(ctx, ok);

		let response = await requireEntitlement("flow_monitors")(ctx, async () => {
			reached = true;
			return new Response("ok");
		});

		expect(response.status).toBe(403);
		expect(reached).toBe(false);
		expect(ctx.has(Entitlements)).toBe(false);
	});

	test("answers 403 for a request that carries no billable subject", async () => {
		let ctx = context();

		await billing({ provider: new MemoryBilling(), entitlements: () => null })(ctx, ok);

		let response = await requireEntitlement("flow_monitors")(ctx, ok);

		expect(response.status).toBe(403);
	});

	test("answers through onDenied when the app supplies one", async () => {
		let ctx = context();
		let denied: string[] = [];

		await billing({ provider: new MemoryBilling(), entitlements: () => FREE })(ctx, ok);

		let response = await requireEntitlement("flow_monitors", {
			onDenied: (_, feature) => {
				denied.push(feature);
				return new Response(null, { status: 303, headers: { Location: "/pricing" } });
			},
		})(ctx, ok);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/pricing");
		expect(denied).toEqual(["flow_monitors"]);
	});

	test("awaits an asynchronous projection read", async () => {
		let ctx = context();

		await billing({
			provider: new MemoryBilling(),
			entitlements: async () => ENTITLED,
		})(ctx, ok);

		expect((await requireEntitlement("flow_monitors")(ctx, ok)).status).toBe(200);
	});

	test("reads the projection once for two stacked guards", async () => {
		let ctx = context();
		let reads = 0;

		await billing({
			provider: new MemoryBilling(),
			entitlements: () => {
				reads += 1;
				return { products: ["pro"], features: { flow_monitors: true, alerts: true } };
			},
		})(ctx, ok);

		await requireEntitlement("flow_monitors")(ctx, async () =>
			requireEntitlement("alerts")(ctx, ok),
		);

		expect(reads).toBe(1);
	});

	test("reports the missing configuration when no projection was supplied", async () => {
		let ctx = context();

		await billing({ provider: new MemoryBilling() })(ctx, ok);

		await expect(requireEntitlement("flow_monitors")(ctx, ok)).rejects.toThrow(
			/Entitlement projection not found/,
		);
	});
});
