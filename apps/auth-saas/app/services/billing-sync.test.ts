/**
 * Drives the real `POST /webhooks/billing` endpoint against `MemoryBilling`, per
 * the package's "Pattern: Testing A Billing Flow": nothing is mocked, so a
 * change to the contract shows up here rather than in a stale double.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subscription } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { BillingWebhook, MemoryWebhookStore } from "@sdxc/billing";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { unwrap } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import BillingCheckout from "~/app/models/billing-checkout";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import TenantEntitlement from "~/app/models/tenant-entitlement";
import { ensureProviderCustomer } from "~/app/services/billing-customer";
import { createTestDatabase } from "~/app/test/db";

import { createBillingWebhookHandlers, sweepStaleProjections } from "./billing-sync";

let db: Database;
let billing: MemoryBilling;

beforeEach(async () => {
	db = await createTestDatabase();
	billing = new MemoryBilling({
		catalog: {
			pro: { amount: 4900, currency: "usd", interval: "month", features: { sso: true } },
		},
	});
});

/** Opens and finishes a real checkout for a tenant's base plan, the way `openCheckout`/`finishCheckout` would. */
async function checkoutTenantOntoPro(
	tenantId: string,
	customerId: string,
	providerCustomerId: string,
) {
	let attempt = await BillingCheckout.open(db, {
		tenantId,
		customerId,
		productSlug: "pro",
		kind: "base",
	});

	let opened = await unwrap(
		billing.checkouts.create({
			product: "pro",
			customer: { id: providerCustomerId },
			idempotencyKey: attempt.attempt_id,
		}),
	);
	await BillingCheckout.attachCheckoutId(db, attempt.attempt_id, opened.id);

	return unwrap(billing.checkouts.finish(opened.id));
}

describe("POST /webhooks/billing", () => {
	test("a checkout completing provisions entitlements onto the right tenant", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let joined = await unwrap(
			ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" }),
		);
		let finished = await checkoutTenantOntoPro(tenant.id, customer.id, joined.providerCustomerId);

		let store = new MemoryWebhookStore();
		let endpoint = new BillingWebhook(billing, createBillingWebhookHandlers(db, billing), {
			store,
		});

		let delivery = await unwrap(
			billing.webhooks.emit({ type: "checkout.completed", checkout: finished }),
		);
		let response = await endpoint.handler(new RequestContext(delivery.request));

		expect(response.status).toBe(200);

		let updatedTenant = await Tenant.findById(db, tenant.id);
		expect(updatedTenant?.subscription_id).toBe(finished.subscriptionId);
		expect(updatedTenant?.subscription_status).toBe("active");

		let entitlement = await TenantEntitlement.findByTenant(db, tenant.id);
		expect(entitlement?.products).toEqual(["pro"]);
		expect(entitlement?.features).toEqual({ sso: true });
	});

	test("a webhook redelivery is deduplicated", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let joined = await unwrap(
			ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" }),
		);
		let finished = await checkoutTenantOntoPro(tenant.id, customer.id, joined.providerCustomerId);

		let store = new MemoryWebhookStore();
		let endpoint = new BillingWebhook(billing, createBillingWebhookHandlers(db, billing), {
			store,
		});

		let delivery = await unwrap(
			billing.webhooks.emit({ type: "checkout.completed", checkout: finished }),
		);

		let first = await endpoint.handler(new RequestContext(delivery.request));
		expect(first.status).toBe(200);

		// Reusing the same delivery id models a redelivery — a fresh signed
		// request, over the same id, the way a platform's own retry arrives.
		let redelivered = await unwrap(
			billing.webhooks.emit({
				type: "checkout.completed",
				checkout: finished,
				id: delivery.event.id,
			}),
		);
		let replay = await endpoint.handler(new RequestContext(redelivered.request));
		expect(replay.status).toBe(200);

		expect(store.deliveries).toHaveLength(1);
		expect(store.deliveries[0]?.processed).toBe(true);
	});

	test("subscription.revoked sets lapsed_at", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let joined = await unwrap(
			ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" }),
		);
		let finished = await checkoutTenantOntoPro(tenant.id, customer.id, joined.providerCustomerId);
		if (finished.subscriptionId === null) throw new Error("unreachable: base plan is recurring");

		let store = new MemoryWebhookStore();
		let endpoint = new BillingWebhook(billing, createBillingWebhookHandlers(db, billing), {
			store,
		});

		let completed = await unwrap(
			billing.webhooks.emit({ type: "checkout.completed", checkout: finished }),
		);
		await endpoint.handler(new RequestContext(completed.request));

		let subscription: Subscription = {
			id: finished.subscriptionId,
			customerId: joined.providerCustomerId,
			productSlug: "pro",
			priceId: null,
			status: "revoked",
			providerStatus: "revoked",
			amount: null,
			interval: "month",
			currentPeriodStart: null,
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false,
			canceledAt: null,
			endsAt: null,
			metadata: {},
			createdAt: new Date(),
			providerData: {},
		};

		let revoked = await unwrap(
			billing.webhooks.emit({ type: "subscription.revoked", subscription }),
		);
		let response = await endpoint.handler(new RequestContext(revoked.request));

		expect(response.status).toBe(200);

		let updatedTenant = await Tenant.findById(db, tenant.id);
		expect(updatedTenant?.subscription_status).toBe("revoked");
		expect(updatedTenant?.lapsed_at).not.toBeNull();
	});
});

describe("sweepStaleProjections", () => {
	test("refreshes only the projections read before the cutoff", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		let joined = await unwrap(
			ensureProviderCustomer(db, billing, customer, { email: "jane@example.com" }),
		);
		let finished = await checkoutTenantOntoPro(tenant.id, customer.id, joined.providerCustomerId);
		if (finished.subscriptionId === null) throw new Error("unreachable: base plan is recurring");
		await Tenant.update(db, tenant.id, { subscriptionId: finished.subscriptionId });

		await TenantEntitlement.upsert(db, tenant.id, {
			products: [],
			features: {},
			readAt: 1_000,
		});

		let swept = await sweepStaleProjections(db, billing, {
			now: 10_000_000,
			olderThanMs: 60 * 60 * 1000,
		});
		expect(swept).toEqual({ swept: 1 });

		let entitlement = await TenantEntitlement.findByTenant(db, tenant.id);
		expect(entitlement?.products).toEqual(["pro"]);
		expect(entitlement?.read_at).toBeGreaterThan(1_000);
	});

	test("leaves a freshly-read projection alone", async () => {
		let customer = await Customer.create(db, { name: "Acme, Inc." });
		let tenant = await Tenant.create(db, {
			customerId: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.example.com",
		});

		await TenantEntitlement.upsert(db, tenant.id, {
			products: [],
			features: {},
			readAt: Date.now(),
		});

		let swept = await sweepStaleProjections(db, billing);
		expect(swept).toEqual({ swept: 0 });
	});
});
