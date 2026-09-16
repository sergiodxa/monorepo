/**
 * The app's feature flags: the definitions every evaluation resolves against, the typed
 * catalog a call site names one by, and the instance every surface evaluates through.
 *
 * Definitions are written here rather than read from storage, so changing one is an edit
 * and a deploy — the review a constant already gets, with the targeting a constant has no
 * room for. What earns a flag is a number nobody has measured yet, or a feature worth
 * turning off faster than a revert: everything else stays a constant.
 *
 * Both of this app's object types evaluate too, so a rule can widen one feed's polling or
 * one reader's budget without touching anybody else's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Client } from "@sdxc/flags";
import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { defineFlags, flag } from "@sdxc/flags/catalog";
import { createFlags, wideEventHook } from "@sdxc/flags/client";

import { READER_BUDGET } from "~/database/schema";

/** The cadence every feed is polled on, as the hours a reader would talk about it in. */
const POLL_INTERVAL_HOURS = 24;

/**
 * Posts a day above which a feed is busy enough to be worth asking a reader about, when
 * nothing ages out of their subscription to it.
 */
const BUSY_POSTS_PER_DAY = 10;

/**
 * What every evaluation resolves against. A key absent from here resolves to the default
 * its call site passed, so retiring a flag is deleting its entry and then its branch.
 */
export const FLAG_SET: StoredFlagSet = {
	flags: {
		/**
		 * How often a feed's own object fetches it. One number for every feed, chosen for
		 * the median one and never measured against real publishing rates — so it is the
		 * number most likely to be wrong, and the one whose cost is paid by publishers
		 * rather than by this app. Subjects are feeds, so a rule on `targetingKey` polls
		 * one busy publication faster while the rest stay where they are.
		 */
		"feed-poll-interval-hours": {
			variants: { hourly: 1, "six-hourly": 6, daily: POLL_INTERVAL_HOURS },
			defaultVariant: "daily",
		},
		/**
		 * Posts one reader's object holds before it starts reclaiming, and then refusing.
		 * It is an estimate of what a row costs with room to be wrong by five times, and
		 * the reader who meets it is the one who notices. Subjects are readers, so the
		 * budget can be raised for somebody who has met it without moving it for everyone.
		 */
		"reader-post-budget": {
			variants: { standard: READER_BUDGET, generous: READER_BUDGET * 5 },
			defaultVariant: "standard",
		},
		/**
		 * How much a feed has to publish before a reader is asked whether they want it to
		 * age out. Set from nothing but judgement, and the only flag here whose right
		 * value is a question about people rather than about storage.
		 */
		"velocity-suggestion-rate": {
			variants: { eager: 5, standard: BUSY_POSTS_PER_DAY, quiet: 40 },
			defaultVariant: "standard",
		},
		/**
		 * Whether a reader may keep posts. It is the newest surface here and the one that
		 * writes a column every sweep then has to respect, so turning it off is how the
		 * lists go back to what they were without a deploy.
		 */
		"saved-posts": {
			variants: { on: true, off: false },
			defaultVariant: "on",
		},
		/**
		 * Whether a list fetches the page below it as the reader arrives. Off, the links
		 * that page the list by hand are what a reader gets — which is what a browser
		 * running no script gets either, so the way back is a path already walked.
		 */
		"infinite-pagination": {
			variants: { on: true, off: false },
			defaultVariant: "on",
		},
	},
};

/**
 * Every flag by the name a call site reaches for, carrying the key, the type and the
 * value to fall back on when nothing resolved — so a call site restates none of them and
 * a misspelled key is not expressible.
 *
 * @example let budget = await ctx.flags.get(features.readerPostBudget);
 */
export const features = defineFlags({
	feedPollIntervalHours: flag.number("feed-poll-interval-hours", POLL_INTERVAL_HOURS),
	readerPostBudget: flag.number("reader-post-budget", READER_BUDGET),
	velocitySuggestionRate: flag.number("velocity-suggestion-rate", BUSY_POSTS_PER_DAY),
	savedPosts: flag.boolean("saved-posts", true),
	infinitePagination: flag.boolean("infinite-pagination", true),
});

/**
 * The instance every surface evaluates through, installed on a request by the router's
 * middleware and reached directly by the two object types.
 *
 * The provider is built the first time an evaluation needs one rather than at module
 * scope, so loading this module in a Worker does no work.
 */
export const flags = createFlags({
	provider: () => new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	hooks: [wideEventHook()],
});

/**
 * A client bound to one subject, for the objects, which have no request to carry one.
 *
 * A Durable Object answers in its own context, so the middleware that publishes
 * `ctx.flags` never runs there: it names its own subject instead — the reader it holds,
 * or the feed it is.
 *
 * @param targetingKey - The reader's subject, or the feed's id.
 * @example let client = await flagsFor(this.#subject());
 */
export async function flagsFor(targetingKey: string): Promise<Client> {
	await flags.ready();
	return flags.getClient(undefined, { targetingKey });
}
