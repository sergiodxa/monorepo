/**
 * `Persistent`: what outlives a playthrough (lines read, options taken, endings, chapters,
 * unlocks and characters met). A play updates its own copy and the novel emits the whole value on `persist`, so the
 * app stores it wherever it likes and hands it back to the next `novel.start({ persistent })`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";

import type { AnyExtension } from "./extensions.js";

import { validate } from "./state.js";

/**
 * Data kept across every playthrough and never rolled back. Lines and options are keyed as
 * `<scene>:<key>`, so a key shared by two scenes is recorded once per scene.
 */
export interface Persistent {
	/** Every line read, as `<scene>:<key>`, with the message values it was last shown with. */
	seen: Record<string, Record<string, JSONValue>>;
	/** Every option taken, as `<scene>:<option>`. */
	chosen: string[];
	/** The message key of every ending reached. */
	endings: string[];
	/** The name of every chapter reached. */
	chapters: string[];
	/** The ids of the images shown and the music played, for a gallery and a music room. */
	unlocked: { images: string[]; music: string[] };
	/** The id of every character a play introduced, so a replay names everyone the reader met. */
	introduced: string[];
}

/** `Persistent` as stored JSON is checked; every field defaults to empty. */
const PERSISTENT_SCHEMA: Schema<unknown, Persistent> = s.object({
	seen: s.defaulted(s.record(s.string(), s.record(s.string(), s.any())), {}),
	chosen: s.defaulted(s.array(s.string()), []),
	endings: s.defaulted(s.array(s.string()), []),
	chapters: s.defaulted(s.array(s.string()), []),
	unlocked: s.defaulted(
		s.object({
			images: s.defaulted(s.array(s.string()), []),
			music: s.defaulted(s.array(s.string()), []),
		}),
		{ images: [], music: [] },
	),
	introduced: s.defaulted(s.array(s.string()), []),
}) as Schema<unknown, Persistent>;

/**
 * Nothing read, taken, reached or unlocked: a first playthrough.
 *
 * @returns An empty record.
 */
export function emptyPersistent(): Persistent {
	return {
		seen: {},
		chosen: [],
		endings: [],
		chapters: [],
		unlocked: { images: [], music: [] },
		introduced: [],
	};
}

/**
 * The fields of the novel's own record, which an extension's lasting slice cannot be named
 * after since it sits beside them.
 */
export const PERSISTENT_FIELDS: ReadonlySet<string> = new Set(Object.keys(emptyPersistent()));

/**
 * Reads stored persistent data. Storage is untrusted, so a value the schema refuses, or none at
 * all, starts from an empty record and the play overwrites it on the next `persist`. Each
 * extension's lasting slice is read by its own schema, and one it refuses, or one the record
 * lacks, reads as the extension's `initial` value.
 *
 * @param value - What the app read back from storage.
 * @param extensions - The novel's extensions, whose lasting slices the record carries.
 * @returns The validated record, with missing fields empty.
 */
export function readPersistent(
	value: unknown,
	extensions: readonly AnyExtension[] = [],
): Persistent {
	let parsed =
		value === undefined || value === null ? undefined : validate(PERSISTENT_SCHEMA, value);
	let record = parsed?.status === "success" ? structuredClone(parsed.data) : emptyPersistent();
	let stored = parsed?.status === "success" ? (value as Record<string, unknown>) : {};
	let slices = record as unknown as Record<string, unknown>;
	for (let entry of extensions) {
		if (entry.persistent === undefined) continue;
		let given = stored[entry.name];
		let slice = given === undefined ? undefined : validate(entry.persistent.state, given);
		if (slice?.status !== "success") {
			slice = validate(entry.persistent.state, structuredClone(entry.persistent.initial));
		}
		slices[entry.name] =
			slice.status === "success"
				? structuredClone(slice.data)
				: structuredClone(entry.persistent.initial);
	}
	return record;
}

/**
 * The key a line or an option is recorded under.
 *
 * @param scene - The scene's name.
 * @param key - The line's or the option's message key.
 * @returns `<scene>:<key>`.
 */
export function recordKey(scene: string, key: string): string {
	return `${scene}:${key}`;
}
