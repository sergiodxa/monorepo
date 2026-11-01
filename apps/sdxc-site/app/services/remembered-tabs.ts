/**
 * The code-tab choices this site remembers between pages — the package manager today —
 * and the reading of them from a request's cookies. A choice is one cookie per sync key,
 * which the browser writes and the server renders the page from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InstallCommand } from "@sdxc/ui/docs";

import { readCodeTabsCookie } from "@sdxc/ui/docs";

/** The sync key every install line and package-manager strip on the site shares. */
export const PACKAGE_MANAGER_KEY = "package-manager";

/** The managers an install line offers, in the order its strip reads; the first is the default. */
export const PACKAGE_MANAGERS: readonly InstallCommand.Manager[] = ["npm", "pnpm", "yarn", "bun"];

/** Every sync key a `code-tabs` tag may name. A tag naming one outside this list is a parse error. */
export const REMEMBERED_TAB_KEYS = [PACKAGE_MANAGER_KEY] as const;

/** One sync key from {@link REMEMBERED_TAB_KEYS}. */
export type RememberedTabKey = (typeof REMEMBERED_TAB_KEYS)[number];

/**
 * What each remembered strip is called for assistive technology, and the values it
 * offers. A cookie naming a value outside the list reads as no choice at all.
 */
export const REMEMBERED_TABS: Record<
	RememberedTabKey,
	{ label: string; values: readonly string[] }
> = { [PACKAGE_MANAGER_KEY]: { label: "Package manager", values: PACKAGE_MANAGERS } };

/**
 * The tab the reader last picked for `key`, read from the request's cookies.
 *
 * @param cookie - The request's `Cookie` header, or nothing when none was sent.
 * @param key - The sync key the strips share.
 * @returns The chosen value, or `undefined` when the reader has chosen nothing this site offers.
 * @example rememberedTab("ui-code-tabs.package-manager=bun", "package-manager") // "bun"
 */
export function rememberedTab(
	cookie: string | null | undefined,
	key: RememberedTabKey,
): string | undefined {
	let value = readCodeTabsCookie(cookie, key);
	return value !== undefined && REMEMBERED_TABS[key].values.includes(value) ? value : undefined;
}

/**
 * Every remembered choice a request carries, as one string a cache key can include. A
 * reader who has chosen nothing gets the empty string, which is what marks a page every
 * reader is served the same way.
 *
 * @param cookie - The request's `Cookie` header.
 * @returns Such as `package-manager:bun`, or `""`.
 */
export function rememberedTabsVariant(cookie: string | null | undefined): string {
	return REMEMBERED_TAB_KEYS.flatMap((key) => {
		let value = rememberedTab(cookie, key);
		return value === undefined ? [] : [`${key}:${value}`];
	}).join("|");
}
