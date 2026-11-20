/**
 * The novel's declarations: `scenes` with their chapters, the `cast`, the `assets` scenes draw
 * on, and the app-rendered `interactions`. They hold data and types alone, so a page, a test or
 * a check imports them without loading a single scene module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { LineKey } from "./types.js";

/** Brands what `scene()` returns until `scenes()` names it. */
const SCENE_LEAF = Symbol.for("@sdxc/novel.scene-leaf");

/** Brands what `chapter()` returns until `scenes()` names it. */
const CHAPTER_LEAF = Symbol.for("@sdxc/novel.chapter-leaf");

/** Brands a named scene, so a map walk tells it from a group of scenes. */
const SCENE = Symbol.for("@sdxc/novel.scene");

/** Brands a chapter's group with the chapter it is. */
const CHAPTER = Symbol.for("@sdxc/novel.chapter");

/** Brands a named character. */
const CHARACTER = Symbol.for("@sdxc/novel.character");

/** Brands a named asset. */
const ASSET = Symbol.for("@sdxc/novel.asset");

/** Brands a named interaction. */
const INTERACTION = Symbol.for("@sdxc/novel.interaction");

/**
 * One media file, or a map of locale to file for media with text in it. A string is a URL to
 * load (a bundler's content-hashed URL, or a `data:` URL); a Blob is a file the page already holds,
 * such as audio or an image generated in the browser, played or drawn without a fetch.
 */
export type AssetSource = string | Blob | Readonly<Record<string, string | Blob>>;

/** A scene as `scene()` declares it, before `scenes()` names it. */
export interface SceneLeaf {
	readonly [SCENE_LEAF]: true;
	readonly title?: string;
}

/**
 * A chapter as `chapter()` declares it, before `scenes()` names it.
 *
 * @template Tree - The scenes the chapter groups.
 */
export interface ChapterLeaf<Tree extends SceneTree = SceneTree> {
	readonly [CHAPTER_LEAF]: true;
	readonly title?: string;
	readonly scenes: Tree;
}

/** The tree `scenes()` takes: scenes, chapters and groups of scenes, nested to any depth. */
export interface SceneTree {
	readonly [key: string]: SceneLeaf | ChapterLeaf | SceneTree;
}

/** A chapter as its scenes carry it: its name and its title's message key. */
export interface ChapterInfo {
	readonly name: string;
	readonly title?: string;
}

/**
 * A declared scene. Its name is its dotted path (`spring.cafe.meeting`), which saves and the
 * seen-line record are keyed by, so renaming a scene breaks the saves that stand in it.
 *
 * @template Name - The scene's dotted path.
 */
export interface SceneDeclaration<Name extends string = string> {
	readonly [SCENE]: true;
	readonly name: Name;
	/** The title's message key, which save slots and the chapter select show. */
	readonly title?: string;
	/** The chapter the scene belongs to, when it was declared inside one. */
	readonly chapter?: ChapterInfo;
}

/** A chapter's group of scenes, branded with the chapter for a chapter select to read. */
export interface ChapterMarker {
	readonly [CHAPTER]: ChapterInfo;
}

/**
 * The map `scenes()` returns: every leaf named by its path, every chapter a group branded with
 * its title.
 *
 * @template Tree - The tree the map was built from.
 * @template Prefix - The path of the group being mapped, with its trailing dot.
 */
export type SceneMap<Tree, Prefix extends string = ""> = {
	readonly [Key in keyof Tree & string]: Tree[Key] extends SceneLeaf
		? SceneDeclaration<`${Prefix}${Key}`>
		: Tree[Key] extends ChapterLeaf<infer Scenes>
			? SceneMap<Scenes, `${Prefix}${Key}.`> & ChapterMarker
			: SceneMap<Tree[Key], `${Prefix}${Key}.`>;
};

/**
 * Declares one scene. Its title is optional; a scene without one is a beat no menu lists.
 *
 * @param options - The title's message key.
 * @returns A leaf for {@link scenes} to name.
 * @example scene({ title: "scenes.opening" })
 */
export function scene(options: { title?: LineKey } = {}): SceneLeaf {
	return options.title === undefined
		? { [SCENE_LEAF]: true }
		: { [SCENE_LEAF]: true, title: options.title };
}

/**
 * Groups scenes into a chapter, which a chapter select lists by its title. The chapter's key
 * is part of every scene name under it.
 *
 * @param options - The title's message key and the chapter's scenes.
 * @returns A leaf for {@link scenes} to name.
 * @example chapter({ title: "chapters.prologue", scenes: { opening: scene() } })
 */
export function chapter<const Tree extends SceneTree>(options: {
	title?: LineKey;
	scenes: Tree;
}): ChapterLeaf<Tree> {
	return options.title === undefined
		? { [CHAPTER_LEAF]: true, scenes: options.scenes }
		: { [CHAPTER_LEAF]: true, title: options.title, scenes: options.scenes };
}

/**
 * Names every scene in `tree` by its path, so `scenes({ spring: { cafe: scene() } })` declares
 * `spring.cafe`.
 *
 * @param tree - The scenes, chapters and groups of the novel.
 * @returns The same tree with every leaf turned into its named declaration.
 * @example export default scenes({ prologue: chapter({ scenes: { opening: scene() } }) });
 */
export function scenes<const Tree extends SceneTree>(tree: Tree): SceneMap<Tree> {
	return buildScenes(tree, "", undefined) as SceneMap<Tree>;
}

/** Walks one level of the scene tree, naming each scene and carrying its chapter down. */
function buildScenes(
	tree: SceneTree,
	prefix: string,
	info: ChapterInfo | undefined,
): Record<string | symbol, unknown> {
	let map: Record<string | symbol, unknown> = {};
	for (let [key, value] of Object.entries(tree)) {
		let name = `${prefix}${key}`;
		if (SCENE_LEAF in value) {
			map[key] = declareScene(name, value as SceneLeaf, info);
		} else if (CHAPTER_LEAF in value) {
			let leaf = value as ChapterLeaf;
			let chapterInfo: ChapterInfo =
				leaf.title === undefined ? { name } : { name, title: leaf.title };
			map[key] = { ...buildScenes(leaf.scenes, `${name}.`, chapterInfo), [CHAPTER]: chapterInfo };
		} else {
			map[key] = buildScenes(value as SceneTree, `${name}.`, info);
		}
	}
	return map;
}

/** The declaration of one scene under the name its path spells. */
function declareScene(
	name: string,
	leaf: SceneLeaf,
	info: ChapterInfo | undefined,
): SceneDeclaration {
	let declaration: { -readonly [Key in keyof SceneDeclaration]: SceneDeclaration[Key] } = {
		[SCENE]: true,
		name,
	};
	if (leaf.title !== undefined) declaration.title = leaf.title;
	if (info !== undefined) declaration.chapter = info;
	return declaration;
}

/**
 * Reports whether a value is a scene declaration rather than a group of them.
 *
 * @param value - Anything found in a scene map.
 * @returns `true` for a scene `scenes()` named.
 */
export function isSceneDeclaration(value: unknown): value is SceneDeclaration {
	return typeof value === "object" && value !== null && SCENE in value;
}

/**
 * Reads the chapter a group of scenes was declared as.
 *
 * @param group - A group from a scene map.
 * @returns The chapter's name and title, or `undefined` for a plain group.
 */
export function chapterOf(group: object): ChapterInfo | undefined {
	return CHAPTER in group ? (group as ChapterMarker)[CHAPTER] : undefined;
}

/** A character's images as a flat set of named sprites, one of which shows at a time. */
export interface SpriteImage<Sprites extends Readonly<Record<string, AssetSource>>> {
	readonly kind: "sprites";
	readonly sprites: Sprites;
}

/** A character's images as layers drawn bottom to top, each showing one named variant. */
export interface LayerImage<
	Layers extends Readonly<Record<string, Readonly<Record<string, AssetSource>>>>,
> {
	readonly kind: "layers";
	readonly layers: Layers;
}

/** A character with no image, such as the player or a voice off stage. */
export interface NoImage {
	readonly kind: "none";
}

/** Any of the three shapes a character's images take. */
export type CharacterImage =
	| SpriteImage<Readonly<Record<string, AssetSource>>>
	| LayerImage<Readonly<Record<string, Readonly<Record<string, AssetSource>>>>>
	| NoImage;

/**
 * A character as `character()` declares it, before `cast()` names it.
 *
 * @template Image - The shape of its images, which types `enter` and `express`.
 */
export interface CharacterLeaf<Image extends CharacterImage = CharacterImage> {
	readonly [CHARACTER]: "leaf";
	/** The name's message key, which the textbox shows. */
	readonly name: string;
	/** The name's color, for a textbox that tints the speaker. */
	readonly color?: string;
	readonly image: Image;
}

/**
 * A declared character, named by its key in the cast; the stage and saves refer to it by `id`.
 *
 * @template Image - The shape of its images, which types `enter` and `express`.
 * @template Id - Its key in the cast.
 */
export interface CharacterDeclaration<
	Image extends CharacterImage = CharacterImage,
	Id extends string = string,
> {
	readonly [CHARACTER]: "declaration";
	readonly id: Id;
	readonly name: string;
	readonly color?: string;
	readonly image: Image;
}

/** The options every character takes. */
export interface CharacterOptions {
	/** The name's message key. */
	name: LineKey;
	color?: string;
}

/**
 * Declares a character with a flat set of sprites; `enter` and `express` take one by name.
 *
 * @param options - The name, a color, and the sprites.
 * @returns A leaf for {@link cast} to name.
 * @example character({ name: "cast.mika.name", sprites: { neutral: "/mika/neutral.webp" } })
 */
export function character<const Sprites extends Readonly<Record<string, AssetSource>>>(
	options: CharacterOptions & { sprites: Sprites },
): CharacterLeaf<SpriteImage<Sprites>>;
/**
 * Declares a character drawn in layers; `enter` names a variant for every layer, and
 * `express` changes any of them.
 *
 * @param options - The name, a color, and the layers from bottom to top.
 * @returns A leaf for {@link cast} to name.
 * @example character({ name: "cast.ren.name", layers: { body: { school: "/ren/body.webp" }, face: { grin: "/ren/grin.webp" } } })
 */
export function character<
	const Layers extends Readonly<Record<string, Readonly<Record<string, AssetSource>>>>,
>(options: CharacterOptions & { layers: Layers }): CharacterLeaf<LayerImage<Layers>>;
/**
 * Declares a character with no image, who speaks but never stands on stage.
 *
 * @param options - The name and a color.
 * @returns A leaf for {@link cast} to name.
 * @example character({ name: "cast.player.name" })
 */
export function character(options: CharacterOptions): CharacterLeaf<NoImage>;
export function character(
	options: CharacterOptions & {
		sprites?: Readonly<Record<string, AssetSource>>;
		layers?: Readonly<Record<string, Readonly<Record<string, AssetSource>>>>;
	},
): CharacterLeaf {
	let image: CharacterImage = { kind: "none" };
	if (options.sprites !== undefined) image = { kind: "sprites", sprites: options.sprites };
	else if (options.layers !== undefined) image = { kind: "layers", layers: options.layers };
	let leaf: CharacterLeaf = { [CHARACTER]: "leaf", name: options.name, image };
	return options.color === undefined ? leaf : { ...leaf, color: options.color };
}

/**
 * The map `cast()` returns, every character carrying its key as its id.
 *
 * @template Tree - The characters the cast was built from.
 */
export type CastMap<Tree> = {
	readonly [Key in keyof Tree & string]: Tree[Key] extends CharacterLeaf<infer Image>
		? CharacterDeclaration<Image, Key>
		: never;
};

/**
 * Names every character in the cast by its key.
 *
 * @param tree - The characters, keyed by the id scenes and saves refer to.
 * @returns The same map with every character named.
 * @example export default cast({ mika: character({ name: "cast.mika.name" }) });
 */
export function cast<const Tree extends Readonly<Record<string, CharacterLeaf>>>(
	tree: Tree,
): CastMap<Tree> {
	let map: Record<string, CharacterDeclaration> = {};
	for (let [id, leaf] of Object.entries(tree)) {
		map[id] = { ...leaf, [CHARACTER]: "declaration", id };
	}
	return map as CastMap<Tree>;
}

/**
 * Reports whether a value is a named character.
 *
 * @param value - Anything found in a cast.
 * @returns `true` for a character `cast()` named.
 */
export function isCharacterDeclaration(value: unknown): value is CharacterDeclaration {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as Record<symbol, unknown>)[CHARACTER] === "declaration"
	);
}

/** The kinds of media a novel declares, each played or shown by its own directive. */
export type AssetKind = "background" | "image" | "music" | "ambience" | "sound";

/** A sound with the caption shown to a player reading instead of listening. */
export interface CaptionedSound {
	src: AssetSource;
	/** The caption's message key. */
	caption?: LineKey;
}

/** The media `assets()` takes, grouped by how a scene uses it. */
export interface AssetTree {
	readonly backgrounds?: Readonly<Record<string, AssetSource>>;
	/** Full-screen images (CGs) shown over the background. */
	readonly images?: Readonly<Record<string, AssetSource>>;
	readonly music?: Readonly<Record<string, AssetSource>>;
	readonly ambience?: Readonly<Record<string, AssetSource>>;
	readonly sounds?: Readonly<Record<string, AssetSource | CaptionedSound>>;
}

/**
 * A declared asset. Its `id` is its group and key (`backgrounds.cafe`), which the stage and saves
 * keep, so a save loaded after a rebuild draws the file's current URL.
 *
 * @template Kind - What the asset is, which decides the directives that take it.
 */
export interface AssetDeclaration<Kind extends AssetKind = AssetKind> {
	readonly [ASSET]: true;
	readonly kind: Kind;
	readonly id: string;
	readonly src: AssetSource;
	/** A sound's caption key. */
	readonly caption?: string;
}

/** The group name each kind is declared under. */
const GROUPS = {
	backgrounds: "background",
	images: "image",
	music: "music",
	ambience: "ambience",
	sounds: "sound",
} as const satisfies Record<keyof AssetTree, AssetKind>;

/**
 * The map `assets()` returns: every group present in the tree, each asset named.
 *
 * @template Tree - The media the map was built from.
 */
export type AssetMap<Tree extends AssetTree> = {
	readonly [Group in keyof Tree & keyof AssetTree]: {
		readonly [Key in keyof Tree[Group]]: AssetDeclaration<(typeof GROUPS)[Group]>;
	};
};

/**
 * Names every asset by its group and key. Each file is a URL or a Blob, or a map of locale to one.
 *
 * @param tree - Backgrounds, images, music, ambience and sounds.
 * @returns The same groups with every asset named.
 * @example export default assets({ backgrounds: { cafe }, music: { chill }, sounds: { door: { src: door, caption: "captions.door" } } });
 */
export function assets<const Tree extends AssetTree>(tree: Tree): AssetMap<Tree> {
	let map: Record<string, Record<string, AssetDeclaration>> = {};
	for (let [group, entries] of Object.entries(tree) as [
		keyof AssetTree,
		AssetTree[keyof AssetTree],
	][]) {
		if (entries === undefined) continue;
		let named: Record<string, AssetDeclaration> = {};
		for (let [key, entry] of Object.entries(entries)) {
			named[key] = declareAsset(GROUPS[group], `${group}.${key}`, entry);
		}
		map[group] = named;
	}
	return map as AssetMap<Tree>;
}

/** The declaration of one asset, unwrapping a captioned sound. */
function declareAsset(
	kind: AssetKind,
	id: string,
	entry: AssetSource | CaptionedSound,
): AssetDeclaration {
	if (typeof entry === "object" && "src" in entry)
		return captioned(kind, id, entry as CaptionedSound);
	return { [ASSET]: true, kind, id, src: entry as AssetSource };
}

/** The declaration of a sound given as `{ src, caption }`. */
function captioned(kind: AssetKind, id: string, entry: CaptionedSound): AssetDeclaration {
	let declaration: AssetDeclaration = { [ASSET]: true, kind, id, src: entry.src };
	return entry.caption === undefined ? declaration : { ...declaration, caption: entry.caption };
}

/**
 * Reports whether a value is a named asset.
 *
 * @param value - Anything found in an asset map.
 * @returns `true` for an asset `assets()` named.
 */
export function isAssetDeclaration(value: unknown): value is AssetDeclaration {
	return typeof value === "object" && value !== null && ASSET in value;
}

/**
 * An interaction as `interaction()` declares it, before `interactions()` names it.
 *
 * @template Input - The schema of what the scene hands the interaction.
 * @template Output - The schema of what the interaction hands back.
 */
export interface InteractionLeaf<
	Input extends StandardSchemaV1 = StandardSchemaV1,
	Output extends StandardSchemaV1 = StandardSchemaV1,
> {
	readonly [INTERACTION]: "leaf";
	readonly input: Input;
	readonly output: Output;
}

/**
 * A declared interaction: a screen the app renders itself, such as a minigame, which the engine
 * hands the parsed input and whose reply it validates against the output schema.
 *
 * @template Name - Its key in the map, which a custom frame carries for narrowing.
 * @template Input - The schema of what the scene hands the interaction.
 * @template Output - The schema of what the interaction hands back.
 */
export interface InteractionDeclaration<
	Name extends string = string,
	Input extends StandardSchemaV1 = StandardSchemaV1,
	Output extends StandardSchemaV1 = StandardSchemaV1,
> {
	readonly [INTERACTION]: "declaration";
	readonly name: Name;
	readonly input: Input;
	readonly output: Output;
}

/**
 * Declares an interaction by the schemas of what goes in and what comes back.
 *
 * @param options - The input and output schemas; any Standard Schema with a synchronous validator.
 * @returns A leaf for {@link interactions} to name.
 * @example interaction({ input: s.object({ difficulty: s.number() }), output: s.object({ caught: s.number() }) })
 */
export function interaction<
	Input extends StandardSchemaV1,
	Output extends StandardSchemaV1,
>(options: { input: Input; output: Output }): InteractionLeaf<Input, Output> {
	return { [INTERACTION]: "leaf", input: options.input, output: options.output };
}

/**
 * The map `interactions()` returns, every interaction named by its key.
 *
 * @template Tree - The interactions the map was built from.
 */
export type InteractionMap<Tree> = {
	readonly [Key in keyof Tree & string]: Tree[Key] extends InteractionLeaf<
		infer Input,
		infer Output
	>
		? InteractionDeclaration<Key, Input, Output>
		: never;
};

/**
 * Names every interaction by its key.
 *
 * @param tree - The interactions, keyed by the name a custom frame carries.
 * @returns The same map with every interaction named.
 * @example export default interactions({ fishing: interaction({ input, output }) });
 */
export function interactions<const Tree extends Readonly<Record<string, InteractionLeaf>>>(
	tree: Tree,
): InteractionMap<Tree> {
	let map: Record<string, InteractionDeclaration> = {};
	for (let [name, leaf] of Object.entries(tree)) {
		map[name] = { [INTERACTION]: "declaration", name, input: leaf.input, output: leaf.output };
	}
	return map as InteractionMap<Tree>;
}

/**
 * Collects every value a branded predicate accepts from a nested map, in declaration order.
 *
 * @param map - A scene, cast or asset map.
 * @param accept - Reports whether a value is a leaf.
 * @returns Every leaf found.
 */
export function collect<Leaf>(map: object, accept: (value: unknown) => value is Leaf): Leaf[] {
	let found: Leaf[] = [];
	for (let value of Object.values(map)) {
		if (accept(value)) found.push(value);
		else if (typeof value === "object" && value !== null) found.push(...collect(value, accept));
	}
	return found;
}
