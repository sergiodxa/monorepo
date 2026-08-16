/**
 * The `/` controller: the marketing landing page, whose primary call-to-action links
 * to the dashboard or the sign-in flow depending on whether the visitor already has a
 * session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createAction } from "remix/router";

import { getAccountId } from "~/app/http/middleware/session";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * Renders the marketing landing page for `GET /`, adapting the call-to-action to the
 * viewer's auth state.
 *
 * @param ctx The request context (provides `ctx.render`).
 * @returns The rendered landing-page HTML response.
 */
export default createAction(routes.index, async (ctx) => {
	let signedIn = getAccountId() !== null;
	return ctx.render(
		<Page title="Blogs, hosted">
			<h1>Launch a blog in seconds</h1>
			<p mix={[s.muted]}>
				A multi-tenant blog platform. Create a blog, get a subdomain, bring your own domain, and
				write.
			</p>
			<p>
				{signedIn ? (
					<a mix={[s.button]} href="/dashboard">
						Go to your dashboard
					</a>
				) : (
					<a mix={[s.button]} href="/auth/login">
						Sign in to get started
					</a>
				)}
			</p>
		</Page>,
	);
});
