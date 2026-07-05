import type { RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";

import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { renderDocument } from "../../../shared/lib/render";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { DEFAULT_THEME, resolveTheme, type ThemeSettings } from "../../../theme/theme";
import { CmsLayout } from "../../../views/cms-layout";

function selectField(name: string, value: string, options: string[]): RemixNode {
	return (
		<>
			<label htmlFor={name}>{name}</label>
			<select id={name} name={name} defaultValue={value}>
				{options.map((option) => (
					<option value={option} key={option}>
						{option}
					</option>
				))}
			</select>
		</>
	);
}

/** GET /cms/appearance — theme knobs + custom CSS form. */
export const index = action<"GET", "/cms/appearance">(async ({ db }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	if (!user || !permissions.has("appearance.manage")) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

	let [stored, customCss, siteTitle] = await Promise.all([
		Settings.theme(db),
		Settings.customCss(db),
		Settings.siteTitle(db),
	]);
	let theme = resolveTheme(stored);

	let body = await renderDocument(
		<CmsLayout
			title="Appearance"
			siteTitle={siteTitle}
			userLabel={user.display_name || user.email}
			permissions={permissions}
		>
			<form method="post">
				<label htmlFor="accent">Accent color</label>
				<input type="color" id="accent" name="accent" defaultValue={theme.accent} />
				<label htmlFor="background">Background color</label>
				<input type="color" id="background" name="background" defaultValue={theme.background} />
				<label htmlFor="foreground">Text color</label>
				<input type="color" id="foreground" name="foreground" defaultValue={theme.foreground} />
				{selectField("radius", theme.radius, ["square", "soft", "rounded", "round"])}
				{selectField("spacing", theme.spacing, ["compact", "comfortable", "spacious"])}
				{selectField("fontHeading", theme.fontHeading, ["sans", "serif", "mono", "slab"])}
				{selectField("fontBody", theme.fontBody, ["sans", "serif", "mono", "slab"])}
				{selectField("fontSize", theme.fontSize, ["small", "medium", "large"])}
				<label htmlFor="measure">Content width</label>
				<input type="text" id="measure" name="measure" defaultValue={theme.measure} />
				<label htmlFor="custom_css">Custom CSS</label>
				<textarea id="custom_css" name="custom_css" defaultValue={customCss} />
				<p class="help">Custom CSS is emitted last so it overrides the theme.</p>
				<p>
					<button type="submit">Save appearance</button>
				</p>
			</form>
		</CmsLayout>,
	);
	return ok(body);
});

/** POST /cms/appearance — persists theme + custom CSS. */
export const action_ = action<"POST", "/cms/appearance">(async ({ db, formData }) => {
	let user = await getAuthUser();
	let permissions = await getPermissions();
	if (!user || !permissions.has("appearance.manage")) {
		return redirect("/cms", { status: redirect.Status.SeeOther });
	}

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
});
