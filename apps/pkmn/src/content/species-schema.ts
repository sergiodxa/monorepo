/**
 * The on-disk species JSON format and its `remix/data-schema` validator.
 *
 * This module is the single contract the species content LOADER trusts and the
 * species EDITOR's export path re-validates against. It defines
 * {@link SpeciesSchema} (one species record) and {@link SpeciesIndexSchema}
 * (the whole `species.json` map keyed by id), plus {@link parseSpecies}, which
 * validates an untrusted parsed JSON value back into the exact
 * `Record<SpeciesId, Species>` shape the rest of the game consumes.
 *
 * Enums are stored and validated as their runtime string/number VALUES (e.g.
 * `"grass"`, `"medium-fast"`, `"level"`) rather than TypeScript enum members, so
 * a plain JSON serialization of the authored roster round-trips losslessly and
 * re-types cleanly. Ids inside evolutions and learnsets are shape-checked as
 * non-empty strings only — the format never hard-fails on an unknown id at load
 * time (cross-references are validated later by `GameData.create`), so the file
 * stays loadable as content changes.
 *
 * The validator is pure and disk-free: callers hand it an already-parsed value
 * (a bundled JSON import or a file read) so it can be unit-tested
 * directly and reused by both the loader and the export handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	array,
	enum_,
	type InferOutput,
	nullable,
	number,
	object,
	optional,
	parse,
	record,
	string,
	union,
} from "remix/data-schema";
import { minLength } from "remix/data-schema/checks";

import type { Species, SpeciesId } from "~/game/data/species";

import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { EggGroup, Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

/** A whole, finite number (no fraction) used by counts, levels, and ids. */
const wholeNumber = () => number().refine(Number.isInteger, "Expected a whole number.");

/** A non-empty identifier string (a species or move id); never blank. */
const idString = () => string().pipe(minLength(1));

/**
 * The runtime values of an enum as the non-empty tuple `enum_` requires. Every
 * enum in this schema has members, so the assertion is sound; it just recovers
 * the tuple shape TypeScript widens `Object.values` to a plain array.
 */
function enumValues<T>(members: Record<string, T>): readonly [T, ...T[]] {
	return Object.values(members) as unknown as readonly [T, ...T[]];
}

/** Validates a stat value key against the runtime {@link Stat} values. */
const statValue = () => enum_(enumValues(Stat));

/** Validates a type value against the runtime {@link Type} values. */
const typeValue = () => enum_(enumValues(Type));

/** Validates a growth-rate value against the runtime {@link GrowthRate} values. */
const growthRateValue = () => enum_(enumValues(GrowthRate));

/** Validates an egg-group value against the runtime {@link EggGroup} values. */
const eggGroupValue = () => enum_(enumValues(EggGroup));

/** Physical dimensions (weight in kg, height in m). */
const SizeSchema = object({
	weight: number(),
	height: number(),
});

/** A complete base-stat block, one entry per {@link Stat}. */
const StatSetSchema = object({
	[Stat.HP]: number(),
	[Stat.Attack]: number(),
	[Stat.Defense]: number(),
	[Stat.SpecialAttack]: number(),
	[Stat.SpecialDefense]: number(),
	[Stat.Speed]: number(),
});

/**
 * A partial EV yield: any subset of stat keys mapped to numbers. Validated as a
 * record of stat value -> number so a missing stat simply contributes no EVs.
 */
const EvYieldSchema = record(statValue(), number());

/** One or two elemental types. */
const TypesSchema = array(typeValue())
	.refine((types) => types.length >= 1, "A species needs at least one type.")
	.refine((types) => types.length <= 2, "A species has at most two types.");

/** One or two egg groups. */
const EggGroupsSchema = array(eggGroupValue())
	.refine((groups) => groups.length >= 1, "A species needs at least one egg group.")
	.refine((groups) => groups.length <= 2, "A species has at most two egg groups.");

/**
 * Gender distribution: either the genderless sentinel value or an object with an
 * optional male/female percentage. Stored exactly as authored.
 */
const GenderSchema = union([
	enum_([Gender.Genderless]),
	object({
		[Gender.Male]: optional(number()),
		[Gender.Female]: optional(number()),
	}),
]);

/** One learnset entry across every learn method (level-up, TM/HM, tutor, egg). */
const LearnsetEntrySchema = union([
	object({ level: number(), moveId: idString() }),
	object({ tmhm: number() }),
	object({ tutor: enum_([true]), moveId: idString() }),
	object({ egg: enum_([true]), moveId: idString() }),
]);

/** One evolution across every method (by level, item, trade, friendship, place). */
const EvolutionSchema = union([
	object({
		method: enum_([EvolutionMethod.Level]),
		speciesId: idString(),
		level: number(),
	}),
	object({
		method: enum_([EvolutionMethod.Item]),
		speciesId: idString(),
		itemId: idString(),
	}),
	object({
		method: enum_([EvolutionMethod.Trade]),
		speciesId: idString(),
	}),
	object({
		method: enum_([EvolutionMethod.Friendship]),
		speciesId: idString(),
		level: number(),
	}),
	object({
		method: enum_([EvolutionMethod.Place]),
		speciesId: idString(),
		placeId: number(),
	}),
]);

/**
 * A species sprite reference, or `null` for none: a named region inside a shared
 * atlas, or a standalone manifest image id. Ids are shape-checked only.
 */
const SpriteSchema = nullable(
	union([object({ atlas: idString(), region: idString() }), object({ image: idString() })]),
);

/**
 * Validates one species record. The shape mirrors the {@link Species} contract,
 * with enums validated as their stored string/number values so a JSON round-trip
 * of the authored roster re-types losslessly. `evYield` and `sprite` are genuinely
 * optional keys (absent when the content omits them).
 */
export const SpeciesSchema = object({
	number: wholeNumber(),
	size: SizeSchema,
	types: TypesSchema,
	baseExperience: number(),
	catchRate: number(),
	growthRate: growthRateValue(),
	stats: StatSetSchema,
	evYield: optional(EvYieldSchema),
	evolutions: array(EvolutionSchema),
	learnset: array(LearnsetEntrySchema),
	gender: GenderSchema,
	eggGroup: EggGroupsSchema,
	sprite: optional(SpriteSchema),
});

/** Validates the whole `species.json` map: species id -> species record. */
export const SpeciesIndexSchema = record(idString(), SpeciesSchema);

/** The validated shape of one species record (structurally a {@link Species}). */
export type ValidatedSpecies = InferOutput<typeof SpeciesSchema>;

/**
 * Validates an untrusted parsed JSON value into the exact
 * `Record<SpeciesId, Species>` shape the game consumes.
 *
 * Throws a `remix/data-schema` `ValidationError` when the value does not match
 * {@link SpeciesIndexSchema}, so a malformed `species.json` fails loudly at
 * content-load time. On success the return is re-typed to
 * `Record<SpeciesId, Species>`: the schema validates each field to a value
 * structurally identical to `Species`, and the cast reunites the loosened
 * `types`/`eggGroup`/`sprite` shapes with their exact tuple/union contract
 * without changing any runtime value.
 *
 * @param value The parsed JSON value to validate (untrusted).
 * @returns The validated species roster keyed by id.
 */
export function parseSpecies(value: unknown): Record<SpeciesId, Species> {
	return parse(SpeciesIndexSchema, value) as Record<SpeciesId, Species>;
}
