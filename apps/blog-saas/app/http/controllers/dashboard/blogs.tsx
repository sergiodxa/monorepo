import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";
import { createAction, createController } from "remix/fetch-router";

import type { Region } from "~/app/models/blog";
import type Blog from "~/bootstrap/tenant";

import { getAccountId } from "~/app/http/middleware/session";
import { platformDb } from "~/app/lib/db";
import BlogModel from "~/app/models/blog";
import Hostname from "~/app/models/hostname";
import UsageDaily from "~/app/models/usage";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { HostnameService } from "~/app/services/hostname";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

const REGIONS: Region[] = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"];

/** Loads a blog owned by the current account, or returns a redirect/404 Response. */
async function ownedBlog(blogId: string) {
	let accountId = getAccountId();
	if (!accountId)
		return { redirect: redirect("/auth/login", { status: redirect.Status.SeeOther }) };
	let blog = await BlogModel.findById(platformDb(), blogId);
	if (!blog || blog.account_id !== accountId) return { notFound: notFound("Not found") };
	return { accountId, blog };
}

/** `/dashboard/blogs` — create/show/edit/delete an account's blogs. */
export default createController(routes.dashboard.blogs, {
	actions: {
		async new(ctx) {
			if (!getAccountId()) return redirect("/auth/login", { status: redirect.Status.SeeOther });
			return ctx.render(
				<Page title="Create a blog">
					<p>
						<a href="/dashboard">← Dashboard</a>
					</p>
					<h1>Create a blog</h1>
					<form method="post" action="/dashboard/blogs">
						<label mix={[s.label]} htmlFor="name">
							Blog name
						</label>
						<input mix={[s.control]} type="text" id="name" name="name" required />
						<label mix={[s.label]} htmlFor="region">
							Region
						</label>
						<select mix={[s.control]} id="region" name="region">
							{REGIONS.map((region) => (
								<option value={region} key={region}>
									{region}
								</option>
							))}
						</select>
						<p>
							<button mix={[s.button]} type="submit">
								Create blog
							</button>
						</p>
					</form>
				</Page>,
			);
		},

		async create(ctx) {
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let name = String(ctx.formData.get("name") ?? "").trim();
			let region = String(ctx.formData.get("region") ?? "wnam") as Region;
			if (!name) return badRequest("Blog name is required");

			try {
				await new BlogProvisioner(platformDb()).create({ accountId, name, region });
			} catch {
				// The blog row remains in `provisioning`; the owner can retry from its page.
			}
			return redirect("/dashboard", { status: redirect.Status.SeeOther });
		},

		async show(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			let { blog } = result;

			let db = platformDb();
			let hostname = await Hostname.findByBlog(db, blog.id);
			let subdomain = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
			let adminHost = blog.custom_hostname_active && hostname ? hostname.hostname : subdomain;

			let stats = "—";
			try {
				let stub = env.BLOG.getByName(blog.id) as unknown as DurableObjectStub<Blog>;
				let info = await stub.getStats();
				stats = `${Math.round(info.databaseSize / 1024)} KB`;
			} catch {
				// Stats are best-effort.
			}

			return ctx.render(
				<Page title={blog.name}>
					<p>
						<a href="/dashboard">← Dashboard</a>
					</p>
					<h1>{blog.name}</h1>
					<p>
						Status: <strong>{blog.status}</strong>
					</p>
					<p>
						Address: <a href={`https://${subdomain}`}>{subdomain}</a>
						{blog.custom_hostname_active ? " (custom domain active — subdomain disabled)" : ""}
					</p>
					<p>
						Admin: <a href={`https://${adminHost}/cms`}>Open CMS</a>
					</p>
					<p>Storage: {stats}</p>
					<p>
						<a href={`/dashboard/blogs/${blog.id}/domain`}>Custom domain</a> ·{" "}
						<a href={`/dashboard/blogs/${blog.id}/usage`}>Usage</a>
					</p>
					{blog.status === "deleted" ? (
						<form method="post" action={`/dashboard/blogs/${blog.id}/restore`}>
							<button mix={[s.button]} type="submit">
								Restore
							</button>
						</form>
					) : (
						<form method="post" action={`/dashboard/blogs/${blog.id}`}>
							<input type="hidden" name="_method" value="DELETE" />
							<button mix={[s.button, s.buttonDanger]} type="submit">
								Delete blog
							</button>
						</form>
					)}
				</Page>,
			);
		},

		async edit(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			let { blog } = result;
			return ctx.render(
				<Page title="Rename blog">
					<h1>Rename blog</h1>
					<form method="post" action={`/dashboard/blogs/${blog.id}`}>
						<input type="hidden" name="_method" value="PUT" />
						<label mix={[s.label]} htmlFor="name">
							Name
						</label>
						<input mix={[s.control]} type="text" id="name" name="name" defaultValue={blog.name} />
						<p>
							<button mix={[s.button]} type="submit">
								Save
							</button>
						</p>
					</form>
				</Page>,
			);
		},

		async update(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			let { blog } = result;

			let name = String(ctx.formData.get("name") ?? "").trim();
			if (name) {
				await platformDb().update(
					BlogModel.table,
					{ id: blog.id },
					{ name, updated_at: new Date().toISOString() },
				);
				let stub = env.BLOG.getByName(blog.id) as unknown as DurableObjectStub<Blog>;
				await stub.updateMeta({ title: name }).catch(() => {});
			}
			return redirect(`/dashboard/blogs/${blog.id}`, { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			await new BlogProvisioner(platformDb()).softDelete(result.blog.id);
			return redirect("/dashboard", { status: redirect.Status.SeeOther });
		},
	},
});

/** `/dashboard/blogs/:blogId/domain` — custom domain form + registration. */
export const domain = createController(routes.dashboard.blogDomain, {
	actions: {
		async index(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			let { blog } = result;
			let hostname = await Hostname.findByBlog(platformDb(), blog.id);

			return ctx.render(
				<Page title="Custom domain">
					<p>
						<a href={`/dashboard/blogs/${blog.id}`}>← {blog.name}</a>
					</p>
					<h1>Custom domain</h1>
					{hostname ? (
						<>
							<p>
								Domain: <strong>{hostname.hostname}</strong> — status: {hostname.status}
							</p>
							{hostname.validation_txt_name && (
								<p mix={[s.muted]}>
									Add TXT <code>{hostname.validation_txt_name}</code> ={" "}
									<code>{hostname.validation_txt_value ?? ""}</code>, and a CNAME to{" "}
									<code>fallback.{env.PLATFORM_DOMAIN}</code>.
								</p>
							)}
						</>
					) : (
						<p mix={[s.muted]}>No custom domain yet.</p>
					)}
					<form method="post" action={`/dashboard/blogs/${blog.id}/domain`}>
						<label mix={[s.label]} htmlFor="hostname">
							Domain (e.g. blog.example.com)
						</label>
						<input mix={[s.control]} type="text" id="hostname" name="hostname" />
						<p>
							<button mix={[s.button]} type="submit">
								Add domain
							</button>
						</p>
					</form>
				</Page>,
			);
		},

		async action(ctx) {
			let result = await ownedBlog(ctx.params.blogId);
			if ("redirect" in result) return result.redirect;
			if ("notFound" in result) return result.notFound;
			let { blog } = result;

			let hostname = String(ctx.formData.get("hostname") ?? "")
				.trim()
				.toLowerCase();
			if (!hostname || hostname.endsWith(`.${env.PLATFORM_DOMAIN}`))
				return badRequest("Invalid domain");

			try {
				let created = await new HostnameService().create(hostname, blog.id, blog.region);
				await Hostname.create(platformDb(), {
					id: created.id,
					blogId: blog.id,
					hostname,
					validationTxtName: created.validationTxtName,
					validationTxtValue: created.validationTxtValue,
				});
			} catch {
				return badRequest("Could not register the domain. Check your Cloudflare configuration.");
			}
			return redirect(`/dashboard/blogs/${blog.id}/domain`, { status: redirect.Status.SeeOther });
		},
	},
});

/** GET /dashboard/blogs/:blogId/usage — recent page-view rollups. */
export const usage = createAction(routes.dashboard.blogUsage, async (ctx) => {
	let result = await ownedBlog(ctx.params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	let { blog } = result;

	let rows = await platformDb().findMany(UsageDaily.table, { where: { blog_id: blog.id } });
	let sorted = rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

	return ctx.render(
		<Page title="Usage">
			<p>
				<a href={`/dashboard/blogs/${blog.id}`}>← {blog.name}</a>
			</p>
			<h1>Usage</h1>
			{sorted.length ? (
				<table mix={[s.table]}>
					<thead>
						<tr>
							<th mix={[s.cell]}>Date</th>
							<th mix={[s.cell]}>Page views</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((row) => (
							<tr key={row.date}>
								<td mix={[s.cell]}>{row.date}</td>
								<td mix={[s.cell]}>{row.page_views}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : (
				<p mix={[s.muted]}>No usage recorded yet.</p>
			)}
		</Page>,
	);
});

/** POST /dashboard/blogs/:blogId/restore — restores a soft-deleted blog. */
export const restore = createAction(routes.dashboard.blogRestore, async (ctx) => {
	let result = await ownedBlog(ctx.params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	await new BlogProvisioner(platformDb()).restore(result.blog.id);
	return redirect(`/dashboard/blogs/${result.blog.id}`, { status: redirect.Status.SeeOther });
});
