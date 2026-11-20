/**
 * What a novel's extras screens read: the lines and endings a scene holds, found statically in
 * its directive array, and the whole library (reached scenes with their read lines, CGs, tracks,
 * endings and chapters) built from the declarations and the stored `Persistent` value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { Handle } from "remix/component";

import { isFailure } from "@sdxc/result";

import type { AssetSource, ChapterInfo, SceneDeclaration } from "../declarations.js";
import type { Directive } from "../directives.js";
import type { Speaker } from "../frames.js";
import type { Novel } from "../novel.js";
import type { Persistent } from "../persistent.js";

import { INTERNALS } from "../novel.js";
import { recordKey } from "../persistent.js";

import { resolveSource } from "./source.js";

/** A line as a scene's array declares it: its key and who says it, before anyone reads it. */
export interface SceneLine {
	key: string;
	/** The characters saying it, none for narration. */
	speakers: Speaker[];
}

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

/** A declared CG or music track, and whether the reader has unlocked it. */
export interface LibraryAsset {
	/** The asset's id (`images.letter`). */
	id: string;
	src: AssetSource;
	unlocked: boolean;
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
	images: LibraryAsset[];
	music: LibraryAsset[];
	/** Every ending key the mapped scenes hold, then any reached one they no longer hold. */
	endings: LibraryEnding[];
}

/**
 * Every line a scene declares, in document order, including those inside conditions and menu
 * options; a key repeated in the scene is listed once, where it first appears.
 *
 * @param directives - The scene module's directives.
 * @returns The lines with their speakers.
 * @example sceneLines(module.directives).map((line) => line.key); // ["opening.welcome", "opening.hello"]
 */
export function sceneLines(directives: readonly Directive[]): SceneLine[] {
	let lines = new Map<string, SceneLine>();
	for (let directive of walk(directives)) {
		if (directive.type === "narrate" && !lines.has(directive.key)) {
			lines.set(directive.key, { key: directive.key, speakers: [] });
		}
		if (directive.type === "say" && !lines.has(directive.key)) {
			let speakers = directive.speakers.map((speaker) =>
				speaker.color === undefined
					? { id: speaker.id, name: speaker.name }
					: { id: speaker.id, name: speaker.name, color: speaker.color },
			);
			lines.set(directive.key, { key: directive.key, speakers });
		}
	}
	return [...lines.values()];
}

/**
 * Every ending key a scene can reach, in document order and each once.
 *
 * @param directives - The scene module's directives.
 * @returns The `ending` directives' keys.
 * @example endingKeys(module.directives); // ["endings.good", "endings.bad"]
 */
export function endingKeys(directives: readonly Directive[]): string[] {
	let keys = new Set<string>();
	for (let directive of walk(directives)) {
		if (directive.type === "ending") keys.add(directive.key);
	}
	return [...keys];
}

/**
 * Yields every directive of a list and of each list nested in it, in document order.
 *
 * @yields Each directive, a branch's directives right after the directive that holds them.
 */
function* walk(list: readonly Directive[]): Generator<Directive> {
	for (let directive of list) {
		yield directive;
		if (directive.type === "when") {
			yield* walk(directive.do);
			yield* walk(directive.otherwise);
		} else if (directive.type === "choose") {
			for (let option of directive.options) yield* walk(option.do);
		}
	}
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
	return {
		persistent: record,
		chapters,
		images: unlocks(internals.assets.values(), "image", record.unlocked.images),
		music: unlocks(internals.assets.values(), "music", record.unlocked.music),
		endings: [...endings].map((key) => ({ key, reached: record.endings.includes(key) })),
	};
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
