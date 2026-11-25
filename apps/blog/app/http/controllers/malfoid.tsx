/**
 * HTTP action for Malfoid Stickers' landing at `/apps/malfoid`, the Marketing URL of the pack's
 * App Store listing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { MalfoidLandingView } from "~/resources/views/malfoid/landing";
import routes from "~/routes/web";

/**
 * Renders the landing. The App Store call reads the listing from `config/malfoid.ts`,
 * showing "coming soon" before release and the download link after.
 *
 * @returns The landing page.
 */
export default createAction(routes.malfoid.landing, (ctx) => ctx.render(MalfoidLandingView, {}));
