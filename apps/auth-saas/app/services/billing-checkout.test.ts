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
import { beforeEach, describe, expect, test } from "vitest";

import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import { finishCheckout, openCheckout } from "./billing-checkout";

let db: Database;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	billing = new MemoryBilling({
		catalog: { pro: { amount: 4900, currency: "usd", interval: "month" } },
	});
});

describe("openCheckout", () => {
	test("opens a hosted checkout and records the attempt before returning it", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let opened = await openCheckout(db, billing, {
			tenantId: tenant.id,
			email: "jane@example.com",
			product: "pro",
			kind: "base",
			returnTo: "https://acme.example.com/return",
		});

		expect(opened.ok).toBe(true);
		if (!opened.ok) throw new Error("unreachable");
		expect(opened.url).toMatch(/^https:\/\//);

		let joined = await Customer.findById(db, customer.id);
		expect(joined?.provider_customer_id).not.toBeNull();
	});

	test("answers tenant_not_found for an unknown tenant", async () => {
		let opened = await openCheckout(db, billing, {
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
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let opened = await openCheckout(db, billing, {
			tenantId: tenant.id,
			email: "jane@example.com",
			product: "pro",
			kind: "base",
			returnTo: "https://acme.example.com/return",
		});
		if (!opened.ok) throw new Error("unreachable");

		let checkoutId = new URL(opened.url).pathname.split("/").pop();
		if (!checkoutId) throw new Error("unreachable");

		let first = await finishCheckout(db, billing, checkoutId);
		expect(first.ok).toBe(true);
		if (!first.ok) throw new Error("unreachable");
		expect(first.tenant?.id).toBe(tenant.id);
		expect(first.tenant?.subscription_id).not.toBeNull();

		let second = await finishCheckout(db, billing, checkoutId);
		expect(second.ok).toBe(true);
		if (!second.ok) throw new Error("unreachable");
		expect(second.tenant?.id).toBe(tenant.id);
		expect(second.tenant?.subscription_id).toBe(first.tenant?.subscription_id);
	});
});
