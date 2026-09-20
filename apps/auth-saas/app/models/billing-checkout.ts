/**
 * Data model for billing checkout attempts: written before a checkout session ever
 * leaves the process, so `attempt_id` is a durable idempotency key a retried open
 * reuses, and the row — not a delivery's metadata — is what resolves a completed
 * checkout back to the tenant it was opened for. Wraps the `billing_checkouts` D1
 * table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Whether an opened checkout buys the tenant's base plan or an add-on product. */
export type BillingCheckoutKind = "base" | "addon";

/** Mints an `attempt_` TypeID, doubling as the checkout's idempotency key. */
const attemptId = typeid("attempt");

/** One billing checkout attempt row as the control plane stores it. */
export type BillingCheckoutRow = TableRow<typeof BillingCheckout.table>;

/**
 * Active-record–style model for billing checkout attempts, exposing static query
 * and mutation helpers over the `billing_checkouts` table.
 *
 * @example
 * let attempt = await BillingCheckout.open(db, { tenantId, customerId, productSlug: "pro" });
 */
export default class BillingCheckout {
	/** The `billing_checkouts` D1 table definition (primary key `attempt_id`, no `updated_at`
	 * since a row is never touched again beyond recording the provider's checkout id). */
	static table = table({
		name: "billing_checkouts",
		primaryKey: ["attempt_id"],
		columns: {
			attempt_id: c.text(),
			tenant_id: c.text(),
			customer_id: c.text(),
			product_slug: c.text(),
			kind: c.enum(["base", "addon"] as const),
			checkout_id: c.text().nullable(),
			created_at: c.integer(),
		},
	});

	/**
	 * Finds a checkout attempt by the provider's own checkout id, which is what a
	 * `checkout.completed` delivery names.
	 *
	 * @param db - Database connection.
	 * @param checkoutId - The provider's checkout session id.
	 * @returns A promise resolving to the attempt row, or null when no attempt
	 * recorded this checkout.
	 */
	static findByCheckoutId(db: Database, checkoutId: string): Promise<BillingCheckoutRow | null> {
		return db.findOne(BillingCheckout.table, { where: { checkout_id: checkoutId } });
	}

	/**
	 * Opens a checkout attempt: mints its `attempt_id` and writes the row before
	 * anything leaves the process, so a failed or retried `checkouts.create` call
	 * still has somewhere durable to resume from.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant and customer the attempt is for, what it buys, and
	 * whether that is the tenant's base plan or an add-on.
	 * @returns A promise resolving to the newly-created attempt row.
	 */
	static open(
		db: Database,
		data: { tenantId: string; customerId: string; productSlug: string; kind: BillingCheckoutKind },
	): Promise<BillingCheckoutRow> {
		return db.create(
			BillingCheckout.table,
			{
				attempt_id: attemptId(generateUUIDv7()).toString(),
				tenant_id: data.tenantId,
				customer_id: data.customerId,
				product_slug: data.productSlug,
				kind: data.kind,
				checkout_id: null,
				created_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Records the provider's own checkout id once `checkouts.create` has answered
	 * one for this attempt.
	 *
	 * @param db - Database connection.
	 * @param attemptId - The attempt to record the checkout id onto.
	 * @param checkoutId - The provider's checkout session id.
	 * @returns A promise resolving to the updated attempt row.
	 * @throws When no attempt exists for the given id.
	 */
	static attachCheckoutId(
		db: Database,
		attemptId: string,
		checkoutId: string,
	): Promise<BillingCheckoutRow> {
		return db.update(BillingCheckout.table, { attempt_id: attemptId }, { checkout_id: checkoutId });
	}
}
