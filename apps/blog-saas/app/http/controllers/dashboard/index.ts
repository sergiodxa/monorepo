import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { platformDb } from "~/app/lib/db";
import { attr, escape, page } from "~/app/lib/html";
import Account from "~/app/models/account";
import Blog from "~/app/models/blog";
import Subscription from "~/app/models/subscription";

/** GET /dashboard — the account's blogs + subscription status. */
export default action<"GET", "/dashboard">(async () => {
	let accountId = getAccountId();
	if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

	let db = platformDb();
	let [account, blogs, subscription] = await Promise.all([
		Account.findById(db, accountId),
		Blog.listByAccount(db, accountId),
		Subscription.findByAccount(db, accountId),
	]);

	let rows = blogs
		.map((blog) => {
			let host = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
			let link =
				blog.status === "active"
					? `<a href="https://${attr(host)}">${escape(host)}</a>`
					: `<span class="muted">${escape(host)}</span>`;
			return `<tr><td><a href="/dashboard/blogs/${attr(blog.id)}">${escape(blog.name)}</a></td><td>${link}</td><td>${escape(blog.status)}</td></tr>`;
		})
		.join("");

	let subStatus = subscription ? subscription.status : "none";
	let body =
		`<p><a href="/">← Home</a> · Signed in as ${escape(account?.email ?? "")} · ` +
		`<form method="post" action="/auth/logout" style="display:inline"><button class="btn danger" type="submit">Sign out</button></form></p>` +
		`<h1>Your blogs</h1>` +
		`<p>Subscription: <strong>${escape(subStatus)}</strong> · <a href="/dashboard/billing">Manage billing</a></p>` +
		`<p><a class="btn" href="/dashboard/blogs/new">Create a blog</a></p>` +
		(blogs.length
			? `<table><thead><tr><th>Name</th><th>Address</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
			: `<p class="muted">No blogs yet.</p>`);

	return ok(page("Dashboard", body));
});
