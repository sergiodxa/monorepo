/**
 * Unit tests for the `Customer` billing model: resolving a signed-in subject to a
 * Polar customer (by external id first, then by email, creating one when neither
 * exists), subscription status, and hosted checkout/portal/cancellation flows. Uses a
 * fake object shaped like the subset of `PolarClient` these methods call — no real
 * Polar client is constructed and no network calls are made.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Customer as PolarCustomer, PolarClient, Subscription } from "@pkg/polar";

import IdToken from "~/app/auth/value-objects/id-token";
import Customer from "~/app/data/customer";

/** The Polar product id `Customer` gates the monitoring subscription on. Mirrors the module-private `SUBSCRIPTION_PRODUCT_ID` constant in `app/data/customer.ts`. */
const SUBSCRIPTION_PRODUCT_ID = "94161883-14eb-42e2-bb26-b4647199cda1";

/** The subset of `PolarClient` that `Customer` actually calls. */
type FakePolarClient = Pick<
	PolarClient,
	| "getExternalCustomer"
	| "findCustomerByEmail"
	| "createCustomer"
	| "updateCustomer"
	| "hasActiveSubscription"
	| "createCheckoutSession"
	| "createPortalSession"
	| "listSubscriptions"
	| "revokeSubscription"
>;

/** Builds a fake `PolarClient` that throws for any method not explicitly overridden. */
function fakePolar(overrides: Partial<FakePolarClient>): PolarClient {
	let notImplemented = (name: string) => () => {
		throw new Error(`unexpected call to PolarClient#${name} in this test`);
	};

	let fake: FakePolarClient = {
		getExternalCustomer: notImplemented("getExternalCustomer"),
		findCustomerByEmail: notImplemented("findCustomerByEmail"),
		createCustomer: notImplemented("createCustomer"),
		updateCustomer: notImplemented("updateCustomer"),
		hasActiveSubscription: notImplemented("hasActiveSubscription"),
		createCheckoutSession: notImplemented("createCheckoutSession"),
		createPortalSession: notImplemented("createPortalSession"),
		listSubscriptions: notImplemented("listSubscriptions"),
		revokeSubscription: notImplemented("revokeSubscription"),
		...overrides,
	};

	return fake as unknown as PolarClient;
}

function polarCustomer(overrides: Partial<PolarCustomer> = {}): PolarCustomer {
	return {
		id: "cus-1",
		externalId: null,
		email: "user@example.com",
		name: "User One",
		...overrides,
	} as PolarCustomer;
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
	return {
		id: "sub-1",
		productId: SUBSCRIPTION_PRODUCT_ID,
		status: "active",
		...overrides,
	} as Subscription;
}

let idToken = new IdToken({ sub: "user-1", email: "user@example.com", name: "User One" });

describe("Customer.findOrCreate", () => {
	test("returns the customer found by external id without any other lookup", async () => {
		let existing = polarCustomer({ id: "cus-external" });
		let polar = fakePolar({ getExternalCustomer: async () => existing });

		let customer = await Customer.findOrCreate(polar, idToken);
		expect(customer).toEqual(existing);
	});

	test("links the external id when found by email without one", async () => {
		let byEmail = polarCustomer({ id: "cus-by-email", externalId: null });
		let updated = polarCustomer({ id: "cus-by-email", externalId: "user-1" });

		let updateCalls: Array<{ id: string; updates: unknown }> = [];
		let polar = fakePolar({
			getExternalCustomer: async () => null,
			findCustomerByEmail: async () => byEmail,
			updateCustomer: async (id, updates) => {
				updateCalls.push({ id, updates });
				return updated;
			},
		});

		let customer = await Customer.findOrCreate(polar, idToken);
		expect(customer).toEqual(updated);
		expect(updateCalls).toEqual([{ id: "cus-by-email", updates: { externalId: "user-1" } }]);
	});

	test("returns the customer found by email as-is when it already has an external id", async () => {
		let byEmail = polarCustomer({ id: "cus-by-email", externalId: "some-other-subject" });
		let polar = fakePolar({
			getExternalCustomer: async () => null,
			findCustomerByEmail: async () => byEmail,
		});

		let customer = await Customer.findOrCreate(polar, idToken);
		expect(customer).toEqual(byEmail);
	});

	test("creates a new customer when neither external id nor email match", async () => {
		let created = polarCustomer({ id: "cus-new" });
		let createCalls: Array<{ email: string; name: string | null }> = [];
		let polar = fakePolar({
			getExternalCustomer: async () => null,
			findCustomerByEmail: async () => null,
			createCustomer: async (email, name) => {
				createCalls.push({ email, name: name ?? null });
				return created;
			},
		});

		let customer = await Customer.findOrCreate(polar, idToken);
		expect(customer).toEqual(created);
		expect(createCalls).toEqual([{ email: "user@example.com", name: "User One" }]);
	});
});

describe("Customer.hasActiveSubscription", () => {
	test("delegates to polar.hasActiveSubscription with the monitoring product id", async () => {
		let calls: Array<{ externalCustomerId: string; productId: string }> = [];
		let polar = fakePolar({
			hasActiveSubscription: async (externalCustomerId, productId) => {
				calls.push({ externalCustomerId, productId });
				return true;
			},
		});

		expect(await Customer.hasActiveSubscription(polar, "owner-1")).toBe(true);
		expect(calls).toEqual([{ externalCustomerId: "owner-1", productId: SUBSCRIPTION_PRODUCT_ID }]);
	});

	test("returns false when there's no active subscription", async () => {
		let polar = fakePolar({ hasActiveSubscription: async () => false });

		expect(await Customer.hasActiveSubscription(polar, "owner-1")).toBe(false);
	});
});

describe("Customer.checkout", () => {
	test("creates a checkout session for the owner's existing customer", async () => {
		let customer = polarCustomer({ id: "cus-owner" });
		let checkoutCalls: Array<{
			productId: string;
			customerId: string | undefined;
			successUrl: string;
		}> = [];
		let polar = fakePolar({
			getExternalCustomer: async () => customer,
			createCheckoutSession: async (productId, customerId, successUrl) => {
				checkoutCalls.push({ productId, customerId, successUrl });
				return { url: "https://polar.sh/checkout/123" };
			},
		});

		let url = await Customer.checkout(polar, "owner-1", "https://app.example.com/success");
		expect(url).toBe("https://polar.sh/checkout/123");
		expect(checkoutCalls).toEqual([
			{
				productId: SUBSCRIPTION_PRODUCT_ID,
				customerId: "cus-owner",
				successUrl: "https://app.example.com/success",
			},
		]);
	});

	test("lets Polar create the customer during checkout when none exists yet", async () => {
		let checkoutCalls: Array<{ customerId: string | undefined }> = [];
		let polar = fakePolar({
			getExternalCustomer: async () => null,
			createCheckoutSession: async (_productId, customerId) => {
				checkoutCalls.push({ customerId });
				return { url: "https://polar.sh/checkout/456" };
			},
		});

		let url = await Customer.checkout(polar, "owner-1", "https://app.example.com/success");
		expect(url).toBe("https://polar.sh/checkout/456");
		expect(checkoutCalls).toEqual([{ customerId: undefined }]);
	});
});

describe("Customer.portal", () => {
	test("creates a portal session for the owner's customer", async () => {
		let customer = polarCustomer({ id: "cus-owner" });
		let portalCalls: string[] = [];
		let polar = fakePolar({
			getExternalCustomer: async () => customer,
			createPortalSession: async (customerId) => {
				portalCalls.push(customerId);
				return { url: "https://polar.sh/portal/123" };
			},
		});

		let url = await Customer.portal(polar, "owner-1");
		expect(url).toBe("https://polar.sh/portal/123");
		expect(portalCalls).toEqual(["cus-owner"]);
	});

	test("throws when the owner has no Polar customer", async () => {
		let polar = fakePolar({ getExternalCustomer: async () => null });

		await expect(Customer.portal(polar, "owner-1")).rejects.toThrow(
			"No Polar customer found for owner owner-1",
		);
	});
});

describe("Customer.cancelSubscriptions", () => {
	test("does nothing when the owner has no Polar customer", async () => {
		let polar = fakePolar({ getExternalCustomer: async () => null });

		await expect(Customer.cancelSubscriptions(polar, "owner-1")).resolves.toBeUndefined();
	});

	test("revokes only active subscriptions to the monitoring product", async () => {
		let customer = polarCustomer({ id: "cus-owner" });
		let revokedIds: string[] = [];
		let polar = fakePolar({
			getExternalCustomer: async () => customer,
			listSubscriptions: async () => [
				subscription({
					id: "sub-active-match",
					productId: SUBSCRIPTION_PRODUCT_ID,
					status: "active",
				}),
				subscription({
					id: "sub-canceled-match",
					productId: SUBSCRIPTION_PRODUCT_ID,
					status: "canceled",
				}),
				subscription({
					id: "sub-active-other-product",
					productId: "other-product",
					status: "active",
				}),
			],
			revokeSubscription: async (subscriptionId) => {
				revokedIds.push(subscriptionId);
				return subscription({ id: subscriptionId, status: "canceled" });
			},
		});

		await Customer.cancelSubscriptions(polar, "owner-1");
		expect(revokedIds).toEqual(["sub-active-match"]);
	});
});
