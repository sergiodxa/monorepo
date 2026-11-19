/**
 * What every Wayfern screen reads from its request, gathered once: today, the visitor, the
 * address, and the two forms of the address a screen hands its links and posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Traveller } from "./state";

/** One screen's request, as its views read it. */
export interface Screen {
	/** Today's key, which every calendar and the trips' upcoming/past split count from. */
	today: string;
	traveller: Traveller;
	/** The whole address, for the search and filters a screen keeps in it. */
	url: URL;
	/** The page path under the app, such as `stay/the-canopy`; `""` on home. */
	page: string;
	/** The page path and query a post returns to, without its one-time toast. */
	back: string;
	/** The page's own address without its toast, which a calendar link reloads without script. */
	base: string;
}
