/**
 * What the developer tools know about a novel's library without playing it: every id persistent
 * data can unlock, the record with all of them (or none) for previewing screens, a check for an
 * edited record, and why each character counts as met.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CharacterDeclaration } from "../declarations.js";
import type { NovelInternals } from "../novel.js";
import type { Persistent } from "../persistent.js";
import type { NovelLibrary } from "../ui/library.js";

import { bioKey, emptyPersistent, lookKey, recordKey } from "../persistent.js";
import { endingKeys, sceneLines } from "../ui/library.js";

/** The looks a layered character contributes at most, so a wide wardrobe stays a short list. */
const LAYERED_LOOK_LIMIT = 64;

/** Which library a previewed screen reads: the play's own, or one with everything or nothing. */
export type LibraryPreset = "current" | "unlocked" | "locked";

/** Every id persistent data can hold, per list, in declaration order. */
export interface UnlockCatalog {
	images: string[];
	music: string[];
	/** Each sprite as `lookKey` names it; a layered character lists its first combinations. */
	sprites: string[];
	entries: string[];
	/** Each bio section as `bioKey` names it. */
	bios: string[];
	/** Every character id, which `introduced` holds. */
	characters: string[];
	endings: string[];
	chapters: string[];
	/** Every line of every mapped scene as `recordKey` names it, which `seen` holds. */
	lines: string[];
}

/** Why the library lists a character as met, which `met` combines. */
export interface CastReport {
	id: string;
	/** The character's name message key. */
	name: string;
	/** False for a character declared `listed: false`, whom the screens leave out. */
	listed: boolean;
	met: boolean;
	/** True when a play introduced them. */
	introduced: boolean;
	/** The read lines they speak, as `<scene>:<key>`. */
	lines: string[];
	/** The looks the stage drew them in. */
	looks: string[];
	/** The bio sections learned, as `bioKey` names them. */
	bios: string[];
}

/**
 * Lists every id persistent data can hold, loading every mapped scene for its lines and endings;
 * a scene that fails to load adds none, and `check()` reports why.
 *
 * @param internals - The novel's declarations and loader.
 * @returns The catalog.
 */
export async function readCatalog(internals: NovelInternals): Promise<UnlockCatalog> {
	let catalog: UnlockCatalog = {
		images: [],
		music: [],
		sprites: [],
		entries: [...internals.entries.keys()],
		bios: [],
		characters: [...internals.characters.keys()],
		endings: [],
		chapters: [],
		lines: [],
	};
	for (let asset of internals.assets.values()) {
		if (asset.kind === "image") catalog.images.push(asset.id);
		if (asset.kind === "music") catalog.music.push(asset.id);
	}
	for (let character of internals.characters.values()) {
		catalog.sprites.push(...looksOf(character));
		for (let section of Object.keys(character.bio ?? {})) {
			catalog.bios.push(bioKey(character.id, section));
		}
	}
	for (let scene of internals.scenes.values()) {
		let name = scene.chapter?.name;
		if (name !== undefined && !catalog.chapters.includes(name)) catalog.chapters.push(name);
	}
	let modules = await Promise.all(internals.mapped.map((scene) => internals.load(scene)));
	for (let [position, index] of modules.entries()) {
		if (index.status === "failure") continue;
		let scene = internals.mapped[position] as string;
		let directives = index.data.module.directives;
		for (let line of sceneLines(directives)) catalog.lines.push(recordKey(scene, line.key));
		for (let key of endingKeys(directives)) {
			if (!catalog.endings.includes(key)) catalog.endings.push(key);
		}
	}
	return catalog;
}

/**
 * Every look of a character: each sprite, or the combinations of its layers' variants, the
 * first {@link LAYERED_LOOK_LIMIT} in declaration order.
 */
function looksOf(character: CharacterDeclaration): string[] {
	let image = character.image;
	if (image.kind === "none") return [];
	if (image.kind === "sprites") {
		return Object.keys(image.sprites).map((name) => lookKey(character.id, name));
	}
	let combinations: Record<string, string>[] = [{}];
	for (let [layer, variants] of Object.entries(image.layers)) {
		combinations = combinations
			.flatMap((look) => Object.keys(variants).map((variant) => ({ ...look, [layer]: variant })))
			.slice(0, LAYERED_LOOK_LIMIT);
	}
	return combinations.map((look) => lookKey(character.id, look));
}

/**
 * The record with everything in the catalog unlocked, read and reached, keeping `base`'s message
 * values, options taken and extension slices.
 *
 * @param catalog - What {@link readCatalog} answered.
 * @param base - The play's record.
 * @returns A new record.
 */
export function unlockedPersistent(catalog: UnlockCatalog, base: Persistent): Persistent {
	return {
		...structuredClone(base),
		seen: Object.fromEntries(catalog.lines.map((key) => [key, base.seen[key] ?? {}])),
		endings: [...catalog.endings],
		chapters: [...catalog.chapters],
		unlocked: {
			images: [...catalog.images],
			music: [...catalog.music],
			sprites: [...catalog.sprites],
			entries: [...catalog.entries],
			bios: [...catalog.bios],
		},
		introduced: [...catalog.characters],
	};
}

/**
 * The record of a first playthrough, keeping `base`'s extension slices.
 *
 * @param base - The play's record.
 * @returns A new record.
 */
export function lockedPersistent(base: Persistent): Persistent {
	return { ...structuredClone(base), ...emptyPersistent() };
}

/**
 * Checks an edited record's own fields, which a play would otherwise replace with empty data
 * without a word; extension slices are left to their schemas.
 *
 * @param value - The record as parsed from the editor.
 * @returns What is wrong, or `undefined` for a record a play accepts.
 */
export function persistentProblem(value: unknown): string | undefined {
	if (!isRecord(value)) return "Persistent data must be an object.";
	if (value["seen"] !== undefined && !isRecord(value["seen"])) {
		return "`seen` must map `<scene>:<key>` to message values.";
	}
	for (let field of ["chosen", "endings", "chapters", "introduced"]) {
		if (value[field] !== undefined && !isStrings(value[field])) {
			return `\`${field}\` must be a list of strings.`;
		}
	}
	let unlocked = value["unlocked"];
	if (unlocked === undefined) return undefined;
	if (!isRecord(unlocked)) return "`unlocked` must be an object of lists.";
	for (let [field, list] of Object.entries(unlocked)) {
		if (list !== undefined && !isStrings(list)) {
			return `\`unlocked.${field}\` must be a list of strings.`;
		}
	}
	return undefined;
}

/** True for a plain object, which JSON parses `{}` into. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True for an array holding only strings. */
function isStrings(value: unknown): boolean {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Explains each character's `met`: the library counts them met once a play introduced them, the
 * reader read a line they speak, or the stage drew them.
 *
 * @param internals - The novel's cast.
 * @param library - The library read from the play's record.
 * @returns One report per declared character, in declaration order, unlisted ones included.
 */
export function castReport(internals: NovelInternals, library: NovelLibrary): CastReport[] {
	let record = library.persistent;
	let spoken = new Map<string, string[]>();
	for (let chapter of library.chapters) {
		for (let scene of chapter.scenes) {
			for (let line of scene.lines) {
				for (let speaker of line.speakers) {
					let lines = spoken.get(speaker.id) ?? [];
					lines.push(recordKey(scene.scene.name, line.key));
					spoken.set(speaker.id, lines);
				}
			}
		}
	}
	return [...internals.characters.values()].map((character) => {
		let prefix = lookKey(character.id, "");
		let introduced = record.introduced.includes(character.id);
		let lines = spoken.get(character.id) ?? [];
		let looks = record.unlocked.sprites.filter((key) => key.startsWith(prefix));
		return {
			id: character.id,
			name: character.name,
			listed: character.listed !== false,
			met: introduced || lines.length > 0 || looks.length > 0,
			introduced,
			lines,
			looks,
			bios: record.unlocked.bios.filter((key) => key.startsWith(prefix)),
		};
	});
}
