/**
 * The join between a control-plane customer and the provider's own customer
 * record (ADR-018): one control-plane customer is one provider customer, matched
 * on `externalId`, created at the first checkout that needs one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, Customer as ProviderCustomer } from "@sdxc/billing";
import type { BillingError } from "@sdxc/billing";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { isFailure, isSuccess, success } from "@sdxc/result";

import type { CustomerRow } from "~/app/models/customer";

import Customer from "~/app/models/customer";

/** What identifies the buyer when no provider customer exists for them yet. */
export interface CustomerContactInfo {
	email: string;
	name?: string;
}

/**
 * Adopts a provider customer that already holds this email but carries no
 * `externalId` yet — the record a support agent or an import created directly on
 * the platform, before this control-plane customer ever checked out.
 *
 * @param billing - The configured billing platform.
 * @param externalId - The control-plane customer id to join the provider record to.
 * @param email - The address the provider customer is found by.
 * @returns The adopted provider customer, or the failure either call reported.
 */
async function adoptProviderCustomerByEmail(
	billing: Billing,
	externalId: string,
	email: string,
): Promise<Result<ProviderCustomer, BillingError>> {
	let found = await billing.customers.findByEmail(email);
	if (isFailure(found)) return found;

	return billing.customers.update({ id: found.data.id }, { externalId });
}

/**
 * Ensures a control-plane customer is joined to a provider customer, creating
 * one at the platform when none exists yet. A `conflict` from `create` is the
 * create racing itself, resolved by re-reading with `customers.find({ externalId
 * })`; when that still finds nothing, the conflict was an email the provider
 * already held under a different record, adopted instead by
 * `customers.findByEmail` and `customers.update({ externalId })`.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @param customer - The control-plane customer to join.
 * @param contact - The email (and optional name) to create a provider customer
 * with, when this customer has none yet.
 * @returns The provider's own customer id, or the failure the join could not
 * recover from.
 * @example
 * let joined = await ensureProviderCustomer(db, polar, customer, { email: "jane@example.com" });
 */
export async function ensureProviderCustomer(
	db: Database,
	billing: Billing,
	customer: CustomerRow,
	contact: CustomerContactInfo,
): Promise<Result<{ providerCustomerId: string }, BillingError>> {
	if (customer.provider_customer_id !== null) {
		return success({ providerCustomerId: customer.provider_customer_id });
	}

	let created = await billing.customers.create({
		email: contact.email,
		externalId: customer.id,
		name: contact.name ?? customer.name,
	});

	let providerCustomer: ProviderCustomer;

	if (isSuccess(created)) {
		providerCustomer = created.data;
	} else if (created.error.code === "conflict") {
		let found = await billing.customers.find({ externalId: customer.id });

		if (isSuccess(found)) {
			providerCustomer = found.data;
		} else {
			let adopted = await adoptProviderCustomerByEmail(billing, customer.id, contact.email);
			if (isFailure(adopted)) return adopted;
			providerCustomer = adopted.data;
		}
	} else {
		return created;
	}

	await Customer.joinProviderCustomer(db, customer.id, {
		connection: billing.connection,
		providerCustomerId: providerCustomer.id,
	});

	return success({ providerCustomerId: providerCustomer.id });
}
