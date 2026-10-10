/**
 * The registry entries for alerts, the events each delivery records, maintenance windows and
 * status pages. Each domain lists its own models here, so adding one touches only its domain's
 * file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** This domain's models, keyed by the name `ctx.models` binds each under. */
export const ALERT_MODELS = {
	alerts: () => import("../alerts"),
	alertEvents: () => import("../alert-events"),
	maintenanceWindows: () => import("../maintenance-windows"),
	statusPages: () => import("../status-pages"),
};
