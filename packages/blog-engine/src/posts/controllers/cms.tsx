import type { Database } from "remix/data-table";
import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { badRequest, forbidden, notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database as DatabaseKey } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import {
	PostType,
	type FieldDefinition,
	type PostTypeDefinition,
} from "../../post-types/models/post-type";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { type Permission } from "../../shared/permissions";
import { createMetaCodec, type PostMetaValues } from "../models/meta-codec";
import { Post } from "../models/post";

/** Derives a URL slug from a title. */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

/** Renders one CMS field input by kind. */
function FieldInput(handle: Handle<{ field: FieldDefinition; value: unknown }>) {
	return () => {
		let { field, value } = handle.props;
		let name = `meta_${field.key}`;
		let help = field.description ? <p mix={[s.help]}>{field.description}</p> : null;
		let label = (
			<label mix={[s.label]} htmlFor={name}>
				{field.label}
				{field.required ? " *" : ""}
			</label>
		);
		if (field.kind === "markdown" || field.kind === "textarea") {
			return (
				<>
					{label}
					<textarea
						mix={[s.textarea]}
						id={name}
						name={name}
						defaultValue={typeof value === "string" ? value : ""}
					/>
					{help}
				</>
			);
		}
		if (field.kind === "boolean") {
			return (
				<>
					<label mix={[s.label]}>
						<input type="checkbox" name={name} defaultChecked={Boolean(value)} /> {field.label}
					</label>
					{help}
				</>
			);
		}
		if (field.kind === "tags") {
			let tags = Array.isArray(value) ? value.join(", ") : "";
			return (
				<>
					{label}
					<input mix={[s.control]} type="text" id={name} name={name} defaultValue={tags} />
					{help}
				</>
			);
		}
		// `<input>`'s JSX props are a discriminated union on `type`, so `type` must be a
		// literal (a union value matches no member). All three are text-like, so only the
		// literal differs.
		let attrs = { id: name, name, defaultValue: typeof value === "string" ? value : "" };
		let input =
			field.kind === "url" ? (
				<input mix={[s.control]} type="url" {...attrs} />
			) : field.kind === "date" ? (
				<input mix={[s.control]} type="date" {...attrs} />
			) : (
				<input mix={[s.control]} type="text" {...attrs} />
			);
		return (
			<>
				{label}
				{input}
				{help}
			</>
		);
	};
}

interface FormOptions {
	canPublish: boolean;
	userLabel: string;
	permissions: ReadonlySet<Permission>;
	post?: { id: string; slug: string; published_at: string | null; meta: PostMetaValues };
	error?: string;
}

/** Converts an ISO timestamp to a `datetime-local` input value. */
function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	let ts = Date.parse(iso);
	if (Number.isNaN(ts)) return "";
	return new Date(ts).toISOString().slice(0, 16);
}

/** Renders the create/edit post form document via `ctx.render`. */
function renderForm(
	db: Database,
	type: PostTypeDefinition,
	options: FormOptions,
	siteTitle: string,
): RemixNode {
	let post = options.post;
	let formAction = post
		? `/cms/types/${type.name}/posts/${post.id}`
		: `/cms/types/${type.name}/posts`;

	let publishInput: RemixNode = options.canPublish ? (
		<>
			<label mix={[s.label]} htmlFor="published_at">
				Publish date (leave blank for draft)
			</label>
			<input
				mix={[s.control]}
				type="datetime-local"
				id="published_at"
				name="published_at"
				defaultValue={toLocalInput(post?.published_at ?? null)}
			/>
		</>
	) : (
		<p mix={[s.help]}>You can save drafts. An editor will publish them.</p>
	);

	return (
		<CmsLayout
			title={post ? `Edit ${type.label}` : `New ${type.label}`}
			siteTitle={siteTitle}
			userLabel={options.userLabel}
			permissions={options.permissions}
			notice={options.error}
		>
			<form method="post" action={formAction}>
				{post && <input type="hidden" name="_method" value="PUT" />}
				<label mix={[s.label]} htmlFor="title">
					Title *
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="title"
					name="title"
					defaultValue={post?.meta.title ?? ""}
					required
				/>
				<label mix={[s.label]} htmlFor="slug">
					Slug
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="slug"
					name="slug"
					defaultValue={post?.slug ?? ""}
				/>
				<p mix={[s.help]}>Leave blank to derive from the title.</p>
				{type.fields.map((field) => (
					<FieldInput key={field.key} field={field} value={post?.meta[field.key]} />
				))}
				{publishInput}
				<p>
					<button mix={[s.button]} type="submit">
						Save
					</button>{" "}
					<a mix={[s.button, s.buttonSecondary]} href={`/cms/types/${type.name}/posts`}>
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>
	);
}

/** Reads native metadata values from the submitted form for a type. */
function readMeta(formData: FormData, type: PostTypeDefinition): PostMetaValues {
	let meta: PostMetaValues = { title: String(formData.get("title") ?? "").trim() };
	for (let field of type.fields) {
		let raw = formData.get(`meta_${field.key}`);
		if (field.kind === "boolean") meta[field.key] = raw != null;
		else if (field.kind === "tags") {
			meta[field.key] = String(raw ?? "")
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean);
		} else meta[field.key] = String(raw ?? "");
	}
	return meta;
}

/** Resolves the post type for the route, or `null` when unknown. */
function requireType(db: Database, typeName: string): Promise<PostTypeDefinition | null> {
	return PostType.findByName(db, typeName);
}

/** Parses the `published_at` form field to an ISO string or null (draft). */
function parsePublishedAt(formData: FormData): string | null {
	let raw = String(formData.get("published_at") ?? "").trim();
	if (!raw) return null;
	let ts = Date.parse(raw);
	return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

/** `/cms/types/:typeName/posts` — one CRUD controller for every post type. */
export default createController(routes.cms.posts, {
	middleware: [requirePermission("posts.create")],
	actions: {
		index: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { params } = ctx;
			let type = await requireType(db, params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			if (!user) return forbidden("Forbidden");
			let permissions = await getPermissions();

			let codec = createMetaCodec(type);
			let posts = await Post.findManyForType(db, type.name, codec);
			let siteTitle = await Settings.siteTitle(db);

			return ctx.render(
				<CmsLayout
					title={type.label}
					siteTitle={siteTitle}
					userLabel={user.display_name || user.email}
					permissions={permissions}
				>
					<p>
						<a mix={[s.button]} href={`/cms/types/${type.name}/posts/new`}>
							New {type.label}
						</a>
					</p>
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th mix={[s.cell]}>Title</th>
								<th mix={[s.cell]}>State</th>
								<th mix={[s.cell]} />
							</tr>
						</thead>
						<tbody>
							{posts.map((post) => {
								let canEdit = permissions.has("posts.edit_any") || post.author_id === user.id;
								let state =
									post.published_at === null
										? "Draft"
										: Post.isScheduled(post.published_at)
											? "Scheduled"
											: "Published";
								return (
									<tr key={post.id}>
										<td mix={[s.cell]}>{post.meta.title || "(untitled)"}</td>
										<td mix={[s.cell]}>{state}</td>
										<td mix={[s.cell]}>
											{canEdit && (
												<a href={`/cms/types/${type.name}/posts/${post.id}/edit`}>Edit</a>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</CmsLayout>,
			);
		}),

		new: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let type = await requireType(db, ctx.params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");
			let siteTitle = await Settings.siteTitle(db);
			return ctx.render(
				renderForm(
					db,
					type,
					{
						canPublish: permissions.has("posts.publish"),
						userLabel: user.display_name || user.email,
						permissions,
					},
					siteTitle,
				),
			);
		}),

		create: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { params, formData } = ctx;
			let type = await requireType(db, params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let meta = readMeta(formData, type);
			let siteTitle = await Settings.siteTitle(db);
			if (!meta.title) {
				return ctx.render(
					renderForm(
						db,
						type,
						{
							canPublish: permissions.has("posts.publish"),
							userLabel: user.display_name || user.email,
							permissions,
							error: "Title is required.",
						},
						siteTitle,
					),
					{ status: 400 },
				);
			}
			let slug = String(formData.get("slug") ?? "").trim() || slugify(meta.title);
			let publishedAt = permissions.has("posts.publish") ? parsePublishedAt(formData) : null;

			await Post.createForType(
				db,
				type.name,
				{ slug, author_id: user.id, published_at: publishedAt, meta },
				createMetaCodec(type),
			);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),

		edit: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { params } = ctx;
			let type = await requireType(db, params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let codec = createMetaCodec(type);
			let post = await Post.findByIdForType(db, type.name, params.id!, codec);
			if (!post) return notFound("Not found");
			if (!permissions.has("posts.edit_any") && post.author_id !== user.id)
				return forbidden("Forbidden");

			let siteTitle = await Settings.siteTitle(db);
			return ctx.render(
				renderForm(
					db,
					type,
					{
						canPublish: permissions.has("posts.publish"),
						userLabel: user.display_name || user.email,
						permissions,
						post: {
							id: post.id,
							slug: post.slug,
							published_at: post.published_at,
							meta: post.meta,
						},
					},
					siteTitle,
				),
			);
		}),

		update: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { params, formData } = ctx;
			let type = await requireType(db, params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let codec = createMetaCodec(type);
			let existing = await Post.findByIdForType(db, type.name, params.id!, codec);
			if (!existing) return notFound("Not found");
			if (!permissions.has("posts.edit_any") && existing.author_id !== user.id)
				return forbidden("Forbidden");

			let meta = readMeta(formData, type);
			if (!meta.title) return badRequest("Title is required");
			let slug = String(formData.get("slug") ?? "").trim() || existing.slug;
			// Publishing is a permission: writers cannot change published_at.
			let publishedAt = permissions.has("posts.publish")
				? parsePublishedAt(formData)
				: existing.published_at;

			await Post.updateForType(
				db,
				type.name,
				params.id!,
				{ slug, published_at: publishedAt, meta },
				codec,
			);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),

		destroy: inject([DatabaseKey] as const, async (db) => {
			let ctx = getContext();
			let { params } = ctx;
			let type = await requireType(db, params.typeName!);
			if (!type) return notFound("Unknown post type");
			let user = await getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let post = await Post.findById(db, params.id!);
			if (!post || post.type !== type.name) return notFound("Not found");
			let canDelete =
				permissions.has("posts.delete_any") ||
				(permissions.has("posts.delete_own") && post.author_id === user.id);
			if (!canDelete) return forbidden("Forbidden");

			await Post.destroy(db, params.id!);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),
	},
});
