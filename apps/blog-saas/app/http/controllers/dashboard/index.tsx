import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { platformDb } from "~/app/lib/db";
import { renderDocument } from "~/app/lib/render";
import Account from "~/app/models/account";
import Blog from "~/app/models/blog";
import Subscription from "~/app/models/subscription";
import { Page } from "~/app/views/layout";

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

	let body = await renderDocument(
		<Page title="Dashboard">
			<p>
				<a href="/">← Home</a> · Signed in as {account?.email ?? ""} ·{" "}
				<form method="post" action="/auth/logout" style="display:inline">
					<button class="danger" type="submit">
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
				<a class="btn" href="/dashboard/blogs/new">
					Create a blog
				</a>
			</p>
			{blogs.length ? (
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Address</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{blogs.map((blog) => {
							let host = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
							return (
								<tr key={blog.id}>
									<td>
										<a href={`/dashboard/blogs/${blog.id}`}>{blog.name}</a>
									</td>
									<td>
										{blog.status === "active" ? (
											<a href={`https://${host}`}>{host}</a>
										) : (
											<span class="muted">{host}</span>
										)}
									</td>
									<td>{blog.status}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			) : (
				<p class="muted">No blogs yet.</p>
			)}
		</Page>,
	);
	return ok(body);
});
