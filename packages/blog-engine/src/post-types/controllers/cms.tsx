/**
 * The post-type management controller at `/cms/post-types`: create, edit, and delete
 * custom post types (fields entered as a JSON array in v1). Gated by
 * `post_types.manage`; built-in types are protected by the model layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import * as ds from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { fieldText } from "../../shared/text";
import { PostType, type FieldDefinition, type PostTypeInput } from "../models/post-type";

/**
 * Loads the shared CMS chrome (current user, permission set, site title) for a view.
 * @param db - Database handle.
 * @returns The current user, their permissions, and the site title.
 */
async function chrome(db: Database) {
	let user = getAuthUser();
	let permissions = await getPermissions();
	let siteTitle = await Settings.siteTitle(db);
	return { user, permissions, siteTitle };
}

/**
 * Renders a user's display label, falling back to their email.
 * @param user - The user, or null.
 * @returns The display name, the email, or `""` when null.
 */
function label(user: { display_name: string; email: string } | null): string {
	return user ? user.display_name || user.email : "";
}

/**
 * Reads a post-type form; the fields are entered as a JSON array textarea in v1.
 * @param formData - The submitted form data.
 * @returns The parsed post-type input.
 * @throws {SyntaxError} When the fields textarea is not valid JSON.
 */
function readForm(formData: FormData): PostTypeInput {
	let fieldsRaw = fieldText(formData, "fields", "[]");
	let fields: FieldDefinition[] = [];
	let parsed: unknown = JSON.parse(fieldsRaw);
	if (Array.isArray(parsed)) fields = parsed as FieldDefinition[];
	return {
		name: fieldText(formData, "name").trim(),
		path: fieldText(formData, "path").trim(),
		label: fieldText(formData, "label").trim(),
		description: fieldText(formData, "description"),
		fields,
		visible: formData.get("visible") != null,
	};
}

/**
 * Reads the form defensively for error re-rendering, tolerating invalid fields JSON
 * (falls back to empty fields) so the form can be shown again with the user's input.
 * @param formData - The submitted form data.
 * @returns A best-effort partial post-type input (never throws).
 */
function safeReadForm(formData: FormData): Partial<PostTypeInput> {
	try {
		return readForm(formData);
	} catch {
		return {
			name: fieldText(formData, "name"),
			path: fieldText(formData, "path"),
			label: fieldText(formData, "label"),
			fields: [],
		};
	}
}

/**
 * Renders the post-type create/edit form document via the request's renderer,
 * pre-filling the given input and optionally showing an error banner.
 * @param db - Database handle (used to load the CMS chrome).
 * @param input - Field values to pre-fill (with an optional `builtin` flag).
 * @param title - The page/heading title.
 * @param error - Optional error message to display.
 * @returns The rendered form response.
 */
async function renderForm(
	db: Database,
	input: Partial<PostTypeInput> & { builtin?: boolean },
	title: string,
	error?: string,
): Promise<Response> {
	let ctx = getContext();
	let { user, permissions, siteTitle } = await chrome(db);
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

/** Route params identifying the post type being edited (`:id`). */
const RouteParams = ds.object({ id: ds.string() });

/** `/cms/post-types` — custom post type management (gated by `post_types.manage`). */
export default createController(routes.cms.postTypes, {
	middleware: [requirePermission("post_types.manage")],
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let [{ user, permissions, siteTitle }, types] = await Promise.all([
				chrome(db),
				PostType.findAll(db),
			]);
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
		}),

		new: inject([Database] as const, async (db) => {
			return renderForm(db, { visible: true, fields: [] }, "New Post Type");
		}),

		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			try {
				await PostType.create(db, readForm(ctx.formData));
			} catch (error) {
				return renderForm(
					db,
					safeReadForm(ctx.formData),
					"New Post Type",
					String((error as Error).message),
				);
			}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		}),

		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			let types = await PostType.findAll(db);
			let type = types.find((candidate) => candidate.id === id);
			if (!type) return notFound("Not found");
			return renderForm(db, type, `Edit ${type.label}`);
		}),

		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			try {
				await PostType.update(db, id, readForm(ctx.formData));
			} catch (error) {
				return renderForm(
					db,
					safeReadForm(ctx.formData),
					"Edit Post Type",
					String((error as Error).message),
				);
			}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		}),

		/**
		 * Returns to the list whether the delete succeeds or fails, since the
		 * model layer rejects deletion of built-in post types.
		 */
		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { id } = ds.parse(RouteParams, ctx.params);
			try {
				await PostType.destroy(db, id);
			} catch {}
			return redirect("/cms/post-types", { status: redirect.Status.SeeOther });
		}),
	},
});
