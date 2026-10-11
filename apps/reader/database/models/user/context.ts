/**
 * The model context every model over a reader's database reads, with `models` typed as the
 * registry's own entries. Models import `createModel` from here, so a callback or method
 * reaches a sibling table through `this.context.models` bound to the same database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundModels, ModelContext } from "@sdxc/data-model";

import { withContext } from "@sdxc/data-model";

import type { AgentTokens } from "./agent-tokens";
import type { Devices } from "./devices";
import type { Folders } from "./folders";
import type { ItemTags } from "./item-tags";
import type { Posts } from "./posts";
import type { Rules } from "./rules";
import type { Searches } from "./searches";
import type { Settings } from "./settings";
import type { Subscriptions } from "./subscriptions";
import type { Tags } from "./tags";

/** The entries of the reader's registry, each resolved only when a model reads it. */
export interface UserModelEntries {
	settings: typeof Settings;
	subscriptions: typeof Subscriptions;
	posts: typeof Posts;
	folders: typeof Folders;
	tags: typeof Tags;
	itemTags: typeof ItemTags;
	rules: typeof Rules;
	searches: typeof Searches;
	agentTokens: typeof AgentTokens;
	devices: typeof Devices;
}

/** What the reader's models read as `this.context`: the binding's database and their siblings. */
export interface UserModelContext extends ModelContext {
	models: BoundModels<UserModelEntries>;
}

/** Defines a model whose callbacks and methods see the reader's siblings as `models`. */
export const { createModel } = withContext<UserModelContext>();
