/**
 * The registry of post kinds: each kind's stored type, the names `kind:` reads, its topic and
 * address, its index emoji and labels, and what it federates as. Search, the Activity list,
 * feeds, federation and the public post page read this one list, so a kind is added once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@sdxc/u";

import type { SelectPost } from "~/database/schema";

/**
 * Type contracts for the registry. Type-only, so the runtime values stay on
 * {@link POST_KINDS} and the functions beside it.
 */
export namespace PostKind {
	/** Everything the app knows about one kind of post. */
	export interface Definition {
		/** The `posts.type` a post of this kind is stored as. */
		type: SelectPost["type"];
		/** Every name `kind:` reads as this kind, compared without case; the kind's own first. */
		names: ReadonlyArray<string>;
		/**
		 * The slug of the kind's topic: its listing page and feeds live at `/<topic>`, and its
		 * permalinks and search results under `/<topic>/`.
		 */
		topic: string;
		/**
		 * Where one post is read: `"page"` on the public post page at `/<topic>/<slug>`,
		 * `"entry"` as an entry of the topic page, `"external"` on the page a bookmark saved.
		 */
		permalink: "page" | "entry" | "external";
		/** The kind's resource in the CMS routes, which the CMS navigation links to. */
		cms: string;
		/** The emoji a row of this kind leads with in the index, search and share text. */
		icon: string;
		/** The tone the row's emoji is tinted with. */
		tint: ColorValue;
		/** What one post of this kind is called, naming its emoji for assistive technology. */
		label: string;
		/** What the kind's posts are called together, as its search tab and listing name them. */
		plural: string;
		/** The ActivityPub object type the kind federates as, or `null` for a kind kept local. */
		objectType: string | null;
	}
}

/**
 * Every post kind, in the order search tabs and counts list them. A new kind is one entry
 * here; code that renders or reads each kind differently names it where it differs.
 */
export const POST_KINDS = {
	article: {
		type: "article",
		names: ["article", "articles"],
		topic: "articles",
		permalink: "page",
		cms: "articles",
		icon: "📝",
		tint: "brand.emphasis",
		label: "Article",
		plural: "Articles",
		objectType: "Article",
	},
	tutorial: {
		type: "tutorial",
		names: ["tutorial", "tutorials"],
		topic: "tutorials",
		permalink: "page",
		cms: "tutorials",
		icon: "🛠️",
		tint: "brand",
		label: "Tutorial",
		plural: "Tutorials",
		objectType: "Article",
	},
	glossary: {
		type: "glossary",
		names: ["glossary", "glossaries"],
		topic: "glossary",
		permalink: "entry",
		cms: "glossary",
		icon: "📘",
		tint: "neutral",
		label: "Glossary",
		plural: "Glossary",
		objectType: null,
	},
	bookmark: {
		type: "like",
		names: ["bookmark", "bookmarks", "like", "likes"],
		topic: "bookmarks",
		permalink: "external",
		cms: "bookmarks",
		icon: "🔖",
		tint: "neutral.emphasis",
		label: "Bookmark",
		plural: "Bookmarks",
		objectType: null,
	},
	release: {
		type: "release",
		names: ["release", "releases"],
		topic: "releases",
		permalink: "page",
		cms: "releases",
		icon: "📦",
		tint: "success",
		label: "Release",
		plural: "Releases",
		objectType: "Note",
	},
	note: {
		type: "note",
		names: ["note", "notes"],
		topic: "notes",
		permalink: "page",
		cms: "notes",
		icon: "💬",
		tint: "brand",
		label: "Note",
		plural: "Notes",
		objectType: "Note",
	},
	til: {
		type: "til",
		names: ["til", "tils"],
		topic: "til",
		permalink: "page",
		cms: "tils",
		icon: "💡",
		tint: "warning",
		label: "TIL",
		plural: "TILs",
		objectType: "Note",
	},
} as const satisfies Record<string, PostKind.Definition>;

/** The registry's literal type, which keeps each entry's values narrow. */
type Registry = typeof POST_KINDS;

/** A kind of post, as search, the index and feeds name it. */
export type Kind = keyof Registry;

/** The kinds the public post page serves. */
export type PageKind = { [K in Kind]: Registry[K]["permalink"] extends "page" ? K : never }[Kind];

/** The first segment of a public post page's URL, which is its kind's topic. */
export type PublicTypePath = Registry[PageKind]["topic"];

/** Every kind, in registry order, typed non-empty as `enum_` schemas need it. */
export const KINDS = registryOrder();

/**
 * The registry's keys as a non-empty list. The registry is a literal with entries, so the
 * first key always exists and `article` only satisfies the type.
 */
function registryOrder(): readonly [Kind, ...Array<Kind>] {
	let [first = "article", ...rest] = Object.keys(POST_KINDS).filter(isKind);
	return [first, ...rest];
}

/** Whether a string is a registry key, which narrows `Object.keys` back to {@link Kind}. */
function isKind(value: string): value is Kind {
	return Object.hasOwn(POST_KINDS, value);
}

/** Whether the public post page serves a kind's posts. */
function isPageKind(kind: Kind): kind is PageKind {
	return POST_KINDS[kind].permalink === "page";
}

/** The topics the public post page answers under, in registry order. */
export const PUBLIC_TYPE_PATHS: ReadonlyArray<PublicTypePath> = KINDS.filter(isPageKind).map(
	(kind) => POST_KINDS[kind].topic,
);

/** The stored `posts.type` of every kind with a public post page, which sends and federates. */
export const PUBLIC_POST_TYPES: ReadonlyArray<SelectPost["type"]> = KINDS.filter(isPageKind).map(
	(kind) => POST_KINDS[kind].type,
);

/**
 * The kind a stored `posts.type` is, or `null` for a type no kind lists, such as `comment`.
 *
 * @param type A `posts.type` value.
 */
export function kindOfType(type: string): Kind | null {
	return KINDS.find((kind) => POST_KINDS[kind].type === type) ?? null;
}

/**
 * The kind a `kind:` value names, compared without case or surrounding space, or `null` for
 * a name no kind accepts.
 *
 * @param name What followed `kind:`.
 */
export function kindNamed(name: string): Kind | null {
	let wanted = name.trim().toLowerCase();
	return KINDS.find((kind) => POST_KINDS[kind].names.some((alias) => alias === wanted)) ?? null;
}

/**
 * Whether a URL segment is a topic the public post page answers under, narrowing it so a
 * route param or a parsed permalink can be passed on as one.
 */
export function isPublicTypePath(value: string | undefined): value is PublicTypePath {
	return PUBLIC_TYPE_PATHS.some((path) => path === value);
}

/**
 * The topic a stored post's public page lives under, or `null` for a type the public post
 * page does not serve.
 *
 * @param type A `posts.type` value.
 */
export function publicTypePathOf(type: string): PublicTypePath | null {
	let kind = kindOfType(type);
	return kind !== null && isPageKind(kind) ? POST_KINDS[kind].topic : null;
}

/**
 * The kind whose public post pages live under a topic. Every public topic belongs to a page
 * kind, so `article` only satisfies the type.
 *
 * @param path The topic a post page's URL starts with.
 */
export function kindAt(path: PublicTypePath): PageKind {
	return KINDS.filter(isPageKind).find((kind) => POST_KINDS[kind].topic === path) ?? "article";
}

/**
 * The ActivityPub object type a public post page's post federates as.
 *
 * @param path The topic the post's page lives under.
 */
export function objectTypeAt(path: PublicTypePath): Registry[PageKind]["objectType"] {
	return POST_KINDS[kindAt(path)].objectType;
}
