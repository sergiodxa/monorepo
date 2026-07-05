import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound, ok } from "@pkg/http/response/html";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { PostType, type FieldDefinition, type PostTypeInput } from "../models/post-type";

async function chrome(db: Database) {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
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

async function renderForm(
	db: Database,
	input: Partial<PostTypeInput> & { builtin?: boolean },
	title: string,
	error?: string,
): Promise<string> {
	let { user, permissions, siteTitle } = await chrome(db);
	return renderDocument(
		<CmsLayout
			title={title}
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
			notice={error}
		>
			<form method="post">
				<label htmlFor="name">Name (machine)</label>
				<input
					type="text"
					id="name"
					name="name"
					defaultValue={input.name ?? ""}
					readonly={input.builtin}
				/>
				<label htmlFor="path">Path (URL segment)</label>
				<input type="text" id="path" name="path" defaultValue={input.path ?? ""} />
				<label htmlFor="label">Label</label>
				<input type="text" id="label" name="label" defaultValue={input.label ?? ""} />
				<label htmlFor="description">Description</label>
				<input
					type="text"
					id="description"
					name="description"
					defaultValue={input.description ?? ""}
				/>
				<label htmlFor="fields">Fields (JSON array)</label>
				<textarea
					id="fields"
					name="fields"
					defaultValue={JSON.stringify(input.fields ?? [], null, 2)}
				/>
				<p class="help">
					Each field: {`{"key","label","kind","required"}`}. kind ∈
					text|textarea|markdown|date|url|boolean|tags.
				</p>
				<label>
					<input type="checkbox" name="visible" defaultChecked={input.visible !== false} /> Visible
					on the public site
				</label>
				<p>
					<button type="submit">Save</button>{" "}
					<a class="btn secondary" href="/cms/post-types">
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>,
	);
}

export const index = action<"GET", "/cms/post-types">(async ({ db }) => {
	let { user, permissions, siteTitle } = await chrome(db);
	let types = await PostType.findAll(db);
	let body = await renderDocument(
		<CmsLayout
			title="Post Types"
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
		>
			<p>
				<a class="btn" href="/cms/post-types/new">
					New post type
				</a>
			</p>
			<table>
				<thead>
					<tr>
						<th>Label</th>
						<th>Name</th>
						<th>Kind</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{types.map((type) => (
						<tr key={type.id}>
							<td>{type.label}</td>
							<td>{type.name}</td>
							<td>{type.builtin ? "built-in" : "custom"}</td>
							<td>
								<a href={`/cms/post-types/${type.id}/edit`}>Edit</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</CmsLayout>,
	);
	return ok(body);
});

export const newType = action<"GET", "/cms/post-types/new">(async ({ db }) => {
	return ok(await renderForm(db, { visible: true, fields: [] }, "New Post Type"));
});

export const create = action<"POST", "/cms/post-types">(async ({ db, formData }) => {
	try {
		await PostType.create(db, readForm(formData));
	} catch (error) {
		return badRequest(
			await renderForm(
				db,
				safeReadForm(formData),
				"New Post Type",
				String((error as Error).message),
			),
		);
	}
	return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
});

export const edit = action<"GET", "/cms/post-types/:id/edit">(async ({ db, params }) => {
	let types = await PostType.findAll(db);
	let type = types.find((candidate) => candidate.id === params.id);
	if (!type) return notFound("Not found");
	return ok(await renderForm(db, type, `Edit ${type.label}`));
});

export const update = action<"PUT", "/cms/post-types/:id">(async ({ db, params, formData }) => {
	try {
		await PostType.update(db, params.id, readForm(formData));
	} catch (error) {
		return badRequest(
			await renderForm(
				db,
				safeReadForm(formData),
				"Edit Post Type",
				String((error as Error).message),
			),
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
