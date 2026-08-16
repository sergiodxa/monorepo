/**
 * `GET /` — the public marketing landing page for Auth SaaS. Rendered with `remix/ui`
 * JSX via `ctx.render` (replacing the former Tailwind-CDN `html()` string template).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { LandingPage, PublicDocument } from "~/app/views/landing";
import routes from "~/routes/web";

/**
 * Renders the marketing landing page.
 *
 * @param ctx - The request context (provides `render` and `logger`).
 * @returns The rendered landing page document response.
 * @example
 * router.map(routes.index, index);
 */
export default createAction(routes.index, (ctx) => {
	ctx.logger.loader("/").info("Landing page loaded");

	return ctx.render(
		<PublicDocument title="Auth SaaS - Authentication as a Service" variant="landing">
			<LandingPage />
		</PublicDocument>,
	);
});
