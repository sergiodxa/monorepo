/**
 * Per-page crawl directives for the `robots` meta tag. It exists so a page can opt out
 * of indexing or link following with a boolean instead of remembering which of the four
 * directive spellings pairs with which. Site-wide crawl policy belongs in `robots.txt`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Per-page crawl directives. Both default to `true`, the behavior of no tag at all. */
export interface RobotsOptions {
	/** Whether search engines may index this page. `false` emits `noindex`. */
	index?: boolean;
	/** Whether search engines may follow the links on this page. `false` emits `nofollow`. */
	follow?: boolean;
}

/**
 * Builds the `robots` meta tag content. Every directive is spelled out explicitly, so
 * the emitted value states the page's full policy and a diff of two pages' head output
 * stays readable.
 *
 * @param options - Which directives the page opts out of.
 * @returns The directive list, e.g. `"noindex, follow"`.
 * @example robotsDirectives({ index: false }) // "noindex, follow"
 * @example robotsDirectives() // "index, follow"
 */
export function robotsDirectives(options: RobotsOptions = {}): string {
	let { index = true, follow = true } = options;
	return `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}`;
}
