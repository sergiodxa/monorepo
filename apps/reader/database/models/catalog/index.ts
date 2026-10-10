/**
 * The models over the shared D1 catalog, bound once per isolate beside the catalog's
 * connection. Entries are eager because the module holding the binding reaches for all
 * of them across the follow path, a feed's life and billing deliveries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

import { BillingCustomers } from "./billing-customers";
import { BillingDeliveries } from "./billing-deliveries";
import { BillingSubscriptions } from "./billing-subscriptions";
import { CatalogFeeds } from "./feeds";

/** Every model over the catalog database. */
export const catalogModels = createModels({
	feeds: CatalogFeeds,
	billingCustomers: BillingCustomers,
	billingSubscriptions: BillingSubscriptions,
	billingDeliveries: BillingDeliveries,
});

/** The registry bound to the catalog's connection. */
export type CatalogModels = BoundRegistry<typeof catalogModels>;
