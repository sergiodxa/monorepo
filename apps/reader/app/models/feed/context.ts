/**
 * The model context every model over a feed's database reads, with `models` typed as the
 * registry's own entries. Models import `createModel` from here, so a callback or method
 * reaches a sibling table through `this.context.models` bound to the same database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundModels, ModelContext } from "@sdxc/data-model";

import { withContext } from "@sdxc/data-model";

import type { Feed } from "~/app/models/feed/feed";
import type { Items } from "~/app/models/feed/items";
import type { Subscribers } from "~/app/models/feed/subscribers";

/** The entries of the feed's registry, each resolved only when a model reads it. */
export interface FeedModelEntries {
	feed: typeof Feed;
	items: typeof Items;
	subscribers: typeof Subscribers;
}

/** What the feed's models read as `this.context`: the binding's database and their siblings. */
export interface FeedModelContext extends ModelContext {
	models: BoundModels<FeedModelEntries>;
}

/** Defines a model whose callbacks and methods see the feed's siblings as `models`. */
export const { createModel } = withContext<FeedModelContext>();
