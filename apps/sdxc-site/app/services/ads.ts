/**
 * Picks which square ad a documentation page shows, and where it sits relative to
 * the table of contents. The draw is seeded on the UTC day and the page path so
 * the same reader, and every cache copy of that page, keeps one tile for the day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey } from "sdxc/dates";
import { createRandom } from "sdxc/random";

import type { SidebarAdDefinition } from "~/resources/content/ads";

import { SIDEBAR_ADS } from "~/resources/content/ads";

/** Where the ad sits beside the in-page headings. */
export type SidebarAdPlacement = "above" | "below";

/** The ad a page renders today, and which side of the ToC it occupies. */
export interface SidebarAdPick {
	ad: SidebarAdDefinition;
	placement: SidebarAdPlacement;
}

/** The two places an ad may land relative to the headings list. */
const PLACEMENTS = ["above", "below"] as const satisfies readonly SidebarAdPlacement[];

/**
 * The UTC calendar day a page's ads are locked to. Shared caches and etags include
 * this so a stored copy retires when the day rolls over.
 *
 * @param now - Instant whose UTC day to name.
 * @returns A `"YYYY-MM-DD"` day key.
 */
export function adsDayTag(now: Date = new Date()): string {
	return toDayKey(now, "UTC");
}

/**
 * Chooses one ad and its placement for a documentation path on a given day.
 *
 * @param pagePath - The path being read (typically the route's `href()`), which
 *   keeps neighbouring pages from all showing the same tile on the same day.
 * @param now - Instant whose UTC day seeds the draw; tests pass a fixed date.
 * @returns The ad and placement for that path today.
 */
export function pickSidebarAd(pagePath: string, now: Date = new Date()): SidebarAdPick {
	let day = adsDayTag(now);
	let random = createRandom(`sdxc-site-ads:${day}:${pagePath}`);

	return {
		ad: random.pick(SIDEBAR_ADS),
		placement: random.pick(PLACEMENTS),
	};
}
