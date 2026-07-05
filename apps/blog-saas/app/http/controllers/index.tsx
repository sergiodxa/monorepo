import { ok } from "@pkg/http/response/html";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { renderDocument } from "~/app/lib/render";
import { Page } from "~/app/views/layout";

/** Marketing landing page. */
export default action<"GET", "/">(async () => {
	let signedIn = getAccountId() !== null;
	let body = await renderDocument(
		<Page title="Blogs, hosted">
			<h1>Launch a blog in seconds</h1>
			<p class="muted">
				A multi-tenant blog platform. Create a blog, get a subdomain, bring your own domain, and
				write.
			</p>
			<p>
				{signedIn ? (
					<a class="btn" href="/dashboard">
						Go to your dashboard
					</a>
				) : (
					<a class="btn" href="/auth/login">
						Sign in to get started
					</a>
				)}
			</p>
		</Page>,
	);
	return ok(body);
});
