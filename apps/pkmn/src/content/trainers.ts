/**
 * The on-disk trainer JSON format and its `remix/data-schema` validator plus
 * loader.
 *
 * This module is the single contract the trainer EDITOR targets and any trainer
 * LOADER trusts. It defines {@link TrainerDefinition} — the JSON-clean shape one
 * authored trainer serializes to — and {@link TrainerSchema}, which validates an
 * untrusted parsed JSON value into a typed definition (or a list of clear
 * issues). Keeping the format, its validation, and the loader together, free of
 * any renderer or DOM dependency, lets the editor, the export action, and a
 * later battle runtime all import the same contract and lets it be unit-tested.
 *
 * A trainer carries a stable `id`, a display `name`, an optional `spriteId`
 * (a manifest image id, or `null` for none), three battle `quotes` (`intro`,
 * `win`, `lose`), and a `party` of 1–6 members. Each member references a
 * `speciesId`, a `level`, and up to four optional `moves`. Species and move ids
 * are validated only as non-empty strings — the format never hard-fails on an
 * unknown id at load time, so a definition stays loadable even as the roster
 * changes; the editor is what constrains authors to real ids.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, type Result, success } from "@pkg/result";
import {
	array,
	type InferOutput,
	nullable,
	number,
	object,
	optional,
	parseSafe,
	string,
} from "remix/data-schema";
import { max, min, minLength } from "remix/data-schema/checks";

/** Minimum number of creatures a trainer must field (a party of zero is invalid). */
export const MIN_PARTY_SIZE = 1;

/** Maximum number of creatures a trainer may field, matching the source games. */
export const MAX_PARTY_SIZE = 6;

/** Minimum level a party member may be spawned at. */
export const MIN_LEVEL = 1;

/** Maximum level a party member may be spawned at, matching the source games. */
export const MAX_LEVEL = 100;

/** Maximum number of moves a single party member may be given. */
export const MAX_MOVES_PER_MEMBER = 4;

/** A whole (>= 1) integer id/level/count that cannot be zero, negative, or fractional. */
const levelNumber = () =>
	number()
		.refine(Number.isInteger, "Level must be a whole number.")
		.pipe(min(MIN_LEVEL), max(MAX_LEVEL));

/** A non-empty identifier string (a species or move id); never blank. */
const idString = () => string().pipe(minLength(1));

/**
 * Validates one party member: a species reference, its spawn level, and an
 * optional list of up to {@link MAX_MOVES_PER_MEMBER} move ids. Ids are only
 * shape-checked (non-empty strings), not resolved against any roster.
 */
const PartyMemberSchema = object({
	speciesId: idString(),
	level: levelNumber(),
	moves: optional(
		array(idString()).refine(
			(moves) => moves.length <= MAX_MOVES_PER_MEMBER,
			`A party member may have at most ${MAX_MOVES_PER_MEMBER} moves.`,
		),
	),
});

/** Validates a trainer's three battle quotes (all required, may be empty strings). */
const QuotesSchema = object({
	intro: string(),
	win: string(),
	lose: string(),
});

/**
 * Validates a whole trainer definition. The `party` must hold between
 * {@link MIN_PARTY_SIZE} and {@link MAX_PARTY_SIZE} members; `spriteId` is a
 * manifest image id or `null` for a trainer with no sprite.
 */
export const TrainerSchema = object({
	id: idString(),
	name: string().refine((name) => name.length >= 1, "Trainer name is required."),
	spriteId: optional(nullable(string())),
	quotes: QuotesSchema,
	party: array(PartyMemberSchema)
		.refine(
			(party) => party.length >= MIN_PARTY_SIZE,
			`A trainer needs at least ${MIN_PARTY_SIZE} party member.`,
		)
		.refine(
			(party) => party.length <= MAX_PARTY_SIZE,
			`A trainer may field at most ${MAX_PARTY_SIZE} party members.`,
		),
});

/**
 * One creature slot in a trainer's party, spawned fresh for each battle. Written
 * out explicitly (rather than inferred) so `moves` is a genuinely optional key —
 * the schema's `optional(...)` infers it as a required key that may be `undefined`,
 * which would force every JSON-clean member and every editor clone to carry the
 * field even when there are no moves.
 */
export interface TrainerPartyMember {
	/** The species this party member is spawned from. */
	speciesId: string;
	/** The level this party member is spawned at. */
	level: number;
	/** Up to {@link MAX_MOVES_PER_MEMBER} move ids; omitted for a member with no moves. */
	moves?: string[];
}

/** A trainer's three battle quotes. */
export type TrainerQuotes = InferOutput<typeof QuotesSchema>;

/** A fully authored, JSON-clean trainer definition. */
export interface TrainerDefinition {
	/** Stable identifier the export path derives the write filename from. */
	id: string;
	/** Display name shown in battle intro/defeat lines. */
	name: string;
	/** Manifest image id for the trainer's sprite, or `null`/absent for none. */
	spriteId?: string | null;
	/** The three battle quotes (intro/win/lose). */
	quotes: TrainerQuotes;
	/** The ordered creatures the trainer sends out, 1–{@link MAX_PARTY_SIZE}. */
	party: TrainerPartyMember[];
}

/** Error thrown/returned when a parsed value is not a valid {@link TrainerDefinition}. */
export class TrainerValidationError extends Error {
	/**
	 * @param message Human-readable description of why the value is invalid.
	 */
	constructor(message: string) {
		super(message);
		this.name = "TrainerValidationError";
	}
}

/**
 * Validates an untrusted parsed JSON value into a {@link TrainerDefinition}.
 *
 * The loader is pure and disk-free: callers hand it an already-parsed value
 * (e.g. from a file read or a bundled JSON import) and receive back
 * a typed definition or a {@link TrainerValidationError} carrying the first
 * validation issue. It never touches the filesystem so it can be unit-tested
 * directly and reused by both the editor and the export handler.
 *
 * @param value The parsed JSON value to validate (untrusted).
 * @returns Success with the typed definition, or failure with a validation error.
 */
export function parseTrainer(value: unknown): Result<TrainerDefinition, TrainerValidationError> {
	let parsed = parseSafe(TrainerSchema, value);
	if (!parsed.success) {
		let issue = parsed.issues[0];
		return failure(
			new TrainerValidationError(issue ? issue.message : "Invalid trainer definition."),
		);
	}
	return success(parsed.value);
}
