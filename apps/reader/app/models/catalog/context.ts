/**
 * The model context every model over the shared catalog reads, with `models` typed as the
 * registry's own entries. Models import `createModel` from here, so a callback or method
 * reaches a sibling table through `this.context.models` bound to the same connection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundModels, ModelContext } from "@sdxc/data-model";

import { withContext } from "@sdxc/data-model";

import type { BillingCustomers } from "~/app/models/catalog/billing-customers";
import type { BillingDeliveries } from "~/app/models/catalog/billing-deliveries";
import type { BillingSubscriptions } from "~/app/models/catalog/billing-subscriptions";
import type { CatalogFeeds } from "~/app/models/catalog/feeds";

/** The entries of the catalog's registry, each resolved only when a model reads it. */
export interface CatalogModelEntries {
	feeds: typeof CatalogFeeds;
	billingCustomers: typeof BillingCustomers;
	billingSubscriptions: typeof BillingSubscriptions;
	billingDeliveries: typeof BillingDeliveries;
}

/** What the catalog's models read as `this.context`: the binding's database and their siblings. */
export interface CatalogModelContext extends ModelContext {
	models: BoundModels<CatalogModelEntries>;
}

/** Defines a model whose callbacks and methods see the catalog's siblings as `models`. */
export const { createModel } = withContext<CatalogModelContext>();
