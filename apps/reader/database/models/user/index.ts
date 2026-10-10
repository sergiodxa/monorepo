/**
 * The models over one reader's own SQLite, bound once per Durable Object instance to the
 * object's database. Entries are eager because the object already loads every module it
 * answers with, and its storage handle outlives every call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

import { AgentTokens } from "./agent-tokens";
import { Devices } from "./devices";
import { Folders } from "./folders";
import { ItemTags } from "./item-tags";
import { Posts } from "./posts";
import { Rules } from "./rules";
import { Searches } from "./searches";
import { Settings } from "./settings";
import { Subscriptions } from "./subscriptions";
import { Tags } from "./tags";

/** Every model over a reader's database, bound by the object as `this.#models`. */
export const userModels = createModels({
	settings: Settings,
	subscriptions: Subscriptions,
	posts: Posts,
	folders: Folders,
	tags: Tags,
	itemTags: ItemTags,
	rules: Rules,
	searches: Searches,
	agentTokens: AgentTokens,
	devices: Devices,
});

/** The registry bound to one reader's database, for code the object hands its models to. */
export type UserModels = BoundRegistry<typeof userModels>;
