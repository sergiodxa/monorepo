import type { Database } from "remix/data-table";
import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { badRequest, forbidden, notFound, ok } from "@pkg/http/response/html";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import {
	PostType,
	type FieldDefinition,
	type PostTypeDefinition,
} from "../../post-types/models/post-type";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
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
		let help = field.description ? <p class="help">{field.description}</p> : null;
		let label = (
			<label htmlFor={name}>
				{field.label}
				{field.required ? " *" : ""}
			</label>
		);
		if (field.kind === "markdown" || field.kind === "textarea") {
			return (
				<>
					{label}
					<textarea id={name} name={name} defaultValue={typeof value === "string" ? value : ""} />
					{help}
				</>
			);
		}
		if (field.kind === "boolean") {
			return (
				<>
					<label>
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
					<input type="text" id={name} name={name} defaultValue={tags} />
					{help}
				</>
			);
		}
		let inputType = field.kind === "url" ? "url" : field.kind === "date" ? "date" : "text";
		return (
			<>
				{label}
				<input
					type={inputType}
					id={name}
					name={name}
					defaultValue={typeof value === "string" ? value : ""}
				/>
				{help}
			</>
		);
	};
}

interface FormOptions {
	canPublish: boolean;
	userLabel: string;
	permissions: ReadonlySet<never>;
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

/** Renders the create/edit post form document. */
async function renderForm(
	db: Database,
	type: PostTypeDefinition,
	options: FormOptions,
): Promise<string> {
	let siteTitle = await Settings.siteTitle(db);
	let post = options.post;
	let formAction = post
		? `/cms/types/${type.name}/posts/${post.id}`
		: `/cms/types/${type.name}/posts`;

	let publishInput: RemixNode = options.canPublish ? (
		<>
			<label htmlFor="published_at">Publish date (leave blank for draft)</label>
			<input
				type="datetime-local"
				id="published_at"
				name="published_at"
				defaultValue={toLocalInput(post?.published_at ?? null)}
			/>
		</>
	) : (
		<p class="help">You can save drafts. An editor will publish them.</p>
	);

	return renderDocument(
		<CmsLayout
			title={post ? `Edit ${type.label}` : `New ${type.label}`}
			siteTitle={siteTitle}
			userLabel={options.userLabel}
			permissions={options.permissions}
			notice={options.error}
		>
			<form method="post" action={formAction}>
				{post && <input type="hidden" name="_method" value="PUT" />}
				<label htmlFor="title">Title *</label>
				<input type="text" id="title" name="title" defaultValue={post?.meta.title ?? ""} required />
				<label htmlFor="slug">Slug</label>
				<input type="text" id="slug" name="slug" defaultValue={post?.slug ?? ""} />
				<p class="help">Leave blank to derive from the title.</p>
				{type.fields.map((field) => (
					<FieldInput key={field.key} field={field} value={post?.meta[field.key]} />
				))}
				{publishInput}
				<p>
					<button type="submit">Save</button>{" "}
					<a class="btn secondary" href={`/cms/types/${type.name}/posts`}>
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>,
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

/** Resolves the post type for the route, or throws a 404 response. */
async function requireType(db: Database, typeName: string): Promise<PostTypeDefinition> {
	let type = await PostType.findByName(db, typeName);
	if (!type) throw notFound("Unknown post type");
	return type;
}

/** Common context for CMS post actions. */
async function ctxInfo() {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	return { user, permissions };
}

/** Parses the `published_at` form field to an ISO string or null (draft). */
function parsePublishedAt(formData: FormData): string | null {
	let raw = String(formData.get("published_at") ?? "").trim();
	if (!raw) return null;
	let ts = Date.parse(raw);
	return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

export const index = action<"GET", "/cms/types/:typeName/posts">(async ({ db, params }) => {
	let type = await requireType(db, params.typeName);
	let { user, permissions } = await ctxInfo();
	if (!user) return forbidden("Forbidden");

	let codec = createMetaCodec(type);
	let posts = await Post.findManyForType(db, type.name, codec);
	let siteTitle = await Settings.siteTitle(db);

	let body = await renderDocument(
		<CmsLayout
			title={type.label}
			siteTitle={siteTitle}
			userLabel={user.display_name || user.email}
			permissions={permissions}
		>
			<p>
				<a class="btn" href={`/cms/types/${type.name}/posts/new`}>
					New {type.label}
				</a>
			</p>
			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>State</th>
						<th />
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
								<td>{post.meta.title || "(untitled)"}</td>
								<td>{state}</td>
								<td>
									{canEdit && <a href={`/cms/types/${type.name}/posts/${post.id}/edit`}>Edit</a>}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</CmsLayout>,
	);
	return ok(body);
});

export const newPost = action<"GET", "/cms/types/:typeName/posts/new">(async ({ db, params }) => {
	let type = await requireType(db, params.typeName);
	let { user, permissions } = await ctxInfo();
	if (!user || !permissions.has("posts.create")) return forbidden("Forbidden");
	return ok(
		await renderForm(db, type, {
			canPublish: permissions.has("posts.publish"),
			userLabel: user.display_name || user.email,
			permissions,
		}),
	);
});

export const create = action<"POST", "/cms/types/:typeName/posts">(
	async ({ db, params, formData }) => {
		let type = await requireType(db, params.typeName);
		let { user, permissions } = await ctxInfo();
		if (!user || !permissions.has("posts.create")) return forbidden("Forbidden");

		let meta = readMeta(formData, type);
		if (!meta.title) {
			return badRequest(
				await renderForm(db, type, {
					canPublish: permissions.has("posts.publish"),
					userLabel: user.display_name || user.email,
					permissions,
					error: "Title is required.",
				}),
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
	},
);

export const edit = action<"GET", "/cms/types/:typeName/posts/:id/edit">(async ({ db, params }) => {
	let type = await requireType(db, params.typeName);
	let { user, permissions } = await ctxInfo();
	if (!user) return forbidden("Forbidden");

	let codec = createMetaCodec(type);
	let post = await Post.findByIdForType(db, type.name, params.id, codec);
	if (!post) return notFound("Not found");
	if (!permissions.has("posts.edit_any") && post.author_id !== user.id)
		return forbidden("Forbidden");

	return ok(
		await renderForm(db, type, {
			canPublish: permissions.has("posts.publish"),
			userLabel: user.display_name || user.email,
			permissions,
			post: { id: post.id, slug: post.slug, published_at: post.published_at, meta: post.meta },
		}),
	);
});

export const update = action<"PUT", "/cms/types/:typeName/posts/:id">(
	async ({ db, params, formData }) => {
		let type = await requireType(db, params.typeName);
		let { user, permissions } = await ctxInfo();
		if (!user) return forbidden("Forbidden");

		let codec = createMetaCodec(type);
		let existing = await Post.findByIdForType(db, type.name, params.id, codec);
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
			params.id,
			{ slug, published_at: publishedAt, meta },
			codec,
		);
		return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
	},
);

export const destroy = action<"DELETE", "/cms/types/:typeName/posts/:id">(
	async ({ db, params }) => {
		let type = await requireType(db, params.typeName);
		let { user, permissions } = await ctxInfo();
		if (!user) return forbidden("Forbidden");

		let post = await Post.findById(db, params.id);
		if (!post || post.type !== type.name) return notFound("Not found");
		let canDelete =
			permissions.has("posts.delete_any") ||
			(permissions.has("posts.delete_own") && post.author_id === user.id);
		if (!canDelete) return forbidden("Forbidden");

		await Post.destroy(db, params.id);
		return redirect(`/cms/types/${type.name}/posts`, { status: redirect.Status.SeeOther });
	},
);
