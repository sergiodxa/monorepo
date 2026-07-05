/**
 * Loads the shared public-site chrome for one request — site title, description,
 * theme style block, custom CSS, and the nav derived from visible post types — so
 * every public view renders a consistent header, theme, and navigation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database } from "remix/data-table";

import { renderThemeStyle } from "../appearance/theme/theme";
import { PostType } from "../post-types/models/post-type";
import { Settings } from "../settings/models/settings";

import type { NavLink } from "./components/layout";

/** Per-request site chrome derived from settings + visible post types. */
export interface SiteChrome {
	siteTitle: string;
	description: string;
	themeStyle: string;
	customCss: string;
	navLinks: NavLink[];
}

/**
 * Loads the shared public-site chrome (title, theme, nav) for one request, resolving
 * settings and visible post types in parallel.
 * @param db - Database handle.
 * @returns The site chrome to spread into the public {@link Layout}.
 */
export async function loadSiteChrome(db: Database): Promise<SiteChrome> {
	let [siteTitle, description, theme, customCss, types] = await Promise.all([
		Settings.siteTitle(db),
		Settings.siteDescription(db),
		Settings.theme(db),
		Settings.customCss(db),
		PostType.findVisible(db),
	]);

	return {
		siteTitle,
		description,
		themeStyle: renderThemeStyle(theme),
		customCss,
		navLinks: types.map((type) => ({ href: `/${type.path}`, label: type.label })),
	};
}
