/**
 * The listing cache. One in-process store for the whole worker, holding the open positions
 * the board renders on every visit; publishing a posting drops the entry so the new one is
 * on the page the submitter is redirected to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";

/** How long the listing may be served from the cache. */
export const LISTING_TTL = "1 minute";

/** Key the open-positions listing is stored under. */
export const LISTING_KEY = "postings:open";

/** The store the listing is read from and written to. */
export const cache = new MemoryCache();
