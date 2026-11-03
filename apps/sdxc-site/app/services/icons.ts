/**
 * The `@sdxc/icons` catalogue as the site's icon pages read it: every icon with its
 * component name and Lucide's search tags, the filter the gallery applies, and the
 * addresses an icon is drawn from and credited to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IconName } from "@sdxc/icons";

import { iconExportNames, LUCIDE_VERSION } from "@sdxc/icons";
import { iconTags } from "@sdxc/icons/tags";

import routes from "~/routes/web";

/** Where each icon is published by the people who draw it. */
const LUCIDE_ICONS_URL = "https://lucide.dev/icons/";

/** Lucide's own pages a credit links to. */
export const LUCIDE_LINKS = {
	home: "https://lucide.dev",
	docs: "https://lucide.dev/guide/",
	license: "https://lucide.dev/license",
	sponsor: "https://lucide.dev/sponsor",
} as const;

/** One icon as the gallery and its page show it. */
export interface IconEntry {
	/** Lucide's kebab-case name, which is also the `name` `<Icon />` takes. */
	name: IconName;
	/** The export that renders it, `heart` → `HeartIcon`. */
	component: string;
	/** The words Lucide's catalogue matches it by. */
	tags: readonly string[];
}

/** Every icon in the package, alphabetical by name, as `iconExportNames` orders them. */
export function listIcons(): IconEntry[] {
	return (Object.keys(iconExportNames) as IconName[]).map(toEntry);
}

/** The icon called `name`, or `null` for a name the package has no icon for. */
export function findIcon(name: string): IconEntry | null {
	if (!Object.hasOwn(iconExportNames, name)) return null;
	return toEntry(name as IconName);
}

/**
 * The icons matching a reader's query. Every word must appear in the icon's name or in one
 * of its tags, so `arrow up` narrows rather than widens; a blank query matches every icon.
 */
export function filterIcons(icons: IconEntry[], query: string): IconEntry[] {
	let words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return icons;
	return icons.filter((icon) => {
		let haystack = [icon.name, icon.name.replaceAll("-", " "), ...icon.tags];
		return words.every((word) => haystack.some((field) => field.includes(word)));
	});
}

/**
 * The sprite's address for the icons this build ships. The version changes whenever the
 * drawings do, which is what lets the sprite be cached forever under each address.
 */
export function spriteHref(): string {
	return `${routes.api.iconSprite.href()}?v=${encodeURIComponent(LUCIDE_VERSION)}`;
}

/** The icon's own page on lucide.dev, where every credit for it points. */
export function lucideIconHref(name: IconName): string {
	return `${LUCIDE_ICONS_URL}${name}`;
}

/** The entry for one name, with the export name `@sdxc/icons` gives its component. */
function toEntry(name: IconName): IconEntry {
	return { name, component: componentName(name), tags: iconTags[name] };
}

/** `circle-alert` → `CircleAlertIcon`, the rule every export in the package follows. */
function componentName(name: string): string {
	let pascal = name
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
	return `${pascal}Icon`;
}
