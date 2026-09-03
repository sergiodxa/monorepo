/**
 * Mirrors subjects into billing customers so billing elsewhere can resolve a
 * person by the id this server issues. Creates a customer already carrying the
 * subject id as its external id, and reuses whichever customer the platform
 * already holds for the address, which it treats as authoritative once linked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, BillingError, Customer as BillingCustomer } from "@pkg/billing";
import type { Result } from "@pkg/result";

import { isFailure } from "@pkg/result";

import type { SelectSubject } from "~/database/schema";

/** The subject fields a billing customer is built from. */
export type BillableSubject = Pick<SelectSubject, "id" | "email_address" | "display_name">;

export default class Customer {
	/**
	 * Creates the customer for a subject, linked to the id this server issues in the
	 * same call, since the external id is part of the creation input.
	 */
	static async create(
		billing: Billing,
		subject: BillableSubject,
	): Promise<Result<BillingCustomer, BillingError>> {
		return await billing.customers.create({
			email: subject.email_address,
			externalId: subject.id,
			name: subject.display_name,
		});
	}

	/**
	 * Resolves the billing customer for a subject at sign-up: reuses the customer already
	 * registered under the subject's address, and otherwise creates one. A customer that
	 * exists is returned as the platform holds it, external id and all, since an external
	 * id is immutable once set and reassigning one would move somebody else's billing.
	 */
	static async findOrCreateByEmail(
		billing: Billing,
		subject: BillableSubject,
	): Promise<Result<BillingCustomer, BillingError>> {
		let found = await billing.customers.findByEmail(subject.email_address);
		if (!isFailure(found)) return found;
		if (found.error.code !== "not_found") return found;

		return await Customer.create(billing, subject);
	}
}
