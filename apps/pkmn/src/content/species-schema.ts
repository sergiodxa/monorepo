/**
 * The on-disk species JSON format and its validator, trusted by the content
 * loader and re-checked by the editor's export path. Enums validate as their
 * stored string/number values so a JSON round-trip of the authored roster
 * re-types losslessly; ids validate as non-empty strings, leaving
 * cross-reference checks to `GameData.create` so the file stays loadable.
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

const wholeNumber = () => number().refine(Number.isInteger, "Expected a whole number.");

const idString = () => string().pipe(minLength(1));

/**
 * The runtime values of an enum as the non-empty tuple `enum_` requires. Every
 * enum in this schema has members, so the assertion is sound; it just recovers
 * the tuple shape TypeScript widens `Object.values` to a plain array.
 */
function enumValues<T>(members: Record<string, T>): readonly [T, ...T[]] {
	return Object.values(members) as unknown as readonly [T, ...T[]];
}

const statValue = () => enum_(enumValues(Stat));

const typeValue = () => enum_(enumValues(Type));

const growthRateValue = () => enum_(enumValues(GrowthRate));

const eggGroupValue = () => enum_(enumValues(EggGroup));

/** Physical dimensions (weight in kg, height in m). */
const SizeSchema = object({
	weight: number(),
	height: number(),
});

const StatSetSchema = object({
	[Stat.HP]: number(),
	[Stat.Attack]: number(),
	[Stat.Defense]: number(),
	[Stat.SpecialAttack]: number(),
	[Stat.SpecialDefense]: number(),
	[Stat.Speed]: number(),
});

/** A partial EV yield; a stat left out of the record contributes no EVs. */
const EvYieldSchema = record(statValue(), number());

const TypesSchema = array(typeValue())
	.refine((types) => types.length >= 1, "A species needs at least one type.")
	.refine((types) => types.length <= 2, "A species has at most two types.");

const EggGroupsSchema = array(eggGroupValue())
	.refine((groups) => groups.length >= 1, "A species needs at least one egg group.")
	.refine((groups) => groups.length <= 2, "A species has at most two egg groups.");

/** Gender distribution, stored exactly as authored. */
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

/** A sprite reference: a region inside a shared atlas, or a manifest image id. */
const SpriteSchema = nullable(
	union([object({ atlas: idString(), region: idString() }), object({ image: idString() })]),
);

/**
 * Validates one species record against the {@link Species} contract. `evYield`
 * and `sprite` are genuinely optional keys, so content that omits them still
 * validates.
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
 * Validates an untrusted parsed JSON value into the `Record<SpeciesId, Species>`
 * shape the game consumes, so a malformed `species.json` fails loudly at
 * content-load time; the cast restores the exact tuple/union field contracts.
 *
 * @param value The parsed JSON value to validate (untrusted).
 * @returns The validated species roster keyed by id.
 */
export function parseSpecies(value: unknown): Record<SpeciesId, Species> {
	return parse(SpeciesIndexSchema, value) as Record<SpeciesId, Species>;
}
