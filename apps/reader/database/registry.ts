/**
 * The shared database, and the only module that holds its binding: the feed catalog, which
 * names a feed by the id it assigns the first time anybody follows it, and the billing
 * projection, which records what the payment platform last said about a reader.
 *
 * Every function here belongs to the follow path, to the end of a feed's life, or to a
 * delivery from the platform. Nothing that renders a page reaches this database: a
 * subscription stores the feed's id and a reader's object stores their tier, so both are
 * reachable without a lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebhookDelivery, WebhookStore } from "@sdxc/billing";

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { env } from "cloudflare:workers";
import { and, Database, gt, sql } from "remix/data-table";

import type { SelectBillingCustomer, SelectBillingSubscription } from "~/database/catalog-schema";

import {
	billingCustomers,
	billingDeliveries,
	billingSubscriptions,
	catalogFeeds,
} from "~/database/catalog-schema";

/** The isolate's connection, opened by whichever follow or poll reaches it first. */
let database: Database | undefined;

/**
 * Opens the catalog's connection, once per isolate.
 *
 * `now` is overridden to epoch-ms because the timestamp columns hold milliseconds since
 * the epoch: D1 binds an integer, which sorts and compares correctly against every row
 * already stored.
 */
function connect(): Database {
	return (database ??= new Database(createD1DatabaseAdapter(env.PLATFORM_DB), {
		now: () => Date.now(),
	}));
}

/**
 * Exchanges a canonical feed URL for the id that names its Durable Object, minting one
 * for a URL nobody has followed yet and returning the existing id for one somebody has.
 *
 * Call this with the URL the follow path has already normalized and resolved through
 * discovery, since the URL is what decides whether two people are following one feed.
 * Concurrent first follows of one URL converge: both pass through `UNIQUE (feed_url)`,
 * and the loser of the race is handed the winner's id.
 *
 * @param feedUrl - The canonical URL, as discovery finally reported it
 * @param title - The feed's title, denormalized so a list reads without waking the object
 * @returns The feed's id, which `env.FEED.getByName` addresses its object by
 * @example
 * let feedId = await registerFeed(discovered.url, discovered.title);
 * await env.FEED.getByName(feedId).subscribe(subject);
 */
export async function registerFeed(feedUrl: string, title: string): Promise<string> {
	let minted = TypeID.fromUUID("feed", generateUUID()).toString();

	// Written as DO UPDATE rather than DO NOTHING, and the difference is the whole
	// statement: SQLite returns no row for a conflicting insert that does nothing, so
	// every follower after the first would get back nothing at all. Writing the URL onto
	// itself is what makes the statement always answer with an id.
	let { rows = [] } = await connect().exec(sql`
		insert into feeds (id, feed_url, title, created_at)
		values (${minted}, ${feedUrl}, ${title}, ${Date.now()})
		on conflict (feed_url) do update set feed_url = excluded.feed_url
		returning id
	`);

	let id = rows[0]?.["id"];
	if (typeof id !== "string") throw new Error(`the catalog returned no id for ${feedUrl}`);

	return id;
}

/**
 * Records that a feed published something, which is the only thing that moves the stamp:
 * call it where a poll stores an item, so a `304` and an idle feed both leave it alone
 * and the column means what a list of feeds would suggest it means.
 *
 * Best-effort, because the items are already stored by the time it runs: a failed write
 * costs a wrong timestamp in an administrative list and nothing else.
 *
 * @param feedId - The feed whose stamp moves
 * @returns Whether the stamp landed, so a caller that logs its poll can say it did not
 */
export async function stampActivity(feedId: string): Promise<boolean> {
	try {
		let { affectedRows } = await connect().updateMany(
			catalogFeeds,
			{ last_active_at: Date.now() },
			{ where: { id: feedId } },
		);

		return affectedRows > 0;
	} catch {
		return false;
	}
}

/**
 * Writes what a feed calls itself, once its own object has read the document and knows.
 *
 * The id is minted from a URL, before anything has been fetched, so the row starts out
 * named after the address it was created from. The name a list of feeds should show is
 * the one the publisher gave, and the object holding the feed is the only thing that has
 * read it.
 *
 * Best-effort, for the reason the activity stamp is: this runs after the feed is stored,
 * and a title that lags costs a readable line in an administrative list and nothing else.
 *
 * @param feedId - The feed being named
 * @param title - The title the feed document carries
 * @returns Whether the name landed
 */
export async function renameFeed(feedId: string, title: string): Promise<boolean> {
	try {
		let { affectedRows } = await connect().updateMany(
			catalogFeeds,
			{ title },
			{ where: { id: feedId } },
		);

		return affectedRows > 0;
	} catch {
		return false;
	}
}

/**
 * Marks a feed as having lost its last subscriber, which starts its grace period.
 *
 * The row stays. A feed serving out its week is visible as exactly that, and a reader who
 * follows it again inside the week is handed the same id and the same object, with its
 * items still in place.
 *
 * Best-effort, because the subscriber has already gone by the time it runs: it is called
 * from inside an alarm that must never reject and from an unfollow the reader has already
 * been told succeeded, and a row left unmarked costs an administrative list its accuracy.
 *
 * @param feedId - The feed whose last subscriber just left
 */
export async function retireFeed(feedId: string): Promise<void> {
	try {
		await connect().updateMany(catalogFeeds, { retired_at: Date.now() }, { where: { id: feedId } });
	} catch {
		return;
	}
}

/**
 * Returns a retired feed to service, for a subscriber arriving inside its grace period.
 *
 * Safe on a feed that was never retired: it clears a column that is already clear. Also
 * best-effort, for the reason retiring is — the subscription it accompanies is already
 * written, and a feed listed as retired while somebody reads it is a wrong line in a list
 * rather than anything a reader meets.
 *
 * @param feedId - The feed somebody has just followed again
 */
export async function reviveFeed(feedId: string): Promise<void> {
	try {
		await connect().updateMany(catalogFeeds, { retired_at: null }, { where: { id: feedId } });
	} catch {
		return;
	}
}

/**
 * Drops a feed from the catalog, which the purge does alongside clearing the object's
 * storage and its head key.
 *
 * Call it only from that purge. A row deleted while the object still holds items would
 * hand the next follower a new id, a new object, and no way ever to reach the old one.
 *
 * @param feedId - The feed being purged
 * @returns Whether a row was there to delete
 */
export async function deleteFeed(feedId: string): Promise<boolean> {
	return await connect().delete(catalogFeeds, { id: feedId });
}

/**
 * Reads the customer identity a reader is billed through, or `null` while they are a
 * customer of nothing — which is every reader who has never opened a checkout.
 *
 * @param subject - The reader's OIDC subject
 * @param connection - The credential set that issued the id
 */
export async function findBillingCustomer(
	subject: string,
	connection: string,
): Promise<SelectBillingCustomer | null> {
	return await connect().findOne(billingCustomers, { where: { subject, connection } });
}

/**
 * Reads the reader behind a customer id the platform reported, which is the fallback for a
 * customer record created without this app's own subject on it.
 *
 * @param connection - The credential set that issued the id
 * @param providerCustomerId - The customer id as the platform reports it
 */
export async function findBillingCustomerByProviderId(
	connection: string,
	providerCustomerId: string,
): Promise<SelectBillingCustomer | null> {
	return await connect().findOne(billingCustomers, {
		where: { connection, provider_customer_id: providerCustomerId },
	});
}

/**
 * Records that a reader is a customer of one connection, which is what puts them in the
 * daily sweep's bounded walk.
 *
 * Written as one upsert rather than a read and a write: D1 runs no interactive
 * transaction, so a checkout completing twice has to converge on one row by itself.
 *
 * @param subject - The reader's OIDC subject
 * @param connection - The credential set that issued the id
 * @param providerCustomerId - The customer id as the platform reports it
 */
export async function linkBillingCustomer(
	subject: string,
	connection: string,
	providerCustomerId: string,
): Promise<void> {
	let now = Date.now();

	await connect().exec(sql`
		insert into billing_customers
			(subject, connection, provider_customer_id, created_at, updated_at)
		values (${subject}, ${connection}, ${providerCustomerId}, ${now}, ${now})
		on conflict (subject, connection) do update set
			provider_customer_id = excluded.provider_customer_id,
			updated_at = excluded.updated_at
	`);
}

/**
 * The last snapshot written for a reader, or `null` before the first one.
 *
 * @param subject - The reader's OIDC subject
 */
export async function readSubscription(subject: string): Promise<SelectBillingSubscription | null> {
	return await connect().findOne(billingSubscriptions, { where: { subject } });
}

/** What one snapshot writes into the projection, as the platform reported it. */
export interface SubscriptionSnapshot {
	subject: string;
	connection: string;
	subscriptionId: string | null;
	status: string;
	productSlug: string | null;
	currentPeriodEnd: number | null;
	cancelAtPeriodEnd: boolean;
	/** Epoch milliseconds the platform answered at. */
	checkedAt: number;
	providerData: string | null;
}

/**
 * Writes what the platform last said about a reader's subscription.
 *
 * A snapshot carrying an older read than the stored row leaves it alone, so two reads
 * taken seconds apart converge on the later one whichever write arrives second.
 *
 * @param snapshot - The platform's answer, as one row of the projection
 * @returns Whether this snapshot is the one now stored
 */
export async function writeSubscription(snapshot: SubscriptionSnapshot): Promise<boolean> {
	let now = Date.now();

	let { rows = [] } = await connect().exec(sql`
		insert into subscriptions (
			subject, billing_connection, billing_subscription_id, status, product_slug,
			current_period_end, cancel_at_period_end, checked_at, provider_data,
			created_at, updated_at
		)
		values (
			${snapshot.subject}, ${snapshot.connection}, ${snapshot.subscriptionId},
			${snapshot.status}, ${snapshot.productSlug}, ${snapshot.currentPeriodEnd},
			${snapshot.cancelAtPeriodEnd ? 1 : 0}, ${snapshot.checkedAt}, ${snapshot.providerData},
			${now}, ${now}
		)
		on conflict (subject) do update set
			billing_connection = excluded.billing_connection,
			billing_subscription_id = excluded.billing_subscription_id,
			status = excluded.status,
			product_slug = excluded.product_slug,
			current_period_end = excluded.current_period_end,
			cancel_at_period_end = excluded.cancel_at_period_end,
			checked_at = excluded.checked_at,
			provider_data = excluded.provider_data,
			updated_at = excluded.updated_at
		where excluded.checked_at >= subscriptions.checked_at
		returning subject
	`);

	return rows.length > 0;
}

/**
 * One page of the readers who have ever reached a checkout, which is the whole of what
 * the daily reconciliation walks.
 *
 * @param connection - The credential set to walk
 * @param limit - How many rows the page holds
 * @param after - The subject the previous page ended on, or `null` for the first page
 */
export async function pageBillingCustomers(
	connection: string,
	limit: number,
	after: string | null = null,
): Promise<SelectBillingCustomer[]> {
	let where = after === null ? { connection } : and({ connection }, gt("subject", after));

	return await connect().findMany(billingCustomers, {
		where,
		orderBy: [["subject", "asc"]],
		limit,
	});
}

/** One delivery row as D1 holds it, where the two verdicts are integers rather than booleans. */
interface DeliveryRow {
	valid: number | boolean;
	processed: number | boolean;
}

/** Reads one of D1's integer verdicts as the boolean the store's shape carries. */
function verdict(value: DeliveryRow["valid"]): boolean {
	return value === true || value === 1;
}

/**
 * Where billing deliveries are kept, so a replay is recognized against a durable key and
 * the exact bytes a signature covered stay readable after a handler got something wrong.
 *
 * @example new BillingWebhook(polar, handlers, { store: deliveries });
 */
export let deliveries: WebhookStore = {
	/**
	 * Reads a recorded delivery.
	 *
	 * @param id - The platform's delivery id
	 * @returns The row, or `null` when this delivery has never arrived
	 */
	async find(id: string): Promise<WebhookDelivery | null> {
		let row = await connect().findOne(billingDeliveries, { where: { id } });
		if (row === null) return null;

		return {
			id: row.id,
			type: row.type,
			payload: row.payload,
			valid: verdict(row.valid),
			processed: verdict(row.processed),
		};
	},

	/**
	 * Writes a delivery, replacing any row sharing its id, so a redelivery of an unfinished
	 * one is measured against the bytes that arrived last.
	 *
	 * @param delivery - The delivery and the signature verdict on it
	 */
	async record(delivery: WebhookDelivery): Promise<void> {
		await connect().exec(sql`
			insert into billing_webhook_deliveries
				(id, type, payload, valid, processed, received_at)
			values (
				${delivery.id}, ${delivery.type}, ${delivery.payload},
				${delivery.valid ? 1 : 0}, ${delivery.processed ? 1 : 0}, ${Date.now()}
			)
			on conflict (id) do update set
				type = excluded.type,
				payload = excluded.payload,
				valid = excluded.valid,
				processed = excluded.processed
		`);
	},

	/**
	 * Marks a delivery handled, which is what a later replay is measured against.
	 *
	 * @param id - The platform's delivery id
	 */
	async markProcessed(id: string): Promise<void> {
		await connect().updateMany(billingDeliveries, { processed: true }, { where: { id } });
	},
};
