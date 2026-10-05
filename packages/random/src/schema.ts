/**
 * The parser for a `RandomState` read back from storage, on its own entry point
 * so only a caller that parses snapshots installs `remix`. A save file is
 * untrusted input, and a malformed snapshot would resume a different stream.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";

import type { RandomState } from "./seeded.js";

/** The schema of one word, spelled out so `words` parses into a four-item tuple. */
type WordSchema = Schema<unknown, number>;

/** Reads one generator word, which the stream stores as an unsigned 32-bit integer. */
const WORD_SCHEMA: WordSchema = s
	.number()
	.refine(
		(value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff,
		"Expected an unsigned 32-bit integer",
	);

/**
 * Reads a snapshot from `state()`, so `restoreRandom` receives exactly the
 * shape it was written in.
 *
 * @example s.parseSafe(RANDOM_STATE_SCHEMA, JSON.parse(stored))
 */
export const RANDOM_STATE_SCHEMA: Schema<unknown, RandomState> = s.object({
	seed: s.union([s.string(), s.number()]),
	words: s.tuple<[WordSchema, WordSchema, WordSchema, WordSchema]>([
		WORD_SCHEMA,
		WORD_SCHEMA,
		WORD_SCHEMA,
		WORD_SCHEMA,
	]),
});
