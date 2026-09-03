/**
 * The on-disk trainer JSON format with its validator and loader — the single
 * contract the trainer editor targets and every loader trusts. Species and move
 * ids validate as non-empty strings, leaving id resolution to the editor, so an
 * authored definition stays loadable as the roster changes. The format stays
 * free of renderer and DOM dependencies, so a battle runtime can share it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, type Result, success } from "@sdxc/result";
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

/** Minimum number of creatures a trainer must field. */
export const MIN_PARTY_SIZE = 1;

/** Maximum number of creatures a trainer may field, matching the source games. */
export const MAX_PARTY_SIZE = 6;

/** Minimum level a party member may be spawned at. */
export const MIN_LEVEL = 1;

/** Maximum level a party member may be spawned at, matching the source games. */
export const MAX_LEVEL = 100;

/** Maximum number of moves a single party member may be given. */
export const MAX_MOVES_PER_MEMBER = 4;

const levelNumber = () =>
	number()
		.refine(Number.isInteger, "Level must be a whole number.")
		.pipe(min(MIN_LEVEL), max(MAX_LEVEL));

const idString = () => string().pipe(minLength(1));

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

/** A trainer's three battle quotes; every key is required and may be empty. */
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
 * out explicitly so `moves` stays a genuinely optional key that JSON-clean
 * members and editor clones may omit.
 */
export interface TrainerPartyMember {
	speciesId: string;
	level: number;
	/** Up to {@link MAX_MOVES_PER_MEMBER} move ids. */
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
	quotes: TrainerQuotes;
	/** The ordered creatures the trainer sends out, 1–{@link MAX_PARTY_SIZE}. */
	party: TrainerPartyMember[];
}

/** Reports which rule a value broke while failing {@link TrainerDefinition} validation. */
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
 * Callers hand over an already-parsed value and get back a typed definition or
 * a {@link TrainerValidationError} carrying the first validation issue.
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
