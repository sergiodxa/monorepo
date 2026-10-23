/**
 * Which list links render a `<link rel="prefetch">` for their destination. Every navigation
 * is a full document load, so the browser's own prefetch is what makes the next page instant;
 * each hint is a request on page load, so a list spends them on its first entries only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Link } from "@sdxc/ui";

/** How many entries at the top of a list prefetch their page, the ones a reader picks most. */
export const PREFETCHED_ENTRIES = 10;

/**
 * The prefetch mode for a list's entry: `"render"` for one of the first
 * {@link PREFETCHED_ENTRIES} that links to a page on this site, `"none"` for the rest and for
 * any address on another origin, such as a bookmark's.
 *
 * @param index The entry's position in its list, from zero.
 * @param href The entry's destination.
 * @returns The mode to hand the entry's link.
 * @example <Link href={item.href} prefetch={entryPrefetch(index, item.href)} />
 */
export function entryPrefetch(index: number, href: string): Link.Prefetch {
	if (index >= PREFETCHED_ENTRIES) return "none";
	if (!href.startsWith("/") || href.startsWith("//")) return "none";
	return "render";
}
