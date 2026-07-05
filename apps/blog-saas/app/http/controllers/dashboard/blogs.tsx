import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";
import { env } from "cloudflare:workers";

import type { Region } from "~/app/models/blog";
import type Blog from "~/bootstrap/tenant";

import { getAccountId } from "~/app/http/middleware/session";
import action from "~/app/lib/action";
import { platformDb } from "~/app/lib/db";
import { renderDocument } from "~/app/lib/render";
import BlogModel from "~/app/models/blog";
import Hostname from "~/app/models/hostname";
import UsageDaily from "~/app/models/usage";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { HostnameService } from "~/app/services/hostname";
import { Page } from "~/app/views/layout";

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

/** GET /dashboard/blogs/new — create form. */
export const newBlog = action<"GET", "/dashboard/blogs/new">(async () => {
	if (!getAccountId()) return redirect("/auth/login", { status: redirect.Status.SeeOther });
	let body = await renderDocument(
		<Page title="Create a blog">
			<p>
				<a href="/dashboard">← Dashboard</a>
			</p>
			<h1>Create a blog</h1>
			<form method="post" action="/dashboard/blogs">
				<label htmlFor="name">Blog name</label>
				<input type="text" id="name" name="name" required />
				<label htmlFor="region">Region</label>
				<select id="region" name="region">
					{REGIONS.map((region) => (
						<option value={region} key={region}>
							{region}
						</option>
					))}
				</select>
				<p>
					<button type="submit">Create blog</button>
				</p>
			</form>
		</Page>,
	);
	return ok(body);
});

/** POST /dashboard/blogs — provisions a new blog. */
export const create = action<"POST", "/dashboard/blogs">(async ({ formData }) => {
	let accountId = getAccountId();
	if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

	let name = String(formData.get("name") ?? "").trim();
	let region = String(formData.get("region") ?? "wnam") as Region;
	if (!name) return badRequest("Blog name is required");

	let provisioner = new BlogProvisioner(platformDb());
	try {
		await provisioner.create({ accountId, name, region });
	} catch {
		// The blog row remains in `provisioning`; the owner can retry from its page.
	}
	return redirect("/dashboard", { status: redirect.Status.SeeOther });
});

/** GET /dashboard/blogs/:blogId — blog detail + management. */
export const show = action<"GET", "/dashboard/blogs/:blogId">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
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

	let body = await renderDocument(
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
					<button type="submit">Restore</button>
				</form>
			) : (
				<form method="post" action={`/dashboard/blogs/${blog.id}`}>
					<input type="hidden" name="_method" value="DELETE" />
					<button class="danger" type="submit">
						Delete blog
					</button>
				</form>
			)}
		</Page>,
	);
	return ok(body);
});

/** GET /dashboard/blogs/:blogId/edit — rename form. */
export const edit = action<"GET", "/dashboard/blogs/:blogId/edit">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	let { blog } = result;
	let body = await renderDocument(
		<Page title="Rename blog">
			<h1>Rename blog</h1>
			<form method="post" action={`/dashboard/blogs/${blog.id}`}>
				<input type="hidden" name="_method" value="PUT" />
				<label htmlFor="name">Name</label>
				<input type="text" id="name" name="name" defaultValue={blog.name} />
				<p>
					<button type="submit">Save</button>
				</p>
			</form>
		</Page>,
	);
	return ok(body);
});

/** PUT /dashboard/blogs/:blogId — renames a blog (pushes the title to the DO). */
export const update = action<"PUT", "/dashboard/blogs/:blogId">(async ({ params, formData }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	let { blog } = result;

	let name = String(formData.get("name") ?? "").trim();
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
});

/** DELETE /dashboard/blogs/:blogId — soft-deletes a blog. */
export const destroy = action<"DELETE", "/dashboard/blogs/:blogId">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	await new BlogProvisioner(platformDb()).softDelete(result.blog.id);
	return redirect("/dashboard", { status: redirect.Status.SeeOther });
});

/** POST /dashboard/blogs/:blogId/restore — restores a soft-deleted blog. */
export const restore = action<"POST", "/dashboard/blogs/:blogId/restore">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	await new BlogProvisioner(platformDb()).restore(result.blog.id);
	return redirect(`/dashboard/blogs/${result.blog.id}`, { status: redirect.Status.SeeOther });
});

/** GET /dashboard/blogs/:blogId/domain — custom domain form + status. */
export const domainIndex = action<"GET", "/dashboard/blogs/:blogId/domain">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	let { blog } = result;
	let hostname = await Hostname.findByBlog(platformDb(), blog.id);

	let body = await renderDocument(
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
						<p class="muted">
							Add TXT <code>{hostname.validation_txt_name}</code> ={" "}
							<code>{hostname.validation_txt_value ?? ""}</code>, and a CNAME to{" "}
							<code>fallback.{env.PLATFORM_DOMAIN}</code>.
						</p>
					)}
				</>
			) : (
				<p class="muted">No custom domain yet.</p>
			)}
			<form method="post" action={`/dashboard/blogs/${blog.id}/domain`}>
				<label htmlFor="hostname">Domain (e.g. blog.example.com)</label>
				<input type="text" id="hostname" name="hostname" />
				<p>
					<button type="submit">Add domain</button>
				</p>
			</form>
		</Page>,
	);
	return ok(body);
});

/** POST /dashboard/blogs/:blogId/domain — registers a custom hostname. */
export const domainCreate = action<"POST", "/dashboard/blogs/:blogId/domain">(
	async ({ params, formData }) => {
		let result = await ownedBlog(params.blogId);
		if ("redirect" in result) return result.redirect;
		if ("notFound" in result) return result.notFound;
		let { blog } = result;

		let hostname = String(formData.get("hostname") ?? "")
			.trim()
			.toLowerCase();
		if (!hostname || hostname.endsWith(`.${env.PLATFORM_DOMAIN}`))
			return badRequest("Invalid domain");

		try {
			let service = new HostnameService();
			let created = await service.create(hostname, blog.id, blog.region);
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
);

/** GET /dashboard/blogs/:blogId/usage — recent page-view rollups. */
export const usage = action<"GET", "/dashboard/blogs/:blogId/usage">(async ({ params }) => {
	let result = await ownedBlog(params.blogId);
	if ("redirect" in result) return result.redirect;
	if ("notFound" in result) return result.notFound;
	let { blog } = result;

	let rows = await platformDb().findMany(UsageDaily.table, { where: { blog_id: blog.id } });
	let sorted = rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

	let body = await renderDocument(
		<Page title="Usage">
			<p>
				<a href={`/dashboard/blogs/${blog.id}`}>← {blog.name}</a>
			</p>
			<h1>Usage</h1>
			{sorted.length ? (
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Page views</th>
						</tr>
					</thead>
					<tbody>
						{sorted.map((row) => (
							<tr key={row.date}>
								<td>{row.date}</td>
								<td>{row.page_views}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : (
				<p class="muted">No usage recorded yet.</p>
			)}
		</Page>,
	);
	return ok(body);
});
