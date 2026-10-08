/**
 * The storage the package calls and the app implements: followers, processed activity ids,
 * the app's own objects and its actors' keys. Federation state lives in the app's database,
 * in its own shape and migrations, next to the content it federates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import type { ActorKeys } from "./keys.js";
import type { ActivityPub } from "./lib/types.js";

/** Someone who follows a local actor, as the package needs to deliver to them and answer Undo. */
export interface Follower {
	/** The local actor being followed. */
	actor: string;
	/** The remote actor's id. */
	id: string;
	inbox: string;
	/** Preferred for delivery, so one POST reaches every follower on that server. */
	sharedInbox: string | null;
	/** The Follow's id: an Accept echoes it and an Undo must name it. */
	followId: string;
	/** `pending` while a local actor that approves followers by hand has not decided. */
	state: "accepted" | "pending";
}

/**
 * A page of a store listing. `next` is the store's own opaque cursor, handed back unchanged to
 * read the following page, and `null` on the last one.
 *
 * @template T The listed item.
 */
export interface StorePage<T> {
	items: T[];
	next: string | null;
}

/** The followers of local actors. Every write is idempotent, so redelivered activities are harmless. */
export interface FollowerStore {
	/** Inserts or replaces by `(actor, id)`, so a repeated Follow refreshes inbox and `followId`. */
	put(follower: Follower): Promise<Result<void, Error>>;
	/** The follower in any state, so an Undo can name its Follow; `null` when `id` follows nobody. */
	get(actor: string, id: string): Promise<Result<Follower | null, Error>>;
	/** Succeeds when the follower is already gone, so a repeated Undo is harmless. */
	remove(actor: string, id: string): Promise<Result<void, Error>>;
	/** Drops every follower reached through this inbox or shared inbox, after it answered 410. */
	removeInbox(inbox: string): Promise<Result<void, Error>>;
	/** Accepted followers, for the collection; `origin` narrows to one server (FEP-8fcf). */
	list(
		actor: string,
		options: { cursor: string | null; limit: number; origin?: string },
	): Promise<Result<StorePage<Follower>, Error>>;
	/** Accepted followers, which is the `totalItems` the followers collection publishes. */
	count(actor: string): Promise<Result<number, Error>>;
	/** Distinct delivery targets of accepted followers, `sharedInbox ?? inbox`, one per URL. */
	inboxes(
		actor: string,
		options: { cursor: string | null; limit: number },
	): Promise<Result<StorePage<string>, Error>>;
}

/**
 * Activity ids already processed. Claiming is best effort, because every handler is
 * idempotent: this saves work on a redelivery and is never what makes processing correct.
 */
export interface SeenActivities {
	/** `true` the first time an id is claimed within `ttl`, and again once `ttl` has passed. */
	claim(id: string, ttl: DurationInput): Promise<Result<boolean, Error>>;
}

/** The app's own objects, so the inbox can tell a reply, Like or Announce of local content from noise. */
export interface LocalObjects {
	/** The public object this app serves under `id`, or `null` when it serves none. */
	find(id: string): Promise<Result<ActivityPub.Object | null, Error>>;
}

/** The signing keys of local actors. */
export interface KeyProvider {
	/** `null` for an actor this app does not host. */
	keysOf(actor: string): Promise<Result<ActorKeys | null, Error>>;
}
