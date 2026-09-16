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

/**
 * What a reader's tier budget is multiplied by before the sweep compares against it, which
 * is the whole of it for everybody until a rule says otherwise.
 */
const BUDGET_SCALE = 1;

/**
 * What the cadence a feed's measured publishing rate puts it in is scaled by. Dimensionless
 * because the fastest band is a quarter of an hour, which no whole-hour number can express.
 */
const POLL_MULTIPLIER = 1;

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
		 * What a feed's own cadence is multiplied by before its alarm is armed. The band
		 * its publishing rate puts it in decides the shape; this decides the scale, so a
		 * deployment can back the whole system off an incident without flattening the
		 * table. Subjects are feeds, so a rule on `targetingKey` slows one publication
		 * while the rest stay where they are.
		 */
		"feed-poll-multiplier": {
			variants: { normal: POLL_MULTIPLIER, relaxed: 4, "backed-off": 24 },
			defaultVariant: "normal",
		},
		/**
		 * What the tier's budget is multiplied by before the object starts reclaiming, and
		 * then refusing. The tier carries the number and this carries the exception to it:
		 * subjects are readers, so the budget can be widened for somebody who has met it
		 * without moving what anybody else, on any tier, was sold.
		 */
		"reader-budget-scale": {
			variants: { standard: BUDGET_SCALE, generous: 5 },
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
		 * Whether a reader may label the posts they keep. It sits beside keeping because it
		 * is the surface built on top of it — a label is a reason to have kept something —
		 * and because turning it off has to be faster than a revert while the table behind
		 * it is new.
		 */
		tags: {
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
 * @example let scale = await ctx.flags.get(features.readerBudgetScale);
 */
export const features = defineFlags({
	feedPollMultiplier: flag.number("feed-poll-multiplier", POLL_MULTIPLIER),
	readerBudgetScale: flag.number("reader-budget-scale", BUDGET_SCALE),
	velocitySuggestionRate: flag.number("velocity-suggestion-rate", BUSY_POSTS_PER_DAY),
	savedPosts: flag.boolean("saved-posts", true),
	tags: flag.boolean("tags", true),
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
