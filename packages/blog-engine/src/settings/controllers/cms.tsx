/**
 * The site settings controller at `/cms/settings`: edit the site title, description,
 * language, and the WebSub hub the feeds advertise. Gated by `settings.manage`; values are persisted through the
 * {@link Settings} model with sensible fallbacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/html";
import { createController } from "remix/router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth.js";
import { requirePermission } from "../../auth/middleware/require-permission.js";
import routes from "../../routes.js";
import { CmsLayout } from "../../shared/components/cms-layout.js";
import * as s from "../../shared/components/styles.js";
import { fieldText } from "../../shared/text.js";
import { Settings } from "../models/settings.js";

/**
 * Reads the hub field: blank chooses no hub, anything else must be an absolute `https:` URL,
 * since subscribers refuse a plaintext hub.
 * @param value - The submitted field.
 * @returns The hub to store (`""` for none), or `null` when the value is not usable.
 */
function readHub(value: string): string | null {
	let hub = value.trim();
	if (hub === "") return "";
	if (!URL.canParse(hub) || new URL(hub).protocol !== "https:") return null;
	return new URL(hub).toString();
}

/** `/cms/settings` — site title/description/language/hub (gated by `settings.manage`). */
export default createController(routes.cms.settings, {
	middleware: [requirePermission("settings.manage")],
	actions: {
		index: async (ctx) => {
			let user = getAuthUser();
			let permissions = await getPermissions();
			let [title, description, language, hub] = await Promise.all([
				Settings.siteTitle(ctx.db),
				Settings.siteDescription(ctx.db),
				Settings.language(ctx.db),
				Settings.websubHub(ctx.db),
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
						<label mix={[s.label]} htmlFor="websub_hub">
							WebSub hub
						</label>
						<input
							mix={[s.control]}
							type="url"
							id="websub_hub"
							name="websub_hub"
							placeholder="https://pubsubhubbub.appspot.com/"
							defaultValue={hub ?? ""}
						/>
						<p mix={[s.help]}>
							Feed readers subscribed through this hub receive new posts as you publish them. Leave
							blank to use none.
						</p>
						<p>
							<button mix={[s.button]} type="submit">
								Save settings
							</button>
						</p>
					</form>
				</CmsLayout>,
			);
		},

		action: async (ctx) => {
			let formData = ctx.formData;
			let hub = readHub(fieldText(formData, "websub_hub"));
			if (hub === null) return badRequest("The WebSub hub must be an https:// URL.");
			await Settings.set(
				ctx.db,
				"site_title",
				fieldText(formData, "site_title").trim() || "My Blog",
			);
			await Settings.set(ctx.db, "site_description", fieldText(formData, "site_description"));
			await Settings.set(ctx.db, "language", fieldText(formData, "language", "en").trim() || "en");
			await Settings.set(ctx.db, "websub_hub", hub);
			return redirect("/cms/settings", { status: redirect.Status.SeeOther });
		},
	},
});
