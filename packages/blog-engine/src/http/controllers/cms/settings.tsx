import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";

import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { renderDocument } from "../../../shared/lib/render";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { CmsLayout } from "../../../views/cms-layout";

function redirectHome(): Response {
	return redirect("/cms", { status: redirect.Status.SeeOther });
}

/** GET /cms/settings — site title/description/language form. */
export const index = action<"GET", "/cms/settings">(async ({ db }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	if (!user || !permissions.has("settings.manage")) return redirectHome();

	let [title, description, language] = await Promise.all([
		Settings.siteTitle(db),
		Settings.siteDescription(db),
		Settings.language(db),
	]);

	let body = await renderDocument(
		<CmsLayout
			title="Settings"
			siteTitle={title}
			userLabel={user.display_name || user.email}
			permissions={permissions}
		>
			<form method="post">
				<label htmlFor="site_title">Site title</label>
				<input type="text" id="site_title" name="site_title" defaultValue={title} />
				<label htmlFor="site_description">Site description</label>
				<input
					type="text"
					id="site_description"
					name="site_description"
					defaultValue={description}
				/>
				<label htmlFor="language">Language</label>
				<input type="text" id="language" name="language" defaultValue={language} />
				<p>
					<button type="submit">Save settings</button>
				</p>
			</form>
		</CmsLayout>,
	);
	return ok(body);
});

/** POST /cms/settings — persists site settings. */
export const action_ = action<"POST", "/cms/settings">(async ({ db, formData }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	if (!user || !permissions.has("settings.manage")) return redirectHome();

	await Settings.set(
		db,
		"site_title",
		String(formData.get("site_title") ?? "").trim() || "My Blog",
	);
	await Settings.set(db, "site_description", String(formData.get("site_description") ?? ""));
	await Settings.set(db, "language", String(formData.get("language") ?? "en").trim() || "en");
	return redirect("/cms/settings", { status: redirect.Status.SeeOther });
});
