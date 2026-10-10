/**
 * Exercises `openCheckout` and `finishCheckout` against `MemoryBilling`
 * (ADR-018): the intent is durable before anything leaves the process, and
 * settling a return is safe to run more than once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";

import { finishCheckout, openCheckout } from "./billing-checkout";

let db: Database;
let models: Models;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);
	billing = new MemoryBilling({
		catalog: { pro: { amount: 4900, currency: "usd", interval: "month" } },
	});
});

describe("openCheckout", () => {
	test("opens a hosted checkout and records the attempt before returning it", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);

		let opened = await openCheckout(models, billing, {
			tenantId: tenant.id,
			email: "jane@example.com",
			product: "pro",
			kind: "base",
			returnTo: "https://acme.example.com/return",
		});

		expect(opened.ok).toBe(true);
		if (!opened.ok) throw new Error("unreachable");
		expect(opened.url).toMatch(/^https:\/\//);

		let joined = await models.customers.find(customer.id);
		expect(joined?.provider_customer_id).not.toBeNull();
	});

	test("answers tenant_not_found for an unknown tenant", async () => {
		let opened = await openCheckout(models, billing, {
			tenantId: "ten_missing",
			email: "jane@example.com",
			product: "pro",
			kind: "base",
			returnTo: "https://acme.example.com/return",
		});

		expect(opened).toEqual({ ok: false, reason: "tenant_not_found" });
	});
});

describe("finishCheckout", () => {
	test("attaches the produced subscription and reprojects the tenant, safe to call twice", async () => {
		let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
		let tenant = unwrap(
			await models.tenants.create({
				customer_id: customer.id,
				name: "Acme, Inc.",
				slug: "acme",
				issuer: "https://acme.example.com",
			}),
		);

		let opened = await openCheckout(models, billing, {
			tenantId: tenant.id,
			email: "jane@example.com",
			product: "pro",
			kind: "base",
			returnTo: "https://acme.example.com/return",
		});
		if (!opened.ok) throw new Error("unreachable");

		let checkoutId = new URL(opened.url).pathname.split("/").pop();
		if (!checkoutId) throw new Error("unreachable");

		let first = await finishCheckout(models, billing, checkoutId);
		expect(first.ok).toBe(true);
		if (!first.ok) throw new Error("unreachable");
		expect(first.tenant?.id).toBe(tenant.id);
		expect(first.tenant?.subscription_id).not.toBeNull();
		expect(first.tenant?.plan_slug).toBe("pro");

		let second = await finishCheckout(models, billing, checkoutId);
		expect(second.ok).toBe(true);
		if (!second.ok) throw new Error("unreachable");
		expect(second.tenant?.id).toBe(tenant.id);
		expect(second.tenant?.subscription_id).toBe(first.tenant?.subscription_id);
	});
});
