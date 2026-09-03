/**
 * Unit tests for the `Customer` billing policy: resolving a signed-in subject to a platform
 * customer (by our own id first, then by address, creating one when neither matches), the
 * hosted checkout and portal it opens, and what cancelling an account's billing means here.
 *
 * The hosted pages and the cancellation run against a real in-memory platform, so what one
 * call writes is what the next call reads. The resolution branches run against a stand-in
 * instead: they are about which lookup happens in which order, and one of them needs a state
 * the in-memory platform cannot hold — a customer it knows with none of our ids on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Billing,
	CreateCheckoutInput,
	CreatePortalInput,
	Customer as BillingCustomer,
	CustomerApi,
} from "@sdxc/billing";

import { IdToken } from "@sdxc/auth/id-token";
import { BillingError } from "@sdxc/billing";
import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import Customer from "~/app/data/customer";
import { MONITORING_PRODUCT } from "~/app/lib/billing";
import { createTestBilling } from "~/app/lib/test/billing";
import routes from "~/routes/web";

/** The team every hosted page below is opened for. */
const TEAM = { slug: "acme", owner_id: "owner-1" };

/** The page the owner was on when they asked for billing. */
const REQUEST_URL = new URL("https://app.example.com/app/acme/checkout");

/** Where both hosted pages have to send the owner back to. */
const DASHBOARD = new URL(
	routes.app.team.dashboard.index.href({ team: TEAM.slug }),
	REQUEST_URL,
).toString();

let idToken = new IdToken({ sub: "user-1", email: "user@example.com", name: "User One" });

/** A platform customer as a read reports one. */
function customer(overrides: Partial<BillingCustomer> = {}): BillingCustomer {
	return {
		id: "cus-1",
		externalId: null,
		email: "user@example.com",
		name: "User One",
		metadata: {},
		createdAt: new Date("2026-07-01T00:00:00.000Z"),
		providerData: {},
		...overrides,
	};
}

/** A `not_found`, which is how every read reports a record the platform does not hold. */
function missing(what: string) {
	return failure(new BillingError(what, { code: "not_found", connection: "stub" }));
}

/**
 * A platform answering only the customer reads under test; every other call fails the test
 * loudly, so a branch that reaches further than it should is visible rather than silent.
 */
function stubBilling(customers: Partial<CustomerApi>): Billing {
	let unexpected = (name: string) => () => {
		throw new Error(`unexpected call to ${name} in this test`);
	};

	return {
		connection: "stub",
		customers: {
			find: unexpected("customers.find"),
			findByEmail: unexpected("customers.findByEmail"),
			create: unexpected("customers.create"),
			update: unexpected("customers.update"),
			list: unexpected("customers.list"),
			...customers,
		},
	} as unknown as Billing;
}

describe("Customer.provision", () => {
	test("answers the customer already linked to the subject, looking no further", async () => {
		let linked = customer({ id: "cus-linked", externalId: "user-1" });
		let billing = stubBilling({ find: async () => success(linked) });

		expect(await unwrap(Customer.provision(billing, idToken))).toEqual(linked);
	});

	test("adopts a customer holding the address but none of our ids", async () => {
		let unlinked = customer({ id: "cus-by-email", externalId: null });
		let adopted = customer({ id: "cus-by-email", externalId: "user-1" });
		let updates: unknown[] = [];

		let billing = stubBilling({
			find: async () => missing("no such customer"),
			findByEmail: async () => success(unlinked),
			update: async (ref, input) => {
				updates.push([ref, input]);
				return success(adopted);
			},
		});

		expect(await unwrap(Customer.provision(billing, idToken))).toEqual(adopted);
		expect(updates).toEqual([[{ id: "cus-by-email" }, { externalId: "user-1" }]]);
	});

	test("reports a subject the platform already holds against another customer", async () => {
		let billing = stubBilling({
			find: async () => missing("no such customer"),
			findByEmail: async () => success(customer({ id: "cus-by-email" })),
			update: async () =>
				failure(
					new BillingError("that external id is taken", { code: "conflict", connection: "stub" }),
				),
		});

		let provisioned = await Customer.provision(billing, idToken);

		expect(isFailure(provisioned)).toBe(true);
		if (isFailure(provisioned)) expect(provisioned.error.code).toBe("conflict");
	});

	test("leaves a customer already linked to somebody else alone", async () => {
		let theirs = customer({ id: "cus-by-email", externalId: "some-other-subject" });
		let billing = stubBilling({
			find: async () => missing("no such customer"),
			findByEmail: async () => success(theirs),
		});

		expect(await unwrap(Customer.provision(billing, idToken))).toEqual(theirs);
	});

	test("creates a customer when neither our id nor the address matches", async () => {
		let created = customer({ id: "cus-new", externalId: "user-1" });
		let inputs: unknown[] = [];

		let billing = stubBilling({
			find: async () => missing("no such customer"),
			findByEmail: async () => missing("no customer holds that address"),
			create: async (input) => {
				inputs.push(input);
				return success(created);
			},
		});

		expect(await unwrap(Customer.provision(billing, idToken))).toEqual(created);
		expect(inputs).toEqual([{ email: "user@example.com", externalId: "user-1", name: "User One" }]);
	});

	test("reports a platform failure that is not a missing record", async () => {
		let billing = stubBilling({
			find: async () =>
				failure(
					new BillingError("token rejected", { code: "unauthenticated", connection: "stub" }),
				),
		});

		let provisioned = await Customer.provision(billing, idToken);

		expect(isFailure(provisioned)).toBe(true);
		if (isFailure(provisioned)) expect(provisioned.error.code).toBe("unauthenticated");
	});
});

describe("Customer.checkout", () => {
	test("opens a session for the monitoring product and returns the owner to their team", async () => {
		let billing = createTestBilling();
		await unwrap(
			billing.customers.create({ email: "owner@example.com", externalId: TEAM.owner_id }),
		);

		let opened: CreateCheckoutInput[] = [];
		let recording = billing.with({
			checkouts: {
				create: async (input) => {
					opened.push(input);
					return await billing.checkouts.create(input);
				},
				find: (checkout) => billing.checkouts.find(checkout),
				finish: (checkout) => billing.checkouts.finish(checkout),
			},
		});

		let url = await unwrap(Customer.checkout(recording, TEAM, REQUEST_URL));

		expect(url).not.toBe("");
		expect(opened).toEqual([
			{
				product: MONITORING_PRODUCT,
				customer: { externalId: TEAM.owner_id },
				returnTo: DASHBOARD,
			},
		]);
	});

	test("reports the platform's refusal rather than throwing", async () => {
		let billing = createTestBilling();
		billing.fail("checkouts.create", "unknown");

		let opened = await Customer.checkout(billing, TEAM, REQUEST_URL);

		expect(isFailure(opened)).toBe(true);
		if (isFailure(opened)) expect(opened.error.code).toBe("unknown");
	});
});

describe("Customer.portal", () => {
	test("opens the hosted portal and returns the owner to their team", async () => {
		let billing = createTestBilling();
		await unwrap(
			billing.customers.create({ email: "owner@example.com", externalId: TEAM.owner_id }),
		);

		let hosted = billing.portal;
		if (hosted === undefined) throw new Error("the in-memory platform hosts a portal");

		let opened: CreatePortalInput[] = [];
		let recording = billing.with({
			portal: {
				create: async (input) => {
					opened.push(input);
					return await hosted.create(input);
				},
			},
		});

		let url = await unwrap(Customer.portal(recording, TEAM, REQUEST_URL));

		expect(url).not.toBe("");
		expect(opened).toEqual([{ customer: { externalId: TEAM.owner_id }, returnTo: DASHBOARD }]);
	});

	test("reports `unsupported` on a platform that hosts no portal", async () => {
		let billing = createTestBilling();
		let portalless = billing.with({ portal: undefined });

		let opened = await Customer.portal(portalless, TEAM, REQUEST_URL);

		expect(isFailure(opened)).toBe(true);
		if (isFailure(opened)) expect(opened.error.code).toBe("unsupported");
	});
});

describe("Customer.cancelSubscriptions", () => {
	test("succeeds with zero when the owner holds nothing", async () => {
		let billing = createTestBilling();
		await unwrap(
			billing.customers.create({ email: "owner@example.com", externalId: TEAM.owner_id }),
		);

		expect(await unwrap(Customer.cancelSubscriptions(billing, TEAM.owner_id))).toBe(0);
	});

	test("ends every monitoring subscription the owner still holds", async () => {
		let billing = createTestBilling();
		let owner = await unwrap(
			billing.customers.create({ email: "owner@example.com", externalId: TEAM.owner_id }),
		);

		for (let attempt of [1, 2]) {
			let opened = await unwrap(
				billing.checkouts.create({
					product: MONITORING_PRODUCT,
					customer: { id: owner.id },
					idempotencyKey: `checkout_${attempt}`,
				}),
			);
			await unwrap(billing.checkouts.finish(opened.id));
		}

		expect(await unwrap(Customer.cancelSubscriptions(billing, TEAM.owner_id))).toBe(2);

		let left = await unwrap(
			billing.subscriptions.list({
				customer: { externalId: TEAM.owner_id },
				status: ["active", "trialing"],
			}),
		);

		expect(left.items).toEqual([]);
	});

	test("reports the platform's refusal, so its caller decides what that costs", async () => {
		let billing = createTestBilling();
		billing.fail("subscriptions.list", "unknown");

		let cancelled = await Customer.cancelSubscriptions(billing, TEAM.owner_id);

		expect(isFailure(cancelled)).toBe(true);
		if (isFailure(cancelled)) expect(cancelled.error.code).toBe("unknown");
	});
});
