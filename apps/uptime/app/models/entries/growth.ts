/**
 * The registry entries for leads, trial watches and their results, trial conversions and the
 * daily trial counters. Each domain lists its own models here, so adding one touches only its
 * domain's file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** This domain's models, keyed by the name `ctx.models` binds each under. */
export const GROWTH_MODELS = {
	leads: () => import("../leads"),
	trialWatches: () => import("../trial-watches"),
	trialWatchResults: () => import("../trial-watch-results"),
	trialConversions: () => import("../trial-conversions"),
	trialDailyStats: () => import("../trial-daily-stats"),
};
