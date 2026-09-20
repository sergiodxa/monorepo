/**
 * Opening a hosted checkout for a tenant and settling its return (ADR-018): the
 * intent is durable — a `billing_checkouts` row — before anything leaves the
 * process, so a retried open reuses the same `attempt_id` and a completed
 * checkout resolves back to a tenant through that row rather than through
 * metadata a delivery may not carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { Database } from "remix/data-table";

import { BillingError } from "@sdxc/billing";
import { isFailure } from "@sdxc/result";

import type { BillingCheckoutKind } from "~/app/models/billing-checkout";
import type { TenantRow } from "~/app/models/tenant";

import BillingCheckout from "~/app/models/billing-checkout";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { ensureProviderCustomer } from "~/app/services/billing-customer";
import { attachCheckoutSubscription, reprojectTenant } from "~/app/services/billing-sync";

/** What opening a checkout needs from the request. */
export interface OpenCheckoutInput {
	tenantId: string;
	email: string;
	name?: string;
	product: string;
	kind: BillingCheckoutKind;
	returnTo: string;
}

export type OpenCheckoutResult =
	| { ok: true; url: string }
	| { ok: false; reason: "tenant_not_found" }
	| { ok: false; reason: "billing_error"; error: BillingError };

/**
 * Opens a hosted checkout for a tenant: resolves its owning customer's provider
 * customer id, writes a `billing_checkouts` row before calling `checkouts.create`,
 * and records the provider's own checkout id onto that row once it answers.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @param input - The tenant, buyer contact, and what is being bought.
 * @returns The hosted checkout URL to redirect the buyer to, or why one could
 * not be opened.
 */
export async function openCheckout(
	db: Database,
	billing: Billing,
	input: OpenCheckoutInput,
): Promise<OpenCheckoutResult> {
	let tenant = await Tenant.findById(db, input.tenantId);
	if (!tenant) return { ok: false, reason: "tenant_not_found" };

	let customer = await Customer.findById(db, tenant.customer_id);
	if (!customer) return { ok: false, reason: "tenant_not_found" };

	let joined = await ensureProviderCustomer(db, billing, customer, {
		email: input.email,
		name: input.name,
	});
	if (isFailure(joined)) return { ok: false, reason: "billing_error", error: joined.error };

	let attempt = await BillingCheckout.open(db, {
		tenantId: tenant.id,
		customerId: customer.id,
		productSlug: input.product,
		kind: input.kind,
	});

	let checkout = await billing.checkouts.create({
		product: input.product,
		customer: { id: joined.data.providerCustomerId },
		returnTo: input.returnTo,
		allowDiscountCodes: false,
		idempotencyKey: attempt.attempt_id,
		metadata: { tenant: tenant.id, attempt: attempt.attempt_id },
	});

	if (isFailure(checkout)) return { ok: false, reason: "billing_error", error: checkout.error };

	if (checkout.data.url === null) {
		return {
			ok: false,
			reason: "billing_error",
			error: new BillingError("checkout session has no page to redirect to", {
				code: "invalid_response",
				connection: billing.connection,
			}),
		};
	}

	await BillingCheckout.attachCheckoutId(db, attempt.attempt_id, checkout.data.id);

	return { ok: true, url: checkout.data.url };
}

export type FinishCheckoutResult =
	| { ok: true; tenant: TenantRow | null }
	| { ok: false; error: BillingError };

/**
 * Settles a checkout a buyer has just returned from: reads its final state
 * with `checkouts.finish`, attaches the subscription it produced to the tenant
 * the `billing_checkouts` row names, and reprojects that tenant's entitlements.
 * Safe to run twice for the same checkout — attaching and reprojecting both are.
 *
 * @param db - Database connection.
 * @param billing - The configured billing platform.
 * @param checkoutId - The checkout session id the return URL carried.
 * @returns The tenant the checkout was opened for (null when this checkout was
 * not opened through {@link openCheckout}), or the failure `finish` reported.
 */
export async function finishCheckout(
	db: Database,
	billing: Billing,
	checkoutId: string,
): Promise<FinishCheckoutResult> {
	let finished = await billing.checkouts.finish(checkoutId);
	if (isFailure(finished)) return { ok: false, error: finished.error };

	let checkout = await BillingCheckout.findByCheckoutId(db, checkoutId);
	if (!checkout) return { ok: true, tenant: null };

	if (finished.data.subscriptionId !== null) {
		await attachCheckoutSubscription(db, checkout, finished.data.subscriptionId);
	}

	await reprojectTenant(db, billing, checkout.tenant_id);

	return { ok: true, tenant: await Tenant.findById(db, checkout.tenant_id) };
}
