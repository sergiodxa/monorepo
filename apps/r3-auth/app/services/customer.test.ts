/**
 * Unit tests for the `Customer` billing service: creating a customer already linked
 * to the subject id, the sign-up resolution that reuses a customer registered under
 * the address without ever moving its link, and the failure a resolution reports
 * instead of provisioning a second customer. Drives a real in-memory platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { BillableSubject } from "~/app/services/customer";

import Customer from "~/app/services/customer";

let subject: BillableSubject = {
	id: "subject-1",
	email_address: "jane@example.com",
	display_name: "Jane Doe",
};

describe("Customer.create", () => {
	test("creates the customer linked to the subject id", async () => {
		let billing = new MemoryBilling();

		let customer = await unwrap(Customer.create(billing, subject));

		expect(customer.email).toBe("jane@example.com");
		expect(customer.name).toBe("Jane Doe");
		expect(customer.externalId).toBe("subject-1");
	});
});

describe("Customer.findOrCreateByEmail", () => {
	test("creates a customer when the address is unknown to the platform", async () => {
		let billing = new MemoryBilling();

		let customer = await unwrap(Customer.findOrCreateByEmail(billing, subject));

		expect(customer.externalId).toBe("subject-1");
		expect(await unwrap(billing.customers.findByEmail("jane@example.com"))).toEqual(customer);
	});

	test("reuses the customer already registered under the address", async () => {
		let billing = new MemoryBilling();
		let existing = await unwrap(
			billing.customers.create({ email: "jane@example.com", externalId: "someone-else" }),
		);

		let customer = await unwrap(Customer.findOrCreateByEmail(billing, subject));

		expect(customer.id).toBe(existing.id);
		expect(customer.externalId).toBe("someone-else");
	});

	test("reports a read that failed for any reason other than a miss", async () => {
		let billing = new MemoryBilling();

		billing.fail("customers", "rate_limited");

		let result = await Customer.findOrCreateByEmail(billing, subject);

		expect(isFailure(result)).toBe(true);
		expect(isFailure(result) && result.error.code).toBe("rate_limited");

		billing.heal("customers");

		expect(await billing.customers.findByEmail("jane@example.com")).toMatchObject({
			error: { code: "not_found" },
		});
	});
});
