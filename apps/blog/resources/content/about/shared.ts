/**
 * The parts of the about page that read the same in every language: the photo files, the
 * project and profile URLs, and the figures the stats state. Each language's page adds its
 * own words around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PROFILE } from "~/config/profile";
import { PHOTOS, PROFILE_LINKS, PROJECT_LINKS } from "~/resources/content/press/shared";

export { PHOTOS, PROFILE_LINKS };

/** Where each project the page lists lives, the press kit's links included. */
export const PROJECTS = {
	...PROJECT_LINKS,
	remixI18next: "https://github.com/sergiodxa/remix-i18next",
	remixHono: "https://github.com/sergiodxa/remix-hono",
	packages: "https://sdxc.dev",
} as const;

/** The ways to reach the author that the page links to. */
export const CONTACT = {
	email: `mailto:${PROFILE.email}`,
	sponsor: PROFILE.github.sponsor,
} as const;

/**
 * The figures behind the stats, measured in October 2026: articles plus tutorials on this
 * site, and the npm downloads Remix Utils and Remix Auth had together in that month.
 */
export const FIGURES = {
	firstPage: "2002",
	posts: "300+",
	downloads: "2M+",
	years: "10+",
} as const;
