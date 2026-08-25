/**
 * Unit tests for the `Customer` billing service: creating a Polar customer and
 * linking it to the subject id, and the sign-up resolution that reuses a customer
 * already registered under the address without ever overwriting an existing link.
 * Uses a fake shaped like the subset of `PolarClient` these methods call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Customer as PolarCustomer, PolarClient } from "@pkg/polar";

import { describe, expect, test } from "vitest";

import type { BillableSubject } from "~/app/services/customer";

import Customer from "~/app/services/customer";

/** The subset of `PolarClient` this service actually calls. */
type FakePolarClient = Pick<
	PolarClient,
	"createCustomer" | "findCustomerByEmail" | "updateCustomer"
>;

/** Builds a fake `PolarClient` that throws for any method not explicitly overridden. */
function fakePolar(overrides: Partial<FakePolarClient>): PolarClient {
	let notImplemented = (name: string) => () => {
		throw new Error(`unexpected call to PolarClient#${name} in this test`);
	};

	let fake: FakePolarClient = {
		createCustomer: notImplemented("createCustomer"),
		findCustomerByEmail: notImplemented("findCustomerByEmail"),
		updateCustomer: notImplemented("updateCustomer"),
		...overrides,
	};

	return fake as unknown as PolarClient;
}

/** A Polar customer with only the fields this service reads. */
function polarCustomer(overrides: Partial<PolarCustomer> = {}): PolarCustomer {
	return {
		id: "cus_1",
		email: "jane@example.com",
		externalId: null,
		...overrides,
	} as unknown as PolarCustomer;
}

let subject: BillableSubject = {
	id: "subject-1",
	email_address: "jane@example.com",
	display_name: "Jane Doe",
};

describe("Customer.create", () => {
	test("creates the customer and links it to the subject id", async () => {
		let created: unknown[] = [];
		let linked: unknown[] = [];

		let polar = fakePolar({
			async createCustomer(email, name) {
				created.push([email, name]);
				return polarCustomer();
			},
			async updateCustomer(customerId, updates) {
				linked.push([customerId, updates.externalId]);
				return polarCustomer({ externalId: "subject-1" });
			},
		});

		let customer = await Customer.create(polar, subject);

		expect(created).toEqual([["jane@example.com", "Jane Doe"]]);
		expect(linked).toEqual([["cus_1", "subject-1"]]);
		expect(customer.externalId).toBe("subject-1");
	});
});

describe("Customer.findOrCreateByEmail", () => {
	test("creates a customer when the address is unknown to Polar", async () => {
		let createdFor: string[] = [];

		let polar = fakePolar({
			async findCustomerByEmail() {
				return null;
			},
			async createCustomer(email) {
				createdFor.push(email);
				return polarCustomer();
			},
			async updateCustomer() {
				return polarCustomer({ externalId: "subject-1" });
			},
		});

		let customer = await Customer.findOrCreateByEmail(polar, "jane@example.com", subject);

		expect(createdFor).toEqual(["jane@example.com"]);
		expect(customer.externalId).toBe("subject-1");
	});

	test("links an existing customer that has no external id yet", async () => {
		let linked: unknown[] = [];

		let polar = fakePolar({
			async findCustomerByEmail() {
				return polarCustomer({ id: "cus_existing", externalId: null });
			},
			async updateCustomer(customerId, updates) {
				linked.push([customerId, updates.externalId]);
				return polarCustomer({ id: "cus_existing", externalId: "subject-1" });
			},
		});

		let customer = await Customer.findOrCreateByEmail(polar, "jane@example.com", subject);

		expect(linked).toEqual([["cus_existing", "subject-1"]]);
		expect(customer.id).toBe("cus_existing");
	});

	test("never overwrites an external id Polar already holds", async () => {
		let polar = fakePolar({
			async findCustomerByEmail() {
				return polarCustomer({ id: "cus_existing", externalId: "someone-else" });
			},
		});

		let customer = await Customer.findOrCreateByEmail(polar, "jane@example.com", subject);

		expect(customer.externalId).toBe("someone-else");
	});
});
