/**
 * Builders for the collections an ActivityPub server serves (outbox, followers,
 * following, featured), so an app turns whatever it pages with into the documents
 * `stringify` and `respond` write, with every member it leaves out written as absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ActivityPub } from "./lib/types.js";

/** An entry of a collection as an app authors it: an IRI, or the document itself. */
export type CollectionItem = ActivityPub.Draft<ActivityPub.Item>;

/** A collection as an app authors it; every member besides `id` is optional. */
export interface CollectionInit {
	id: string;
	/** Alone, with no `first`, it answers the count and hides the members. */
	totalItems?: number | null;
	/** The first page's IRI; with `totalItems` and no items, the shape a paged collection serves. */
	first?: string | null;
	last?: string | null;
}

/** A page as an app authors it. */
export interface PageInit {
	id: string;
	/** The collection this page belongs to. */
	partOf: string;
	next?: string | null;
	prev?: string | null;
	totalItems?: number | null;
}

/**
 * An ordered collection: reverse chronological, as ActivityPub §5 requires of an outbox
 * and of followers and following.
 *
 * @param init - The id, count, pages, and inline items for a short collection.
 * @example
 * orderedCollection({ id: FOLLOWERS_ID, totalItems: count, first: `${FOLLOWERS_ID}?page=1` });
 */
export function orderedCollection(
	init: CollectionInit & { orderedItems?: CollectionItem[] },
): ActivityPub.Draft<ActivityPub.OrderedCollection> {
	return { ...init, type: "OrderedCollection" };
}

/**
 * One page of an ordered collection. A `null` `next` marks the last page, which is how a
 * crawler knows to stop.
 *
 * @param init - The page id, its collection, its neighbours and its items.
 * @example
 * orderedCollectionPage({ id: pageUrl, partOf: OUTBOX_ID, orderedItems: creates, next });
 */
export function orderedCollectionPage(
	init: PageInit & { orderedItems: CollectionItem[] },
): ActivityPub.Draft<ActivityPub.OrderedCollectionPage> {
	return { ...init, type: "OrderedCollectionPage" };
}

/**
 * An unordered collection, such as an object's `replies` or `likes`.
 *
 * @param init - The id, count, pages, and inline items.
 */
export function collection(
	init: CollectionInit & { items?: CollectionItem[] },
): ActivityPub.Draft<ActivityPub.Collection> {
	return { ...init, type: "Collection" };
}

/**
 * One page of an unordered collection.
 *
 * @param init - The page id, its collection, its neighbours and its items.
 */
export function collectionPage(
	init: PageInit & { items: CollectionItem[] },
): ActivityPub.Draft<ActivityPub.CollectionPage> {
	return { ...init, type: "CollectionPage" };
}
