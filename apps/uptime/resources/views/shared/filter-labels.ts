/**
 * The filter bar copy every signed-in list shares (the View and Filters buttons, Apply, the "is" and
 * "is any of" joins, Clear filters and each chip's remove label), translated once, so a list
 * names only what is its own: the toolbar, its views, its search and its facets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { FilterBar } from "@sdxc/ui/app";

/** The shared part of a `FilterBar`'s labels, spread into a list's own. */
export type SharedFilterLabels = Omit<FilterBar.Labels, "toolbar" | "tabs" | "clearKey">;

/**
 * Builds the shared labels from the app's translator.
 *
 * @param t - The request's translator, unprefixed.
 * @example labels={{ toolbar: t("page.cronJobs.filters.toolbar"), ...sharedFilterLabels(t) }}
 */
export function sharedFilterLabels(t: Translate): SharedFilterLabels {
	return {
		options: t("app.layout.filters.options"),
		filters: t("app.layout.filters.filters"),
		apply: t("app.layout.filters.apply"),
		is: t("app.layout.filters.is"),
		isAnyOf: t("app.layout.filters.isAnyOf"),
		clear: t("app.layout.filters.clear"),
		remove: (field, values) => t("app.layout.filters.remove", { field, values }),
	};
}
