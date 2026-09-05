/**
 * `GET /` — the public marketing landing page for Auth SaaS. Rendered with
 * `remix/ui` JSX via `ctx.render`.
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
 * @param ctx - The request context (provides `render`).
 * @returns The rendered landing page document response.
 * @example
 * router.map(routes.index, index);
 */
export default createAction(routes.index, (ctx) => {
	return ctx.render(
		<PublicDocument title="Auth SaaS - Authentication as a Service" variant="landing">
			<LandingPage />
		</PublicDocument>,
	);
});
