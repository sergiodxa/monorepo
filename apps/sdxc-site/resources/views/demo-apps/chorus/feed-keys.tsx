/**
 * Client island: the keyboard layer of a Chorus feed. `j` and `k` move between posts with a
 * ring drawn inside the card, and Enter or `o` opens the focused post, each listed in the `?`
 * sheet. Without script every post's link stays reachable by Tab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { rowNavigation } from "@sdxc/ui/app";
import { clientEntry } from "remix/component";

/** The feed a marker sits in, whose posts the keys walk. */
export const FEED_SELECTOR = '[data-slot="chorus-feed"]';

/** Renders a hidden marker carrying the feed's row navigation. */
export const FeedKeys: EntryComponent<Record<never, never>> = clientEntry(
	import.meta.url,
	function FeedKeys() {
		return () => (
			<span
				mix={[
					hidden(),
					rowNavigation({
						within: FEED_SELECTOR,
						rows: "article[data-post]",
						primary: "a[data-post-link]",
						labels: {
							group: "Posts",
							next: "Next post",
							previous: "Previous post",
							open: "Open post",
						},
					}),
				]}
			/>
		);
	},
);
