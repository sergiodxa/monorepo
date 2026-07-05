import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
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

async function renderForm(
	ctx: RequestContext,
	input: Partial<PostTypeInput> & { builtin?: boolean },
	title: string,
	error?: string,
): Promise<Response> {
	let { user, permissions, siteTitle } = await chrome(ctx.db);
	return ctx.render(
		<CmsLayout
			title={title}
			siteTitle={siteTitle}
			userLabel={label(user)}
			permissions={permissions}
			notice={error}
		>
			<form method="post">
				<label mix={[s.label]} htmlFor="name">
					Name (machine)
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="name"
					name="name"
					defaultValue={input.name ?? ""}
					readonly={input.builtin}
				/>
				<label mix={[s.label]} htmlFor="path">
					Path (URL segment)
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="path"
					name="path"
					defaultValue={input.path ?? ""}
				/>
				<label mix={[s.label]} htmlFor="label">
					Label
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="label"
					name="label"
					defaultValue={input.label ?? ""}
				/>
				<label mix={[s.label]} htmlFor="description">
					Description
				</label>
				<input
					mix={[s.control]}
					type="text"
					id="description"
					name="description"
					defaultValue={input.description ?? ""}
				/>
				<label mix={[s.label]} htmlFor="fields">
					Fields (JSON array)
				</label>
				<textarea
					mix={[s.textarea]}
					id="fields"
					name="fields"
					defaultValue={JSON.stringify(input.fields ?? [], null, 2)}
				/>
				<p mix={[s.help]}>
					Each field: {`{"key","label","kind","required"}`}. kind ∈
					text|textarea|markdown|date|url|boolean|tags.
				</p>
				<label mix={[s.label]}>
					<input type="checkbox" name="visible" defaultChecked={input.visible !== false} /> Visible
					on the public site
				</label>
				<p>
					<button mix={[s.button]} type="submit">
						Save
					</button>{" "}
					<a mix={[s.button, s.buttonSecondary]} href="/cms/post-types">
						Cancel
					</a>
				</p>
			</form>
		</CmsLayout>,
	);
}

/** `/cms/post-types` — custom post type management (gated by `post_types.manage`). */
export default createController(routes.cms.postTypes, {
	middleware: [requirePermission("post_types.manage")],
	actions: {
		async index(ctx) {
			let { user, permissions, siteTitle } = await chrome(ctx.db);
			let types = await PostType.findAll(ctx.db);
			return ctx.render(
				<CmsLayout
					title="Post Types"
					siteTitle={siteTitle}
					userLabel={label(user)}
					permissions={permissions}
				>
					<p>
						<a mix={[s.button]} href="/cms/post-types/new">
							New post type
						</a>
					</p>
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th mix={[s.cell]}>Label</th>
								<th mix={[s.cell]}>Name</th>
								<th mix={[s.cell]}>Kind</th>
								<th mix={[s.cell]} />
							</tr>
						</thead>
						<tbody>
							{types.map((type) => (
								<tr key={type.id}>
									<td mix={[s.cell]}>{type.label}</td>
									<td mix={[s.cell]}>{type.name}</td>
									<td mix={[s.cell]}>{type.builtin ? "built-in" : "custom"}</td>
									<td mix={[s.cell]}>
										<a href={`/cms/post-types/${type.id}/edit`}>Edit</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</CmsLayout>,
			);
		},

		async new(ctx) {
			return renderForm(ctx, { visible: true, fields: [] }, "New Post Type");
		},

		async create(ctx) {
			try {
				await PostType.create(ctx.db, readForm(ctx.formData));
			} catch (error) {
				return renderForm(
					ctx,
					safeReadForm(ctx.formData),
					"New Post Type",
					String((error as Error).message),
				);
			}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let types = await PostType.findAll(ctx.db);
			let type = types.find((candidate) => candidate.id === ctx.params.id);
			if (!type) return notFound("Not found");
			return renderForm(ctx, type, `Edit ${type.label}`);
		},

		async update(ctx) {
			try {
				await PostType.update(ctx.db, ctx.params.id, readForm(ctx.formData));
			} catch (error) {
				return renderForm(
					ctx,
					safeReadForm(ctx.formData),
					"Edit Post Type",
					String((error as Error).message),
				);
			}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			try {
				await PostType.destroy(ctx.db, ctx.params.id);
			} catch {
				// Built-in types cannot be deleted; ignore and return to the list.
			}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		},
	},
});
