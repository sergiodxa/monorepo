/**
 * Opening the hosted billing portal for a tenant's owning customer (ADR-018):
 * one customer holds one portal session however many tenants they own, since
 * the payment method and invoices live on the customer rather than any one
 * tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, BillingError } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { supports } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";

export type OpenPortalResult =
	| { ok: true; url: string }
	| { ok: false; reason: "unsupported" }
	| { ok: false; reason: "tenant_not_found" }
	| { ok: false; reason: "no_provider_customer" }
	| { ok: false; reason: "billing_error"; error: BillingError };

/**
 * Opens a portal session for the customer that owns a tenant.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @param input - The tenant whose owning customer's portal to open, and where
 * to return them.
 * @returns The hosted portal URL to redirect to, or why one could not be opened.
 */
export async function openPortal(
	db: Database,
	billing: Billing,
	input: { tenantId: string; returnTo?: string },
): Promise<OpenPortalResult> {
	if (!supports(billing, "portal")) return { ok: false, reason: "unsupported" };

	let tenant = await Tenant.findById(db, input.tenantId);
	if (!tenant) return { ok: false, reason: "tenant_not_found" };

	let customer = await Customer.findById(db, tenant.customer_id);
	if (!customer || customer.provider_customer_id === null) {
		return { ok: false, reason: "no_provider_customer" };
	}

	let session = await billing.portal.create({
		customer: { id: customer.provider_customer_id },
		returnTo: input.returnTo,
	});
	if (isFailure(session)) return { ok: false, reason: "billing_error", error: session.error };

	return { ok: true, url: session.data.url };
}
