/**
 * Mirrors subjects into Polar customers so billing elsewhere can resolve a
 * person by the id this server issues. Creates a customer, finds one by email,
 * and links the external id, preserving whichever link Polar already holds
 * since Polar treats an external id as authoritative once set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Customer as PolarCustomer, PolarClient } from "@pkg/polar";

import type { SelectSubject } from "~/database/schema";

/** The subject fields a Polar customer is built from. */
export type BillableSubject = Pick<SelectSubject, "id" | "email_address" | "display_name">;

export default class Customer {
	/**
	 * Creates the customer, then links it to the subject id in a second call,
	 * since only `updateCustomer` accepts the external id. A failure between the
	 * two is repaired by `findOrCreateByEmail` on the next sign-in.
	 */
	static async create(polar: PolarClient, subject: BillableSubject): Promise<PolarCustomer> {
		let customer = await polar.createCustomer(subject.email_address, subject.display_name);
		return await polar.updateCustomer(customer.id, { externalId: subject.id });
	}

	/** Finds the Polar customer with an exact email match, or `null` when there is none. */
	static async findByEmail(polar: PolarClient, email: string): Promise<PolarCustomer | null> {
		return await polar.findCustomerByEmail(email);
	}

	/** Links an existing Polar customer to the subject id this server issues. */
	static async assignExternalId(
		polar: PolarClient,
		customerId: string,
		externalId: string,
	): Promise<PolarCustomer> {
		return await polar.updateCustomer(customerId, { externalId });
	}

	/**
	 * Resolves the Polar customer for a subject at sign-up: reuses the customer already
	 * registered under that email, linking it when it has no external id, and otherwise
	 * creates one. A customer that is already linked is returned untouched.
	 */
	static async findOrCreateByEmail(
		polar: PolarClient,
		email: string,
		subject: BillableSubject,
	): Promise<PolarCustomer> {
		let customer = await Customer.findByEmail(polar, email);
		if (!customer) return await Customer.create(polar, subject);
		if (customer.externalId) return customer;
		return await Customer.assignExternalId(polar, customer.id, subject.id);
	}
}
