import { ok } from "@pkg/http/response/html";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { page } from "~/app/lib/html";

/** Marketing landing page. */
export default action<"GET", "/">(async () => {
	let signedIn = getAccountId() !== null;
	let cta = signedIn
		? `<a class="btn" href="/dashboard">Go to your dashboard</a>`
		: `<a class="btn" href="/auth/login">Sign in to get started</a>`;
	return ok(
		page(
			"Blogs, hosted",
			`<h1>Launch a blog in seconds</h1>` +
				`<p class="muted">A multi-tenant blog platform. Create a blog, get a subdomain, ` +
				`bring your own domain, and write.</p>` +
				`<p>${cta}</p>`,
		),
	);
});
