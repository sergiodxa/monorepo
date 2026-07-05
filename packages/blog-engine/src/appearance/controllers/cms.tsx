import type { RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser, getPermissions } from "../../auth/middleware/auth";
import { requirePermission } from "../../auth/middleware/require-permission";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { CmsLayout } from "../../shared/components/cms-layout";
import * as s from "../../shared/components/styles";
import { DEFAULT_THEME, resolveTheme, type ThemeSettings } from "../theme/theme";

function selectField(name: string, value: string, options: string[]): RemixNode {
	return (
		<>
			<label mix={[s.label]} htmlFor={name}>
				{name}
			</label>
			<select mix={[s.selectControl]} id={name} name={name} defaultValue={value}>
				{options.map((option) => (
					<option value={option} key={option}>
						{option}
					</option>
				))}
			</select>
		</>
	);
}

/** `/cms/appearance` — theme knobs + custom CSS (gated by `appearance.manage`). */
export default createController(routes.cms.appearance, {
	middleware: [requirePermission("appearance.manage")],
	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let permissions = await getPermissions();
			let [stored, customCss, siteTitle] = await Promise.all([
				Settings.theme(db),
				Settings.customCss(db),
				Settings.siteTitle(db),
			]);
			let theme = resolveTheme(stored);

			return ctx.render(
				<CmsLayout
					title="Appearance"
					siteTitle={siteTitle}
					userLabel={user ? user.display_name || user.email : ""}
					permissions={permissions}
				>
					<form method="post">
						<label mix={[s.label]} htmlFor="accent">
							Accent color
						</label>
						<input
							mix={[s.control]}
							type="color"
							id="accent"
							name="accent"
							defaultValue={theme.accent}
						/>
						<label mix={[s.label]} htmlFor="background">
							Background color
						</label>
						<input
							mix={[s.control]}
							type="color"
							id="background"
							name="background"
							defaultValue={theme.background}
						/>
						<label mix={[s.label]} htmlFor="foreground">
							Text color
						</label>
						<input
							mix={[s.control]}
							type="color"
							id="foreground"
							name="foreground"
							defaultValue={theme.foreground}
						/>
						{selectField("radius", theme.radius, ["square", "soft", "rounded", "round"])}
						{selectField("spacing", theme.spacing, ["compact", "comfortable", "spacious"])}
						{selectField("fontHeading", theme.fontHeading, ["sans", "serif", "mono", "slab"])}
						{selectField("fontBody", theme.fontBody, ["sans", "serif", "mono", "slab"])}
						{selectField("fontSize", theme.fontSize, ["small", "medium", "large"])}
						<label mix={[s.label]} htmlFor="measure">
							Content width
						</label>
						<input
							mix={[s.control]}
							type="text"
							id="measure"
							name="measure"
							defaultValue={theme.measure}
						/>
						<label mix={[s.label]} htmlFor="custom_css">
							Custom CSS
						</label>
						<textarea
							mix={[s.textarea]}
							id="custom_css"
							name="custom_css"
							defaultValue={customCss}
						/>
						<p mix={[s.help]}>Custom CSS is emitted last so it overrides the theme.</p>
						<p>
							<button mix={[s.button]} type="submit">
								Save appearance
							</button>
						</p>
					</form>
				</CmsLayout>,
			);
		}),

		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let formData = ctx.formData;
			let get = (key: string, fallback: string) =>
				String(formData.get(key) ?? fallback).trim() || fallback;
			let theme: ThemeSettings = {
				accent: get("accent", DEFAULT_THEME.accent),
				background: get("background", DEFAULT_THEME.background),
				foreground: get("foreground", DEFAULT_THEME.foreground),
				radius: get("radius", DEFAULT_THEME.radius) as ThemeSettings["radius"],
				spacing: get("spacing", DEFAULT_THEME.spacing) as ThemeSettings["spacing"],
				fontHeading: get("fontHeading", DEFAULT_THEME.fontHeading) as ThemeSettings["fontHeading"],
				fontBody: get("fontBody", DEFAULT_THEME.fontBody) as ThemeSettings["fontBody"],
				fontSize: get("fontSize", DEFAULT_THEME.fontSize) as ThemeSettings["fontSize"],
				measure: get("measure", DEFAULT_THEME.measure),
			};

			await Settings.set(db, "theme", theme);
			await Settings.set(
				db,
				"custom_css",
				String(formData.get("custom_css") ?? "").slice(0, 32 * 1024),
			);
			return redirect("/cms/appearance", { status: redirect.Status.SeeOther });
		}),
	},
});
