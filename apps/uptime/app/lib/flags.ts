/**
 * The app's feature flags: the definitions every evaluation resolves against, the typed
 * catalog a call site names one by, and the instance both surfaces evaluate through.
 *
 * Definitions are written here rather than read from storage, so flipping a flag is an
 * edit and a deploy — the review a constant already gets, with the targeting rules a
 * constant has no room for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { defineFlags, flag } from "@sdxc/flags/catalog";
import { createFlags, wideEventHook } from "@sdxc/flags/client";

import { SWEEP_CONCURRENCY } from "~/app/lib/concurrency";

/**
 * What every evaluation resolves against. A key absent from here resolves to the default
 * its call site passed, so retiring a flag is deleting its entry and then its branch.
 */
export const FLAG_SET: StoredFlagSet = {
	flags: {
		/**
		 * The ad-hoc ping API, and not the dashboard's quick check beside it: this is the
		 * one surface a script can spend a team's metered pings from at machine speed.
		 * Subjects are teams, so a rule on `team.slug` closes it to one caller.
		 */
		"adhoc-ping-api": {
			variants: { on: true, off: false },
			defaultVariant: "on",
		},
		/**
		 * How many monitors a sweep works on at once, a placeholder pending measurement.
		 * Subjects are job names, so a rule on `targetingKey` widens the sweep being
		 * measured while the rest stay where they are.
		 */
		"sweep-concurrency": {
			variants: { narrow: 5, default: SWEEP_CONCURRENCY, wide: 25 },
			defaultVariant: "default",
		},
	},
};

/**
 * Every flag by the name a call site reaches for, carrying the key, the type and the
 * value to fall back on when nothing resolved — so a call site restates none of them and
 * a misspelled key is not expressible.
 *
 * @example
 * let concurrency = await ctx.flags.get(features.sweepConcurrency);
 */
export const features = defineFlags({
	adhocPingApi: flag.boolean("adhoc-ping-api", true),
	sweepConcurrency: flag.number("sweep-concurrency", SWEEP_CONCURRENCY),
});

/**
 * The instance both surfaces evaluate through, installed by the router's middleware and
 * the job dispatcher's.
 *
 * The provider is built the first time an evaluation needs one rather than at module
 * scope, which is where {@link FLAG_SET} is parsed — so loading this module in a Worker
 * does no work.
 */
export const flags = createFlags({
	provider: () => new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	hooks: [wideEventHook()],
});
