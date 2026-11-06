/**
 * HTTP action for Wakaba's landing at `/apps/wakaba`, the Marketing URL of the app's App Store
 * listing. The page renders from configuration alone, so it reads nothing per request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { WakabaLandingView } from "~/resources/views/wakaba/landing";
import routes from "~/routes/web";

/**
 * Renders the landing. The App Store call reads the listing from `config/wakaba.ts`, so the
 * same page shows "coming soon" before release and the download link after.
 *
 * @returns The landing page.
 */
export default createAction(routes.wakaba, (ctx) => ctx.render(WakabaLandingView, {}));
