/**
 * The registry entries for HTTP monitors, their content checks and the daily stats every monitor
 * type rolls up into. Each domain lists its own models here, so adding one touches only its
 * domain's file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** This domain's models, keyed by the name `ctx.models` binds each under. */
export const MONITOR_MODELS = {
	contentChecks: () => import("../content-checks"),
	monitorDailyStats: () => import("../monitor-daily-stats"),
	monitorResults: () => import("../monitor-results"),
	monitors: () => import("../monitors"),
};
