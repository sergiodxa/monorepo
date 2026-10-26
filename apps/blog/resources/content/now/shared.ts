/**
 * The parts of the now page that read the same in every language: the day it was last
 * rewritten and where each item links, so both translations always agree on when and where.
 * Each language's page adds its own words around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The day the page was last rewritten; update it with every edit to either language. */
export const NOW_UPDATED_AT = "2026-10-26";

/** Where each item on the page links. */
export const NOW_LINKS = {
	daffy: "https://www.daffy.org",
	monorepo: "https://github.com/sergiodxa/monorepo",
	packages: "https://sdxc.dev",
	encore: "/apps/encore/support",
	remixWay: "/articles/the-remix-way",
	tutorials: "/tutorials",
	remixAuth: "https://github.com/sergiodxa/remix-auth",
	remix: "https://github.com/remix-run/remix",
	nownownow: "https://nownownow.com/about",
} as const;
