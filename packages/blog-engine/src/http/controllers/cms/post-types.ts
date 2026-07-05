import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { PostType, type FieldDefinition, type PostTypeInput } from "../../../domain/post-type";
import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { cmsLayout } from "../../../views/cms-layout";
import { attr, escape } from "../../../views/html";

async function chrome(db: Database) {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

/** Reads a post-type form (fields entered as a JSON array textarea for v1). */
function readForm(formData: FormData): PostTypeInput {
	let fieldsRaw = String(formData.get("fields") ?? "[]");
	let fields: FieldDefinition[] = [];
	let parsed: unknown = JSON.parse(fieldsRaw);
	if (Array.isArray(parsed)) fields = parsed as FieldDefinition[];
	return {
		name: String(formData.get("name") ?? "").trim(),
		path: String(formData.get("path") ?? "").trim(),
		label: String(formData.get("label") ?? "").trim(),
		description: String(formData.get("description") ?? ""),
		fields,
		visible: formData.get("visible") != null,
	};
}

function form(input: Partial<PostTypeInput> & { builtin?: boolean }, error?: string): string {
	return (
		(error ? `<div class="notice">${escape(error)}</div>` : "") +
		`<form method="post">` +
		`<label for="name">Name (machine)</label><input type="text" id="name" name="name" value="${attr(input.name ?? "")}"${input.builtin ? " readonly" : ""}>` +
		`<label for="path">Path (URL segment)</label><input type="text" id="path" name="path" value="${attr(input.path ?? "")}">` +
		`<label for="label">Label</label><input type="text" id="label" name="label" value="${attr(input.label ?? "")}">` +
		`<label for="description">Description</label><input type="text" id="description" name="description" value="${attr(input.description ?? "")}">` +
		`<label for="fields">Fields (JSON array)</label><textarea id="fields" name="fields">${escape(JSON.stringify(input.fields ?? [], null, 2))}</textarea>` +
		`<p class="help">Each field: {"key","label","kind","required"}. kind ∈ text|textarea|markdown|date|url|boolean|tags.</p>` +
		`<label><input type="checkbox" name="visible"${input.visible === false ? "" : " checked"}> Visible on the public site</label>` +
		`<p><button type="submit">Save</button> <a class="btn secondary" href="/cms/post-types">Cancel</a></p></form>`
	);
}

export const index = action<"GET", "/cms/post-types">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let types = await PostType.findAll(db);
	let rows = types
		.map(
			(type) =>
				`<tr><td>${escape(type.label)}</td><td>${escape(type.name)}</td><td>${type.builtin ? "built-in" : "custom"}</td>` +
				`<td><a href="/cms/post-types/${attr(type.id)}/edit">Edit</a></td></tr>`,
		)
		.join("");
	let body =
		`<p><a class="btn" href="/cms/post-types/new">New post type</a></p>` +
		`<table><thead><tr><th>Label</th><th>Name</th><th>Kind</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
	return ok(
		cmsLayout({ title: "Post Types", siteTitle, userLabel: label(user), permissions, body }),
	);
});

export const newType = action<"GET", "/cms/post-types/new">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	return ok(
		cmsLayout({
			title: "New Post Type",
			siteTitle,
			userLabel: label(user),
			permissions,
			body: form({ visible: true, fields: [] }),
		}),
	);
});

export const create = action<"POST", "/cms/post-types">(async ({ db, formData }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	try {
		await PostType.create(db, readForm(formData));
	} catch (error) {
		return badRequest(
			cmsLayout({
				title: "New Post Type",
				siteTitle,
				userLabel: label(user),
				permissions,
				body: form(safeReadForm(formData), String((error as Error).message)),
			}),
		);
	}
	return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
});

export const edit = action<"GET", "/cms/post-types/:id/edit">(async ({ db, params }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let types = await PostType.findAll(db);
	let type = types.find((candidate) => candidate.id === params.id);
	if (!type) return notFound("Not found");
	return ok(
		cmsLayout({
			title: `Edit ${type.label}`,
			siteTitle,
			userLabel: label(user),
			permissions,
			body: form(type),
		}),
	);
});

export const update = action<"PUT", "/cms/post-types/:id">(async ({ db, params, formData }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	try {
		await PostType.update(db, params.id, readForm(formData));
	} catch (error) {
		return badRequest(
			cmsLayout({
				title: "Edit Post Type",
				siteTitle,
				userLabel: label(user),
				permissions,
				body: form(safeReadForm(formData), String((error as Error).message)),
			}),
		);
	}
	return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
});

export const destroy = action<"DELETE", "/cms/post-types/:id">(async ({ db, params }) => {
	try {
		await PostType.destroy(db, params.id);
	} catch {
		// Built-in types cannot be deleted; ignore and return to the list.
	}
	return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
});

function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

/** Reads the form defensively for error re-rendering (bad JSON tolerated). */
function safeReadForm(formData: FormData): Partial<PostTypeInput> {
	try {
		return readForm(formData);
	} catch {
		return {
			name: String(formData.get("name") ?? ""),
			path: String(formData.get("path") ?? ""),
			label: String(formData.get("label") ?? ""),
			fields: [],
		};
	}
}
