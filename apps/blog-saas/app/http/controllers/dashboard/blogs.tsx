/**
 * The blog management controllers under `/dashboard/blogs`: the resourceful
 * create/show/edit/update/delete actions plus the sibling custom-domain, usage, and
 * restore routes, all scoped so an account can only touch blogs it owns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { HostnameClient } from "@pkg/hostname";
import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction, createController } from "remix/router";

import type { Region } from "~/app/models/blog";
import type Blog from "~/bootstrap/tenant";

import { getAccountId } from "~/app/http/middleware/session";
import BlogModel from "~/app/models/blog";
import Hostname from "~/app/models/hostname";
import UsageDaily from "~/app/models/usage";
import { BlogProvisioner } from "~/app/services/blog-provisioner";
import { Page } from "~/app/views/layout";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

/** Allow-list of valid DO location-hint regions; arbitrary form input is rejected. */
export const REGIONS: Region[] = ["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"];

/**
 * Reads a text field out of a submitted form. Any field can arrive as a file
 * part, which is not text, so it reads as the fallback instead of stringifying
 * to the literal `"[object File]"` and being stored as a blog name or domain.
 *
 * @param formData The submitted form body.
 * @param name The field name to read.
 * @param fallback Returned when the field is absent or was submitted as a file.
 */
export function fieldText(formData: FormData, name: string, fallback = ""): string {
	let value = formData.get(name);
	return typeof value === "string" ? value : fallback;
}

/**
 * Loads a blog and asserts the current account owns it, the shared authorization
 * guard for every per-blog action. Returns a `Response` (login redirect or 404) the
 * caller should return as-is, or the account id and blog on success.
 *
 * @param db The control-plane database.
 * @param blogId The id of the blog to load.
 * @returns A `Response` to short-circuit with, or `{ accountId, blog }` when owned.
 */
async function ownedBlog(
	db: Database,
	blogId: string,
): Promise<
	| Response
	| { accountId: string; blog: NonNullable<Awaited<ReturnType<typeof BlogModel.findById>>> }
> {
	let accountId = getAccountId();
	if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });
	let blog = await BlogModel.findById(db, blogId);
	if (!blog || blog.account_id !== accountId) return notFound("Not found");
	return { accountId, blog };
}

/**
 * Resourceful controller for `/dashboard/blogs`: `new`/`create` build a blog (via the
 * provisioner), `show` displays it with live DO stats, `edit`/`update` rename it, and
 * `destroy` soft-deletes it. Every action requires an authenticated, owning account.
 *
 * @returns A rendered page, or a redirect/error response per action.
 */
export default createController(routes.dashboard.blogs, {
	actions: {
		new: inject([] as const, async () => {
			let ctx = getContext();
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
						<select mix={[s.selectControl]} id="region" name="region">
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
		}),

		/**
		 * A failed provisioning attempt leaves the row in `provisioning` so the
		 * owner can retry from the blog's page.
		 */
		create: inject([BlogProvisioner] as const, async (provisioner) => {
			let ctx = getContext();
			let accountId = getAccountId();
			if (!accountId) return redirect("/auth/login", { status: redirect.Status.SeeOther });

			let name = fieldText(ctx.formData, "name").trim();
			if (!name) return badRequest("Blog name is required");

			let regionInput = fieldText(ctx.formData, "region", "wnam");
			if (!REGIONS.includes(regionInput as Region)) return badRequest("Invalid region");
			let region: Region = regionInput as Region;

			try {
				await provisioner.create({ accountId, name, region });
			} catch {}
			return redirect("/dashboard", { status: redirect.Status.SeeOther });
		}),

		/**
		 * The admin link always targets the subdomain because the OIDC callback
		 * is registered there, even once a custom domain is active.
		 */
		show: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(ds.object({ id: ds.string() }), ctx.params);
			let result = await ownedBlog(db, id);
			if (result instanceof Response) return result;
			let { blog } = result;

			let subdomain = `${blog.slug}.${env.PLATFORM_DOMAIN}`;
			let adminHost = subdomain;

			let stats = "—";
			try {
				let stub = env.BLOG.getByName(blog.id) as unknown as DurableObjectStub<Blog>;
				let info = await stub.getStats();
				stats = `${Math.round(info.databaseSize / 1024)} KB`;
			} catch {}

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
		}),

		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(ds.object({ id: ds.string() }), ctx.params);
			let result = await ownedBlog(db, id);
			if (result instanceof Response) return result;
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
		}),

		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(ds.object({ id: ds.string() }), ctx.params);
			let result = await ownedBlog(db, id);
			if (result instanceof Response) return result;
			let { blog } = result;

			let name = fieldText(ctx.formData, "name").trim();
			if (name) {
				await db.update(
					BlogModel.table,
					{ id: blog.id },
					{ name, updated_at: new Date().toISOString() },
				);
				let stub = env.BLOG.getByName(blog.id) as unknown as DurableObjectStub<Blog>;
				await stub.updateMeta({ title: name }).catch(() => {});
			}
			return redirect(`/dashboard/blogs/${blog.id}`, { status: redirect.Status.SeeOther });
		}),

		destroy: inject([Database, BlogProvisioner] as const, async (db, provisioner) => {
			let ctx = getContext();
			let { id } = ds.parse(ds.object({ id: ds.string() }), ctx.params);
			let result = await ownedBlog(db, id);
			if (result instanceof Response) return result;
			await provisioner.softDelete(result.blog.id);
			return redirect("/dashboard", { status: redirect.Status.SeeOther });
		}),
	},
});

/**
 * Custom-domain controller for `/dashboard/blogs/:blogId/domain`. Registering a
 * domain checks local uniqueness before calling Cloudflare and rolls back the
 * created hostname on a failed write, so a duplicate never leaves an orphan behind.
 *
 * @returns The domain page (`index`), or a redirect/`badRequest` (`action`).
 */
export const domain = createController(routes.dashboard.blogDomain, {
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { blogId } = ds.parse(ds.object({ blogId: ds.string() }), ctx.params);
			let result = await ownedBlog(db, blogId);
			if (result instanceof Response) return result;
			let { blog } = result;
			let hostname = await Hostname.findByBlog(db, blog.id);

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
		}),

		action: inject([Database, HostnameClient] as const, async (db, service) => {
			let ctx = getContext();
			let { blogId } = ds.parse(ds.object({ blogId: ds.string() }), ctx.params);
			let result = await ownedBlog(db, blogId);
			if (result instanceof Response) return result;
			let { blog } = result;

			let hostname = fieldText(ctx.formData, "hostname").trim().toLowerCase();
			if (!hostname || hostname.endsWith(`.${env.PLATFORM_DOMAIN}`))
				return badRequest("Invalid domain");

			if (await Hostname.findByBlog(db, blog.id))
				return badRequest("This blog already has a custom domain.");
			if (await Hostname.findByHostname(db, hostname))
				return badRequest("That domain is already registered.");

			let created;
			try {
				created = await service.create(hostname, blog.id, blog.region);
			} catch {
				return badRequest("Could not register the domain. Check your Cloudflare configuration.");
			}

			try {
				await Hostname.create(db, {
					id: created.id,
					blogId: blog.id,
					hostname,
					validationTxtName: created.validationTxtName,
					validationTxtValue: created.validationTxtValue,
				});
			} catch {
				await service.delete(created.id).catch(() => {});
				return badRequest("Could not save the domain. Please try again.");
			}
			return redirect(`/dashboard/blogs/${blog.id}/domain`, { status: redirect.Status.SeeOther });
		}),
	},
});

/**
 * Usage controller for `GET /dashboard/blogs/:blogId/usage`: renders the blog's most
 * recent daily page-view rollups (up to 30 days, newest first).
 *
 * @returns The rendered usage page, or an ownership short-circuit response.
 */
export const usage = createAction(
	routes.dashboard.blogUsage,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { blogId } = ds.parse(ds.object({ blogId: ds.string() }), ctx.params);
		let result = await ownedBlog(db, blogId);
		if (result instanceof Response) return result;
		let { blog } = result;

		let rows = await db.findMany(UsageDaily.table, { where: { blog_id: blog.id } });
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
	}),
);

/**
 * Restore controller for `POST /dashboard/blogs/:blogId/restore`: restores a
 * soft-deleted blog (via the provisioner) and returns to the blog's page.
 *
 * @returns A redirect to the blog page, or an ownership short-circuit response.
 */
export const restore = createAction(
	routes.dashboard.blogRestore,
	inject([Database, BlogProvisioner] as const, async (db, provisioner) => {
		let ctx = getContext();
		let { blogId } = ds.parse(ds.object({ blogId: ds.string() }), ctx.params);
		let result = await ownedBlog(db, blogId);
		if (result instanceof Response) return result;
		await provisioner.restore(result.blog.id);
		return redirect(`/dashboard/blogs/${result.blog.id}`, { status: redirect.Status.SeeOther });
	}),
);
