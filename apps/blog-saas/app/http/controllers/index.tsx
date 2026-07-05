import { createAction } from "remix/fetch-router";

import { getAccountId } from "~/app/http/middleware/session";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/** Marketing landing page. */
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
