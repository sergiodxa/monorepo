/**
 * What the payment platform last said about each reader's subscription. The platform is
 * the source; this projection records its answer so no request has to ask, and a late
 * snapshot is refused by the time it was read at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";

import type { SelectBillingSubscription } from "~/database/catalog-schema";

import { billingSubscriptions } from "~/database/catalog-schema";

/** One projected subscription per reader, keyed by their OIDC subject. */
export const BillingSubscriptions = createModel(billingSubscriptions, {
	methods: {
		/** The last snapshot written for the reader, or `null` before the first one. */
		forSubject(subject: string): Promise<SelectBillingSubscription | null> {
			return this.findBy({ subject });
		},
	},
});

export default BillingSubscriptions;
