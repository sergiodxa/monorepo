/**
 * Picks which square ad a documentation page shows below the table of contents.
 * The draw is seeded on the UTC day and the page path so the same reader, and every
 * cache copy of that page, keeps one tile for the day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toDayKey } from "@sdxc/dates";
import { createRandom } from "@sdxc/random";

import type { SidebarAdDefinition } from "~/resources/content/ads";

import { SIDEBAR_ADS } from "~/resources/content/ads";

/** The ad a page renders today. */
export interface SidebarAdPick {
	ad: SidebarAdDefinition;
}

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
 * Absolute href for a sidebar ad, with campaign parameters so a click names this
 * site and this tile when the destination attributes the visit.
 *
 * @param ad - Catalogue entry whose destination to annotate.
 * @returns The destination with `utm_source`, `utm_medium`, and `utm_campaign` set.
 */
export function sidebarAdHref(ad: SidebarAdDefinition): string {
	let url = new URL(ad.href);
	url.searchParams.set("utm_source", "sdxc");
	url.searchParams.set("utm_medium", "docs_sidebar");
	url.searchParams.set("utm_campaign", ad.id);
	return url.href;
}

/**
 * Chooses one ad for a documentation path on a given day.
 *
 * @param pagePath - The path being read (typically the route's `href()`), which
 *   keeps neighbouring pages from all showing the same tile on the same day.
 * @param now - Instant whose UTC day seeds the draw; tests pass a fixed date.
 * @returns The ad for that path today.
 */
export function pickSidebarAd(pagePath: string, now: Date = new Date()): SidebarAdPick {
	let day = adsDayTag(now);
	let random = createRandom(`sdxc-site-ads:${day}:${pagePath}`);

	return {
		ad: random.pick(SIDEBAR_ADS),
	};
}
