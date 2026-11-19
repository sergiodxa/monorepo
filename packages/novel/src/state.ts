/**
 * Reading and writing story state, and checking untrusted input against schemas: a loaded save,
 * a starting state, an interaction's output. Validation is synchronous, so `start()` answers its
 * `Result` at once and a reply is checked before the play moves on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RandomState } from "@sdxc/random";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Schema } from "remix/data-schema";

import { RANDOM_STATE_SCHEMA } from "@sdxc/random/schema";
import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { StateRecord } from "./types.js";

/**
 * Runs a Standard Schema synchronously.
 *
 * @param schema - Any Standard Schema whose validator answers synchronously.
 * @param value - The untrusted value.
 * @returns The parsed value, or an error listing every issue; an asynchronous validator fails.
 */
export function validate<Output>(
	schema: StandardSchemaV1<unknown, Output>,
	value: unknown,
): Result<Output, Error> {
	let result = schema["~standard"].validate(value);
	if (result instanceof Promise) {
		return failure(
			new Error("The schema validates asynchronously; novels need a synchronous one."),
		);
	}
	if (result.issues !== undefined) {
		let issues = result.issues.map((issue) => {
			let path = issue.path
				?.map((key) => (typeof key === "object" ? String(key.key) : String(key)))
				.join(".");
			return path === undefined || path === "" ? issue.message : `${path}: ${issue.message}`;
		});
		return failure(new Error(issues.join("; ")));
	}
	return success(result.value);
}

/**
 * Reads the value at a dotted path.
 *
 * @param state - The story state.
 * @param path - A dotted path such as `affection.mika`.
 * @returns The value, or `undefined` when any step is missing.
 */
export function getPath(state: StateRecord, path: string): unknown {
	let value: unknown = state;
	for (let key of path.split(".")) {
		if (typeof value !== "object" || value === null) return undefined;
		value = (value as StateRecord)[key];
	}
	return value;
}

/**
 * Writes a value at a dotted path, creating the objects on the way that are missing.
 *
 * @param state - The story state, changed in place.
 * @param path - A dotted path such as `affection.mika`.
 * @param value - The value to store.
 */
export function setPath(state: StateRecord, path: string, value: unknown): void {
	let keys = path.split(".");
	let last = keys.pop() as string;
	let target = state;
	for (let key of keys) {
		let next = target[key];
		if (typeof next !== "object" || next === null) {
			next = {};
			target[key] = next;
		}
		target = next as StateRecord;
	}
	target[last] = value;
}

/** A position as a save stores it. */
const POSITION = s.object({ scene: s.string(), line: s.string() });

/** A media file: a URL or a map of locale to URL. */
const SOURCE = s.union([s.string(), s.record(s.string(), s.string())]);

/** A background or image as a save stores it; its file is re-read from the declarations. */
const SCENERY = s.nullable(s.object({ id: s.string(), transition: s.optional(s.string()) }));

/** A looping track as a save stores it. */
const TRACK = s.object({
	id: s.string(),
	volume: s.optional(s.number()),
	fade: s.optional(s.number()),
});

/** A saved game as untrusted JSON is checked before a play resumes from it. */
export interface SavedGame {
	version: number;
	position: { scene: string; line: string };
	stack: { scene: string; line: string }[];
	stage: {
		background: { id: string; transition?: string } | null;
		image: { id: string; transition?: string } | null;
		characters: {
			id: string;
			at: string;
			expression?: string;
			layers?: Record<string, string>;
			transition?: string;
		}[];
	};
	audio: {
		music: { id: string; volume?: number; fade?: number } | null;
		ambience: { id: string; volume?: number; fade?: number }[];
		sounds: { id: string; volume?: number; occurrence: string }[];
	};
	state: unknown;
	random: RandomState;
	taken: string[];
	meta: { scene: string; savedAt: string; playTime: number };
}

/**
 * The shape of a `GameState` read back from storage. Files are re-read from the declarations by
 * id, and the story state is parsed by the novel's own schema afterwards.
 */
export const SAVED_GAME_SCHEMA: Schema<unknown, SavedGame> = s.object({
	version: s.defaulted(s.number(), 1),
	position: POSITION,
	stack: s.array(POSITION),
	stage: s.object({
		background: SCENERY,
		image: SCENERY,
		characters: s.array(
			s.object({
				id: s.string(),
				at: s.string(),
				expression: s.optional(s.string()),
				layers: s.optional(s.record(s.string(), s.string())),
				transition: s.optional(s.string()),
			}),
		),
	}),
	audio: s.object({
		music: s.nullable(TRACK),
		ambience: s.array(TRACK),
		sounds: s.array(
			s.object({ id: s.string(), volume: s.optional(s.number()), occurrence: s.string() }),
		),
		voice: s.optional(s.nullable(SOURCE)),
	}),
	state: s.any(),
	random: RANDOM_STATE_SCHEMA,
	taken: s.defaulted(s.array(s.string()), []),
	meta: s.object({
		scene: s.string(),
		savedAt: s.string(),
		playTime: s.defaulted(s.number(), 0),
	}),
}) as Schema<unknown, SavedGame>;
