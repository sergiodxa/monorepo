/**
 * The feed catalog's schema, declared for `remix/data-table` over the D1 database bound
 * as `PLATFORM_DB`. Column names and types mirror `database/catalog-migrations/` exactly,
 * since that SQL is what actually creates the table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

export const catalogFeeds = table({
	name: "feeds",
	primaryKey: ["id"],
	timestamps: { createdAt: "created_at" },
	columns: {
		/**
		 * A `feed_…` TypeID, minted by the upsert that first inserts the row. It names the
		 * feed's Durable Object, it is the body of the freshness key, and it is what a
		 * reader's subscription stores, so one identifier reaches a feed from anywhere.
		 */
		id: c.text(),
		/**
		 * The canonical URL, `UNIQUE`. That index is the convergence guarantee: one row per
		 * feed, therefore one id per feed, therefore one object per feed.
		 */
		feed_url: c.text(),
		/**
		 * A denormalized copy, so an administrative list is readable without waking
		 * anything. It lags what the feed's object holds, and the object is right.
		 */
		title: c.text(),
		created_at: c.integer(),
		/** When the feed last published something, moved only by a poll that stored an item. */
		last_active_at: c.integer().nullable(),
		/** When the feed's last subscriber left, and it began serving out its grace period. */
		retired_at: c.integer().nullable(),
	},
});

/** One catalog row, as it reads back. */
export type SelectCatalogFeed = TableRow<typeof catalogFeeds>;

/**
 * The reader behind each customer record a billing connection issued. A row exists only
 * for a reader who has reached a checkout, which is what bounds the daily reconciliation
 * by how many readers have ever paid.
 */
export const billingCustomers = table({
	name: "billing_customers",
	primaryKey: ["subject", "connection"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		/** The reader's OIDC subject, which also names their Durable Object. */
		subject: c.text(),
		/** The credential set that issued the id beside it, rather than the vendor's name. */
		connection: c.text(),
		provider_customer_id: c.text(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/**
 * What the platform last said about one reader's subscription. It is a projection rather
 * than a source: the platform decides whether money arrived, and this records the answer
 * so no request has to ask.
 */
export const billingSubscriptions = table({
	name: "subscriptions",
	primaryKey: ["subject"],
	timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
	columns: {
		subject: c.text(),
		billing_connection: c.text(),
		billing_subscription_id: c.text().nullable(),
		status: c.text(),
		/** This app's own name for what was bought, which is what the tier is derived from. */
		product_slug: c.text().nullable(),
		current_period_end: c.integer().nullable(),
		/**
		 * Kept from the last snapshot that saw the subscription, since it is what tells a
		 * lapse apart from a cancellation the reader asked for once the subscription is gone.
		 */
		cancel_at_period_end: c.boolean().default(false),
		/** When the platform answered, which is what makes a late snapshot refusable. */
		checked_at: c.integer(),
		provider_data: c.text().nullable(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One row per delivery the billing endpoint has received, keyed on the platform's id. */
export const billingDeliveries = table({
	name: "billing_webhook_deliveries",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		type: c.text(),
		/** The body exactly as received, so the bytes a signature covered stay readable. */
		payload: c.text(),
		valid: c.boolean().default(false),
		processed: c.boolean().default(false),
		received_at: c.integer(),
	},
});

/** One customer link, as it reads back. */
export type SelectBillingCustomer = TableRow<typeof billingCustomers>;

/** One projected subscription, as it reads back. */
export type SelectBillingSubscription = TableRow<typeof billingSubscriptions>;
