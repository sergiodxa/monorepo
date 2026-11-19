/**
 * Prefetching read from the scene arrays: the files a scene draws and plays, the scenes its jumps
 * reach within a number of jumps, and the `<link>` descriptors a page renders into its head so a
 * reader's first scene arrives decoded and the next ones are already in the HTTP cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AssetDeclaration,
	AssetKind,
	AssetSource,
	CharacterDeclaration,
	SceneDeclaration,
} from "./declarations.js";
import type { Directive } from "./directives.js";
import type { NovelInternals } from "./novel.js";

/** How far {@link reach} walks, and which file of a localized asset it lists. */
export interface ReachOptions {
	/**
	 * How many jumps (`goto` or `call`) away from the starting scene to follow; `0` lists the
	 * starting scene alone.
	 *
	 * @default 1
	 */
	depth?: number;
	/**
	 * The reader's locale. A localized file lists only this locale's URL (falling back to its
	 * language, then to the first the map lists); without it, every locale's URL is listed.
	 */
	locale?: string;
}

/** One file a scene uses. */
export interface SceneAsset {
	/** What the file is: a declared asset's kind, a character image, or a line's voice. */
	kind: AssetKind | "character" | "voice";
	/** The asset's id (`backgrounds.cafe`), `cast.<id>` for a character, `voice:<speaker>:<key>` for a voice. */
	id: string;
	url: string;
}

/** A scene a walk reached, with the files it uses in document order. */
export interface ReachedScene {
	scene: string;
	/** Jumps from the starting scene; `0` for the starting scene itself. */
	depth: number;
	assets: SceneAsset[];
}

/**
 * A `<link>` for a page's head: `preload` for what the starting scene shows, `prefetch` for the
 * rest. Its fields are the element's attributes.
 */
export interface NovelLink {
	rel: "preload" | "prefetch";
	href: string;
	/** `image` for pictures; `fetch` for sounds, which the player decodes from a `fetch()`. */
	as?: "image" | "fetch";
	/** Set on a `fetch` preload, so the player's own `fetch()` reuses the preloaded response. */
	crossorigin?: "anonymous";
}

/** Asset kinds the starting scene preloads as images. */
const IMAGE_KINDS = new Set<SceneAsset["kind"]>(["background", "image", "character"]);

/**
 * Walks the scene graph breadth-first from `scene`, loading each module it reaches (lazy ones
 * are imported, which is the module's prefetch), and lists every file each scene uses. A scene
 * with no module, or one that fails to load, is listed with no files.
 *
 * @param internals - The novel's declarations and loader.
 * @param scene - The starting scene.
 * @param options - The depth and the locale.
 * @returns Every reached scene, nearest first, each listed once at its shortest depth.
 */
export async function reach(
	internals: NovelInternals,
	scene: SceneDeclaration,
	options: ReachOptions = {},
): Promise<ReachedScene[]> {
	let depth = options.depth ?? 1;
	let reached: ReachedScene[] = [];
	let queued = new Set([scene.name]);
	let frontier = [scene.name];
	for (let level = 0; level <= depth && frontier.length > 0; level += 1) {
		let next: string[] = [];
		let loaded = await Promise.all(frontier.map((name) => internals.load(name)));
		for (let [position, name] of frontier.entries()) {
			let index = loaded[position];
			let walk: AssetWalk = { internals, locale: options.locale, assets: [], targets: [] };
			if (index?.status === "success") walkList(index.data.module.directives, walk);
			reached.push({ scene: name, depth: level, assets: unique(walk.assets) });
			for (let target of walk.targets) {
				if (queued.has(target)) continue;
				queued.add(target);
				next.push(target);
			}
		}
		frontier = next;
	}
	return reached;
}

/**
 * Turns reached scenes into `<link>` descriptors. The starting scene's images and sounds are
 * preloaded; its music, ambience and voices, and every file of a farther scene, are prefetched.
 * A URL is listed once, at its first use, which the starting scene always comes before.
 *
 * @param reached - What {@link reach} answered.
 * @returns The descriptors, preloads first.
 */
export function toLinks(reached: readonly ReachedScene[]): NovelLink[] {
	let preloads: NovelLink[] = [];
	let prefetches: NovelLink[] = [];
	let listed = new Set<string>();
	for (let scene of reached) {
		for (let asset of scene.assets) {
			if (listed.has(asset.url)) continue;
			listed.add(asset.url);
			let link = linkFor(asset, scene.depth === 0);
			(link.rel === "preload" ? preloads : prefetches).push(link);
		}
	}
	return [...preloads, ...prefetches];
}

/** The link one file gets, by its kind and whether it belongs to the starting scene. */
function linkFor(asset: SceneAsset, starting: boolean): NovelLink {
	if (starting && IMAGE_KINDS.has(asset.kind)) {
		return { rel: "preload", href: asset.url, as: "image" };
	}
	if (starting && asset.kind === "sound") {
		return { rel: "preload", href: asset.url, as: "fetch", crossorigin: "anonymous" };
	}
	return { rel: "prefetch", href: asset.url };
}

/** What a walk over one scene collects. */
interface AssetWalk {
	internals: NovelInternals;
	locale: string | undefined;
	assets: SceneAsset[];
	/** The scenes this one jumps to or calls, in document order. */
	targets: string[];
}

/** Collects the files and jumps of one list of directives and of every branch nested in it. */
function walkList(list: readonly Directive[], walk: AssetWalk): void {
	for (let directive of list) {
		switch (directive.type) {
			case "show":
			case "hide":
			case "play":
				declared(walk, directive.asset);
				break;
			case "enter":
			case "express":
				character(walk, directive.character, directive);
				break;
			case "say":
				voice(walk, directive.speakers[0], directive.key);
				break;
			case "choose":
				for (let option of directive.options) walkList(option.do, walk);
				break;
			case "when":
				walkList(directive.do, walk);
				walkList(directive.otherwise, walk);
				break;
			case "goto":
			case "call":
				walk.targets.push(directive.scene.name);
				break;
			default:
				break;
		}
	}
}

/** Lists a declared asset's file, read from the novel's declarations when it has them. */
function declared(walk: AssetWalk, asset: AssetDeclaration): void {
	let current = walk.internals.assets.get(asset.id) ?? asset;
	push(walk, current.kind, current.id, current.src);
}

/**
 * Lists the image a character enters or changes to: the named sprite (the first one when
 * entering without a name), or the named variant of every layer the directive sets.
 */
function character(
	walk: AssetWalk,
	declaration: CharacterDeclaration,
	directive: { type: "enter" | "express"; expression?: string; layers?: Record<string, string> },
): void {
	let current = walk.internals.characters.get(declaration.id) ?? declaration;
	let id = `cast.${current.id}`;
	if (current.image.kind === "sprites") {
		let sprites = current.image.sprites;
		let name =
			directive.expression ?? (directive.type === "enter" ? Object.keys(sprites)[0] : undefined);
		let source = name === undefined ? undefined : sprites[name];
		if (source !== undefined) push(walk, "character", id, source);
		return;
	}
	if (current.image.kind !== "layers") return;
	for (let [layer, variant] of Object.entries(directive.layers ?? {})) {
		let source = current.image.layers[layer]?.[variant];
		if (source !== undefined) push(walk, "character", id, source);
	}
}

/** Lists a spoken line's voice, which the novel's `voice` option finds. */
function voice(walk: AssetWalk, speaker: CharacterDeclaration | undefined, key: string): void {
	if (speaker === undefined) return;
	let source = walk.internals.voice(speaker.id, key);
	if (source !== null) push(walk, "voice", `voice:${speaker.id}:${key}`, source);
}

/** Lists a file's URLs, all of a locale map's or the reader's one, leaving out inlined files. */
function push(walk: AssetWalk, kind: SceneAsset["kind"], id: string, source: AssetSource): void {
	for (let url of urlsOf(source, walk.locale)) {
		if (url === "" || url.startsWith("data:") || url.startsWith("blob:")) continue;
		walk.assets.push({ kind, id, url });
	}
}

/**
 * The URLs of a file: the one URL, the locale's from a map (then its language's, then the
 * first), or every locale's when no locale is given.
 *
 * @param source - A URL or a map of locale to URL.
 * @param locale - The reader's locale, when known.
 * @returns The URLs to fetch.
 */
export function urlsOf(source: AssetSource, locale?: string): string[] {
	if (typeof source === "string") return [source];
	if (locale === undefined) return Object.values(source);
	let language = locale.split("-")[0] ?? locale;
	let picked = source[locale] ?? source[language] ?? Object.values(source)[0];
	return picked === undefined ? [] : [picked];
}

/** Drops repeated URLs, keeping each file's first use. */
function unique(assets: SceneAsset[]): SceneAsset[] {
	let seen = new Set<string>();
	return assets.filter((asset) => {
		if (seen.has(asset.url)) return false;
		seen.add(asset.url);
		return true;
	});
}
