/**
 * Billing checkout attempts, written before a checkout session ever leaves the process, so
 * `attempt_id` is a durable idempotency key a retried open reuses, and the row, rather than a
 * delivery's metadata, resolves a completed checkout back to the tenant it was opened for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { billingCheckouts } from "~/database/schema";

/** Whether an opened checkout buys the tenant's base plan or an add-on product. */
export type BillingCheckoutKind = "base" | "addon";

/** Mints an `attempt_` TypeID, doubling as the checkout's idempotency key. */
const attemptId = typeid("attempt");

/**
 * Checkout attempts; `create` mints the attempt id, and `update(attemptId, { checkout_id })`
 * records the provider's checkout once it answers one.
 *
 * @example let attempt = await models.billingCheckouts.create({ tenant_id, customer_id, product_slug: "pro", kind: "base" });
 */
export const BillingCheckouts = createModel(billingCheckouts, {
	optional: ["attempt_id"],

	methods: {
		/** The attempt a `checkout.completed` delivery's provider checkout id names. */
		findByCheckoutId(checkoutId: string) {
			return this.findBy({ checkout_id: checkoutId });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				attempt_id: values.attempt_id ?? attemptId(generateUUID()).toString(),
				created_at: values.created_at ?? Date.now(),
			};
		},
	},
});

/** One billing checkout attempt row as the control plane stores it. */
export type BillingCheckoutRow = ModelRow<typeof BillingCheckouts>;

export default BillingCheckouts;
