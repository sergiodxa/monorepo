/**
 * The site settings controller at `/cms/settings`: edit the site title, description,
 * and language. Gated by `settings.manage`; values are persisted through the
 * {@link Settings} model with sensible fallbacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { fieldText } from "../../shared/text";
import { Settings } from "../models/settings";

/** `/cms/settings` — site title/description/language (gated by `settings.manage`). */
export default createController(routes.cms.settings, {
	middleware: [requirePermission("settings.manage")],
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let permissions = await getPermissions();
			let [title, description, language] = await Promise.all([
				Settings.siteTitle(db),
				Settings.siteDescription(db),
				Settings.language(db),
			]);

			return ctx.render(
				<CmsLayout
					title="Settings"
					siteTitle={title}
					userLabel={user ? user.display_name || user.email : ""}
					permissions={permissions}
				>
					<form method="post">
						<label mix={[s.label]} htmlFor="site_title">
							Site title
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="site_title"
							name="site_title"
							defaultValue={title}
						/>
						<label mix={[s.label]} htmlFor="site_description">
							Site description
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="site_description"
							name="site_description"
							defaultValue={description}
						/>
						<label mix={[s.label]} htmlFor="language">
							Language
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="language"
							name="language"
							defaultValue={language}
						/>
						<p>
							<button mix={[s.button]} type="submit">
								Save settings
							</button>
						</p>
					</form>
				</CmsLayout>,
			);
		}),

		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let formData = ctx.formData;
			await Settings.set(db, "site_title", fieldText(formData, "site_title").trim() || "My Blog");
			await Settings.set(db, "site_description", fieldText(formData, "site_description"));
			await Settings.set(db, "language", fieldText(formData, "language", "en").trim() || "en");
			return redirect("/cms/settings", { status: redirect.Status.SeeOther });
		}),
	},
});
