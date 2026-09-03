/**
 * The generic post CRUD controller at `/cms/types/:typeName/posts` — one controller
 * serving every post type by driving its form and validation from the type's field
 * definitions. Enforces the per-action posts.* permissions (create/edit/publish/delete).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@sdxc/http/response";
import { badRequest, forbidden, notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

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
import { entryText, fieldText } from "../../shared/text";
import { createMetaCodec, type PostMetaValues } from "../models/meta-codec";
import { Post } from "../models/post";

/**
 * Derives a URL slug from a title (lowercased, non-alphanumerics collapsed to
 * dashes, trimmed, capped at 80 chars).
 * @param value - The source text (usually the post title).
 * @returns The derived slug.
 */
function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

/**
 * Renders one CMS form input for a field, choosing the control by field kind
 * (textarea/markdown, checkbox, tags, or a typed text input). Repeats the
 * url/date/text cases because `<input>`'s JSX `type` prop is a literal union.
 * @param handle - Component handle exposing the `field` and its current `value`.
 * @returns A render function producing the labeled input.
 */
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

/**
 * Converts an ISO timestamp to the `datetime-local` input value format (`YYYY-MM-DDThh:mm`).
 * @param iso - The ISO timestamp, or null.
 * @returns The input value, or `""` when null/invalid.
 */
function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	let ts = Date.parse(iso);
	if (Number.isNaN(ts)) return "";
	return new Date(ts).toISOString().slice(0, 16);
}

/**
 * Builds the create/edit post form document (as a `remix/ui` node) for a type,
 * pre-filling values on edit and hiding the publish control without `posts.publish`.
 * @param db - Database handle (reserved for future field data needs).
 * @param type - The post type whose fields shape the form.
 * @param options - Current user/permissions, the post being edited, and any error.
 * @param siteTitle - The site title for the CMS chrome.
 * @returns The form document node to render.
 */
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

/**
 * Reads native metadata values from the submitted form for a type, decoding each
 * field by kind (booleans from presence, tags from a comma list, else strings).
 * @param formData - The submitted form data.
 * @param type - The post type whose fields are read.
 * @returns The decoded metadata values (including `title`).
 */
function readMeta(formData: FormData, type: PostTypeDefinition): PostMetaValues {
	let meta: PostMetaValues = { title: fieldText(formData, "title").trim() };
	for (let field of type.fields) {
		let raw = formData.get(`meta_${field.key}`);
		if (field.kind === "boolean") meta[field.key] = raw != null;
		else if (field.kind === "tags") {
			meta[field.key] = entryText(raw)
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean);
		} else meta[field.key] = entryText(raw);
	}
	return meta;
}

/**
 * Resolves the post type named in the route.
 * @param db - Database handle.
 * @param typeName - The `:typeName` route param.
 * @returns The post type definition, or `null` when unknown.
 */
function requireType(db: Database, typeName: string): Promise<PostTypeDefinition | null> {
	return PostType.findByName(db, typeName);
}

/**
 * Parses the `published_at` form field into an ISO string, or null for a draft.
 * @param formData - The submitted form data.
 * @returns The ISO publish timestamp, or null when blank/invalid.
 */
function parsePublishedAt(formData: FormData): string | null {
	let raw = fieldText(formData, "published_at").trim();
	if (!raw) return null;
	let ts = Date.parse(raw);
	return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

/** Route params identifying the post type being operated on (`:typeName`). */
const TypeParams = ds.object({ typeName: ds.string() });

/** Route params identifying a specific post within its type (`:typeName`/`:id`). */
const PostParams = ds.object({ typeName: ds.string(), id: ds.string() });

/** `/cms/types/:typeName/posts` — one CRUD controller for every post type. */
export default createController(routes.cms.posts, {
	middleware: [requirePermission("posts.create")],
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { typeName } = ds.parse(TypeParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
			if (!user) return forbidden("Forbidden");
			let permissions = await getPermissions();

			let codec = createMetaCodec(type);
			let [posts, siteTitle] = await Promise.all([
				Post.findManyForType(db, type.name, codec),
				Settings.siteTitle(db),
			]);

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

		new: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { typeName } = ds.parse(TypeParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
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

		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { formData } = ctx;
			let { typeName } = ds.parse(TypeParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
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
			let slug = fieldText(formData, "slug").trim() || slugify(meta.title);
			let publishedAt = permissions.has("posts.publish") ? parsePublishedAt(formData) : null;

			await Post.createForType(
				db,
				type.name,
				{ slug, author_id: user.id, published_at: publishedAt, meta },
				createMetaCodec(type),
			);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),

		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { typeName, id } = ds.parse(PostParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let codec = createMetaCodec(type);
			let post = await Post.findByIdForType(db, type.name, id, codec);
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

		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { formData } = ctx;
			let { typeName, id } = ds.parse(PostParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let codec = createMetaCodec(type);
			let existing = await Post.findByIdForType(db, type.name, id, codec);
			if (!existing) return notFound("Not found");
			if (!permissions.has("posts.edit_any") && existing.author_id !== user.id)
				return forbidden("Forbidden");

			let meta = readMeta(formData, type);
			if (!meta.title) return badRequest("Title is required");
			let slug = fieldText(formData, "slug").trim() || existing.slug;
			let publishedAt = permissions.has("posts.publish")
				? parsePublishedAt(formData)
				: existing.published_at;

			await Post.updateForType(db, type.name, id, { slug, published_at: publishedAt, meta }, codec);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),

		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { typeName, id } = ds.parse(PostParams, ctx.params);
			let type = await requireType(db, typeName);
			if (!type) return notFound("Unknown post type");
			let user = getAuthUser();
			let permissions = await getPermissions();
			if (!user) return forbidden("Forbidden");

			let post = await Post.findById(db, id);
			if (!post || post.type !== type.name) return notFound("Not found");
			let canDelete =
				permissions.has("posts.delete_any") ||
				(permissions.has("posts.delete_own") && post.author_id === user.id);
			if (!canDelete) return forbidden("Forbidden");

			await Post.destroy(db, id);
			return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
		}),
	},
});
