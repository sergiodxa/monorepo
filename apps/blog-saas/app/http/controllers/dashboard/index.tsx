/**
 * The `/dashboard` index controller: the authenticated account's home, listing its
 * blogs with their addresses and lifecycle status alongside the current subscription
 * state and links into billing and blog creation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { getAccountId } from "~/app/http/middleware/session";
import Account from "~/app/models/account";
import Blog from "~/app/models/blog";
import Subscription from "~/app/models/subscription";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/**
 * Renders the dashboard home for `GET /dashboard`, loading the account, its blogs,
 * and subscription. Redirects unauthenticated visitors to the login page.
 *
 * @returns The rendered dashboard HTML response, or a redirect to `/auth/login`.
 */
export default createAction(
	routes.dashboard.index,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let accountId = getAccountId();
		if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

		let [account, blogs, subscription] = await Promise.all([
			Account.findById(db, accountId),
			Blog.listByAccount(db, accountId),
			Subscription.findByAccount(db, accountId),
		]);

		return ctx.render(
			<Page title="Dashboard">
				<p>
					<a href="/">← Home</a> · Signed in as {account?.email ?? ""} ·{" "}
					<form method="post" action="/auth/logout" style="display:inline">
						<button mix={[s.button, s.buttonDanger]} type="submit">
							Sign out
						</button>
					</form>
				</p>
				<h1>Your blogs</h1>
				<p>
					Subscription: <strong>{subscription ? subscription.status : "none"}</strong> ·{" "}
					<a href="/dashboard/billing">Manage billing</a>
				</p>
				<p>
					<a mix={[s.button]} href="/dashboard/blogs/new">
						Create a blog
					</a>
				</p>
				{blogs.length ? (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th mix={[s.cell]}>Name</th>
								<th mix={[s.cell]}>Address</th>
								<th mix={[s.cell]}>Status</th>
							</tr>
						</thead>
						<tbody>
							{blogs.map((blog) => {
								let host = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
								return (
									<tr key={blog.id}>
										<td mix={[s.cell]}>
											<a href={`/dashboard/blogs/${blog.id}`}>{blog.name}</a>
										</td>
										<td mix={[s.cell]}>
											{blog.status === "active" ? (
												<a href={`https://${host}`}>{host}</a>
											) : (
												<span mix={[s.muted]}>{host}</span>
											)}
										</td>
										<td mix={[s.cell]}>{blog.status}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				) : (
					<p mix={[s.muted]}>No blogs yet.</p>
				)}
			</Page>,
		);
	}),
);
