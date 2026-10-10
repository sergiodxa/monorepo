/**
 * The models over one feed's own SQLite, bound once per Durable Object instance to the
 * object's database. Entries are eager because the object already loads every module it
 * answers with, and its storage handle outlives every call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

import { Feed } from "./feed";
import { Items } from "./items";
import { Subscribers } from "./subscribers";

/** Every model over a feed's database, bound by the object as `this.#models`. */
export const feedModels = createModels({
	feed: Feed,
	items: Items,
	subscribers: Subscribers,
});

/** The registry bound to one feed's database, for code the object hands its models to. */
export type FeedModels = BoundRegistry<typeof feedModels>;
