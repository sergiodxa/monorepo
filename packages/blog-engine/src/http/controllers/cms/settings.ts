import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";

import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { cmsLayout } from "../../../views/cms-layout";
import { attr } from "../../../views/html";

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

	let body =
		`<form method="post">` +
		`<label for="site_title">Site title</label><input type="text" id="site_title" name="site_title" value="${attr(title)}">` +
		`<label for="site_description">Site description</label><input type="text" id="site_description" name="site_description" value="${attr(description)}">` +
		`<label for="language">Language</label><input type="text" id="language" name="language" value="${attr(language)}">` +
		`<p><button type="submit">Save settings</button></p></form>`;

	return ok(
		cmsLayout({
			title: "Settings",
			siteTitle: title,
			userLabel: user.display_name || user.email,
			permissions,
			body,
		}),
	);
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

function redirectHome(): Response {
	return redirect("/cms", { status: redirect.Status.SeeOther });
}
