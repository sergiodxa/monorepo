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

/** Loads the shared public-site chrome (title, theme, nav) for one request. */
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
