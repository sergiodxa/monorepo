/**
 * What a novel's extras screens read: the whole library (reached scenes with their read lines,
 * CGs, tracks, the cast, endings and chapters) built from the declarations, the lines and endings
 * each scene holds, and the stored `Persistent` value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { Handle } from "remix/component";

import { isFailure } from "@sdxc/result";

import type {
	ArcInfo,
	AssetSource,
	BioSection,
	ChapterInfo,
	CharacterDeclaration,
	EntryDeclaration,
	SceneDeclaration,
	TopicDeclaration,
} from "../declarations.js";
import type { Directive } from "../directives.js";
import type { Novel } from "../novel.js";
import type { Persistent } from "../persistent.js";
import type { SceneLine } from "../unlocks.js";

import { INTERNALS } from "../novel.js";
import { bioKey, lookKey, recordKey } from "../persistent.js";
import { eachDirective, endingKeys, isListed, isMet, sceneLines } from "../unlocks.js";

import { resolveSource } from "./source.js";

/** A line the reader has read, as Memories lists it. */
export interface MemoryLine extends SceneLine {
	/** The message values it was last shown with. */
	values: Record<string, JSONValue>;
	/** The voice file for the reader's locale, or `null` for an unvoiced line. */
	voice: string | null;
}

/** One mapped scene, with what the reader has seen of it. */
export interface LibraryScene {
	scene: SceneDeclaration;
	/** True once the reader has read a line or taken an option in it. */
	reached: boolean;
	/** False when the scene's module failed to load, which leaves `lines` empty. */
	loaded: boolean;
	/** The lines read in it, in the order the scene declares them. */
	lines: MemoryLine[];
}

/** Mapped scenes grouped by the chapter they were declared in, in declaration order. */
export interface LibraryChapter {
	/** The chapter, or `null` for scenes declared outside every chapter. */
	chapter: ChapterInfo | null;
	/** True once the reader has entered one of its scenes. */
	reached: boolean;
	scenes: LibraryScene[];
}

/** Consecutive chapters grouped by the arc they were declared in, in declaration order. */
export interface LibraryArc {
	/** The arc, or `null` for chapters (and loose scenes) declared outside every arc. */
	arc: ArcInfo | null;
	/** True once the reader has reached one of its chapters. */
	reached: boolean;
	chapters: LibraryChapter[];
}

/** A declared CG or music track, and whether the reader has unlocked it. */
export interface LibraryAsset {
	/** The asset's id (`images.letter`). */
	id: string;
	src: AssetSource;
	unlocked: boolean;
}

/** One look of a character: a sprite, or a combination of layer variants the stage drew. */
export interface LibraryLook {
	/** The look's key, as `lookKey` names it (`mika:smile`, `ren:body=school,face=grin`). */
	key: string;
	/** The images drawn for it, bottom to top. */
	images: AssetSource[];
	/** True once the stage drew the character in this look. */
	seen: boolean;
}

/** A declared character, whether the reader met them, and the looks the stage drew them in. */
export interface LibraryCharacter {
	character: CharacterDeclaration;
	/**
	 * True once the reader met the character in any play: a scene introduced them, they spoke a
	 * line the reader read, or the stage drew them.
	 */
	met: boolean;
	/**
	 * Every declared sprite in declaration order, or for a layered character every combination the
	 * stage drew, in the order the reader saw them; none for a character with no image.
	 */
	looks: LibraryLook[];
	/** Every section of the character's bio in declaration order. */
	bio: LibraryBioSection[];
}

/** A section of a character's bio and whether the reader has learned it. */
export interface LibraryBioSection {
	/** The section's id in the character's `bio`. */
	id: string;
	section: BioSection;
	/** True for a section declared `known`, or one a scene taught in any play. */
	learned: boolean;
}

/** An encyclopedia entry and whether the reader can open it. */
export interface LibraryEntry {
	entry: EntryDeclaration;
	/** True for an entry declared `known`, or one a scene taught in any play. */
	learned: boolean;
}

/** An encyclopedia topic with its entries in declaration order. */
export interface LibraryTopic {
	topic: TopicDeclaration;
	entries: LibraryEntry[];
}

/** An ending known from the scenes, or reached in an earlier playthrough. */
export interface LibraryEnding {
	/** The ending's message key. */
	key: string;
	reached: boolean;
}

/** Everything the extras screens show, read from the declarations and `Persistent`. */
export interface NovelLibrary {
	persistent: Persistent;
	chapters: LibraryChapter[];
	/** The same chapters grouped by arc; a story without arcs has one group whose `arc` is `null`. */
	arcs: LibraryArc[];
	images: LibraryAsset[];
	music: LibraryAsset[];
	/** The cast in declaration order. */
	characters: LibraryCharacter[];
	/** The encyclopedia's topics in declaration order. */
	topics: LibraryTopic[];
	/** Every ending key the mapped scenes hold, then any reached one they no longer hold. */
	endings: LibraryEnding[];
}

/**
 * Builds the library for one reader. Every mapped scene's module is loaded, lazily mapped ones
 * included, so the endings list knows every ending; a module that fails to load is listed with
 * `loaded: false` and no lines rather than failing the whole library.
 *
 * @param novel - The novel, with its scenes mapped.
 * @param persistent - The stored `Persistent` value; anything it refuses reads as a first playthrough.
 * @param locale - The reader's locale, which picks each voice file.
 * @returns The library.
 * @example let library = await readLibrary(novel, JSON.parse(localStorage.getItem("persistent") ?? "null"), "en");
 */
export async function readLibrary(
	novel: Novel,
	persistent: unknown,
	locale: string,
): Promise<NovelLibrary> {
	let internals = novel[INTERNALS]();
	let record = internals.persistent(persistent);
	let mapped = new Set(internals.mapped);
	let declared = [...internals.scenes.values()].filter((scene) => mapped.has(scene.name));
	let loaded = await Promise.all(
		declared.map(async (scene) => {
			let index = await internals.load(scene.name);
			return isFailure(index) ? null : index.data.module.directives;
		}),
	);
	let chapters: LibraryChapter[] = [];
	let endings = new Set<string>();
	for (let [position, scene] of declared.entries()) {
		let directives = loaded[position] ?? null;
		for (let key of endingKeys(directives ?? [])) endings.add(key);
		let entry: LibraryScene = {
			scene,
			reached: reachedScene(record, scene.name),
			loaded: directives !== null,
			lines: memories(directives ?? [], scene.name, record, (speaker, key) =>
				voiceOf(novel, speaker, key, locale),
			),
		};
		let group = chapters.at(-1);
		let chapter = scene.chapter ?? null;
		if (group === undefined || group.chapter?.name !== chapter?.name) {
			group = { chapter, reached: false, scenes: [] };
			chapters.push(group);
		}
		group.scenes.push(entry);
		group.reached ||= entry.reached || (chapter !== null && record.chapters.includes(chapter.name));
	}
	for (let key of record.endings) endings.add(key);
	let heard = new Set(
		chapters.flatMap((chapter) =>
			chapter.scenes.flatMap((scene) =>
				scene.lines.flatMap((line) => line.speakers.map((speaker) => speaker.id)),
			),
		),
	);
	let shown = appearanceOrder(loaded);
	return {
		persistent: record,
		chapters,
		arcs: groupArcs(chapters),
		images: inOrder(unlocks(internals.assets.values(), "image", record.unlocked.images), shown),
		music: inOrder(unlocks(internals.assets.values(), "music", record.unlocked.music), shown),
		characters: [...internals.characters.values()].filter(isListed).map((character) => {
			let drawn = looks(character, record.unlocked.sprites);
			return {
				character,
				met: isMet({
					introduced: record.introduced.includes(character.id),
					spoke: heard.has(character.id),
					drawn: drawn.some((look) => look.seen),
				}),
				looks: drawn,
				bio: Object.entries(character.bio ?? {}).map(([id, section]) => ({
					id,
					section,
					learned:
						section.known === true || record.unlocked.bios.includes(bioKey(character.id, id)),
				})),
			};
		}),
		topics: [...internals.topics.values()].map((topic) => ({
			topic,
			entries: [...internals.entries.values()]
				.filter((entry) => entry.topic === topic.id)
				.map((entry) => ({
					entry,
					learned: entry.known || record.unlocked.entries.includes(entry.id),
				})),
		})),
		endings: [...endings].map((key) => ({ key, reached: record.endings.includes(key) })),
	};
}

/**
 * Each asset id in the order the story first shows or plays it, reading the scenes in declaration
 * order, so the gallery and the music room follow the story rather than the asset map.
 */
function appearanceOrder(scenes: ReadonlyArray<readonly Directive[] | null>): Map<string, number> {
	let order = new Map<string, number>();
	for (let directives of scenes) {
		eachDirective(directives ?? [], (directive) => {
			if (directive.type !== "show" && directive.type !== "play") return;
			if (!order.has(directive.asset.id)) order.set(directive.asset.id, order.size);
		});
	}
	return order;
}

/** Sorts assets by where the story first uses them; ones no scene uses keep their order at the end. */
function inOrder(assets: LibraryAsset[], order: ReadonlyMap<string, number>): LibraryAsset[] {
	let position = (asset: LibraryAsset) => order.get(asset.id) ?? Number.POSITIVE_INFINITY;
	return [...assets].sort((a, b) => position(a) - position(b));
}

/** Groups consecutive chapters that share an arc, each group reached when one of its chapters is. */
function groupArcs(chapters: readonly LibraryChapter[]): LibraryArc[] {
	let arcs: LibraryArc[] = [];
	for (let chapter of chapters) {
		let arc = chapter.chapter?.arc ?? null;
		let group = arcs.at(-1);
		if (group === undefined || group.arc?.name !== arc?.name) {
			group = { arc, reached: false, chapters: [] };
			arcs.push(group);
		}
		group.chapters.push(chapter);
		group.reached ||= chapter.reached;
	}
	return arcs;
}

/** Reports whether the reader read a line or took an option in a scene. */
function reachedScene(persistent: Persistent, scene: string): boolean {
	let prefix = recordKey(scene, "");
	return (
		Object.keys(persistent.seen).some((key) => key.startsWith(prefix)) ||
		persistent.chosen.some((key) => key.startsWith(prefix))
	);
}

/** The read lines of one scene, in its order, with the values each was last shown with. */
function memories(
	directives: readonly Directive[],
	scene: string,
	persistent: Persistent,
	voice: (speaker: string, key: string) => string | null,
): MemoryLine[] {
	return sceneLines(directives).flatMap((line) => {
		let values = persistent.seen[recordKey(scene, line.key)];
		if (values === undefined) return [];
		let speaker = line.speakers[0];
		return [{ ...line, values, voice: speaker === undefined ? null : voice(speaker.id, line.key) }];
	});
}

/**
 * The voice file of a line for the reader's locale. The novel's `voice` option is asked the way
 * a play asks it, once per declared locale (or once without any), and the reader's file is then
 * picked with the same fallback a frame's voice gets.
 */
function voiceOf(novel: Novel, speaker: string, key: string, locale: string): string | null {
	let options = novel[INTERNALS]().options;
	let voice = options.voice;
	if (voice === undefined) return null;
	let locales = options.locales ?? Object.keys(options.messages ?? {});
	let files: Record<string, string | Blob> = {};
	if (locales.length === 0) {
		let found = voice({ speaker, key });
		if (found === undefined) return null;
		return resolveSource(found, locale) || null;
	}
	for (let declared of locales) {
		let found = voice({ speaker, key, locale: declared });
		let file = typeof found === "string" || found instanceof Blob ? found : found?.[declared];
		if (file !== undefined) files[declared] = file;
	}
	return Object.keys(files).length === 0 ? null : resolveSource(files, locale);
}

/** The declared assets of one kind, each marked unlocked when the record lists it. */
function unlocks(
	declared: Iterable<{ id: string; kind: string; src: AssetSource }>,
	kind: "image" | "music",
	unlocked: readonly string[],
): LibraryAsset[] {
	let assets: LibraryAsset[] = [];
	for (let asset of declared) {
		if (asset.kind !== kind) continue;
		assets.push({ id: asset.id, src: asset.src, unlocked: unlocked.includes(asset.id) });
	}
	return assets;
}

/**
 * A character's looks: each declared sprite marked seen or not, or each layered combination the
 * record lists whose variants the character still declares.
 */
function looks(character: CharacterDeclaration, seen: readonly string[]): LibraryLook[] {
	let image = character.image;
	if (image.kind === "sprites") {
		return Object.entries(image.sprites).map(([name, src]) => {
			let key = lookKey(character.id, name);
			return { key, images: [src], seen: seen.includes(key) };
		});
	}
	if (image.kind === "none") return [];
	let prefix = lookKey(character.id, "");
	let found: LibraryLook[] = [];
	for (let key of seen) {
		if (!key.startsWith(prefix)) continue;
		let images: AssetSource[] = [];
		for (let part of key.slice(prefix.length).split(",")) {
			let [layer = "", variant = ""] = part.split("=");
			let src = image.layers[layer]?.[variant];
			if (src === undefined) break;
			images.push(src);
		}
		if (images.length === Object.keys(image.layers).length) found.push({ key, images, seen: true });
	}
	return found;
}

/**
 * Keeps a screen's library current for its component: the returned reader starts a read when
 * the novel, the persistent value or the locale changes, answers the last library (or
 * `undefined` before the first arrives), and renders the component again once the read settles.
 * Persistent data is compared by identity, so a caller keeps one value per screen it opens.
 *
 * @param handle - The screen component's handle.
 * @returns The reader to call while rendering.
 */
export function libraryReader(
	handle: Pick<Handle, "update" | "signal">,
): (novel: Novel, persistent: unknown, locale: string) => NovelLibrary | undefined {
	let wanted: { novel: Novel; persistent: unknown; locale: string } | undefined;
	let library: NovelLibrary | undefined;
	return (novel, persistent, locale) => {
		if (wanted?.novel === novel && wanted.persistent === persistent && wanted.locale === locale) {
			return library;
		}
		let request = { novel, persistent, locale };
		wanted = request;
		void readLibrary(novel, persistent, locale).then((read) => {
			if (wanted !== request || handle.signal.aborted) return;
			library = read;
			void handle.update();
		});
		return library;
	};
}

/** What a library screen reads: the novel and the persistent value to build its library from. */
export interface LibrarySource {
	novel: Novel;
	persistent: unknown;
}

/**
 * Resolves a library screen's novel and persistent data: its own props first, else the player
 * it sits in, so a title screen passes both and a screen inside a player passes neither.
 *
 * @param player - The enclosing player's context, or `undefined` outside one.
 * @param props - The screen's own `novel` and `persistent`.
 * @returns What to read, or `undefined` when no novel is known.
 */
export function librarySource(
	player: { novel: Novel; persistent: unknown } | undefined,
	props: { novel?: Novel; persistent?: unknown },
): LibrarySource | undefined {
	let novel = props.novel ?? player?.novel;
	if (novel === undefined) return undefined;
	return { novel, persistent: props.persistent ?? player?.persistent };
}
