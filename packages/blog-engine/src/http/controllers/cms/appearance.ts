import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";

import { Settings } from "../../../domain/settings";
import action from "../../../shared/lib/action";
import { getAuthUser, getPermissions } from "../../../shared/middleware/auth";
import { DEFAULT_THEME, resolveTheme, type ThemeSettings } from "../../../theme/theme";
import { cmsLayout } from "../../../views/cms-layout";
import { attr } from "../../../views/html";

function select(name: string, value: string, options: string[]): string {
	let opts = options
		.map(
			(option) =>
				`<option value="${attr(option)}"${option === value ? " selected" : ""}>${option}</option>`,
		)
		.join("");
	return `<label for="${attr(name)}">${name}</label><select id="${attr(name)}" name="${attr(name)}">${opts}</select>`;
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

	let body =
		`<form method="post">` +
		`<label for="accent">Accent color</label><input type="color" id="accent" name="accent" value="${attr(theme.accent)}">` +
		`<label for="background">Background color</label><input type="color" id="background" name="background" value="${attr(theme.background)}">` +
		`<label for="foreground">Text color</label><input type="color" id="foreground" name="foreground" value="${attr(theme.foreground)}">` +
		select("radius", theme.radius, ["square", "soft", "rounded", "round"]) +
		select("spacing", theme.spacing, ["compact", "comfortable", "spacious"]) +
		select("fontHeading", theme.fontHeading, ["sans", "serif", "mono", "slab"]) +
		select("fontBody", theme.fontBody, ["sans", "serif", "mono", "slab"]) +
		select("fontSize", theme.fontSize, ["small", "medium", "large"]) +
		`<label for="measure">Content width</label><input type="text" id="measure" name="measure" value="${attr(theme.measure)}">` +
		`<label for="custom_css">Custom CSS</label><textarea id="custom_css" name="custom_css">${attr(customCss)}</textarea>` +
		`<p class="help">Custom CSS is emitted last so it overrides the theme.</p>` +
		`<p><button type="submit">Save appearance</button></p></form>`;

	return ok(
		cmsLayout({
			title: "Appearance",
			siteTitle,
			userLabel: user.display_name || user.email,
			permissions,
			body,
		}),
	);
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
