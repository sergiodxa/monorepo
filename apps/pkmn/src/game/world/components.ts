/**
 * Shared world-component contracts for the game state ECS layer.
 *
 * This module centralizes the serializable component shapes that describe entity
 * identity, progression, ownership, placement, and battle participation inside
 * the world model. It provides the stable data contracts used to attach domain
 * state to entities without coupling those records to rendering or authored
 * content concerns.
 *
 * By defining these component interfaces and unions in one place, the module
 * gives the rest of the world and engine layers a consistent vocabulary for
 * reading, persisting, and transforming entity state. The exported types are
 * intended to keep system boundaries explicit and make ECS-oriented state flows
 * easier to reason about as entities move across world contexts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";
import type { State } from "~/game/data/status";

import type { Creature, MoveSet } from "./creature";
import type { BattleId, CreatureId, PlayerId } from "./ids";

/** Saved identity fields that determine what one creature is. */
export interface CreatureIdentityComponent {
	/** Static species identifier used for authored content lookups. */
	speciesId: SpeciesId;
	/** Optional display name that overrides the default species name. */
	nickname?: string;
}

/** Saved growth and stat training fields for one creature. */
export interface CreatureProgressComponent {
	/** Nature identifier used for stat modifiers. */
	natureId: NatureId;
	/** Total accumulated experience points. */
	experience: number;
	/** Individual values used by stat calculation. */
	iv: StatSet;
	/** Effort values used by stat calculation. */
	ev: StatSet;
	/** Optional authored size override for this specific creature. */
	size?: Creature.SizeData;
}

/** Saved move loadout and PP tracking for one creature. */
export interface CreatureMovesComponent {
	/** Ordered equipped moves. */
	moveset: MoveSet;
	/** Remaining PP for each equipped move slot. */
	pp: [number, number, number, number];
}

/** Saved HP damage currently applied to one creature. */
export interface CreatureHealthComponent {
	/** Total damage currently taken from max HP. */
	damage: number;
}

/** Saved major status condition applied outside battle. */
export interface CreatureStatusComponent {
	/** Current persistent status ailment, if any. */
	state: State | null;
}

/** Ownership metadata for one creature entity. */
export interface OwnershipComponent {
	/** Current owning player entity. */
	ownerId: PlayerId;
}

/** Places one creature in a specific world container. */
export type CreatureLocationComponent =
	| CreaturePartyLocationComponent
	| CreatureStorageLocationComponent
	| CreatureEncounterLocationComponent
	| CreatureBattleLocationComponent;

/** Places one creature in the player's active party order. */
export interface CreaturePartyLocationComponent {
	kind: "party";
	playerId: PlayerId;
	slot: number;
}

/** Places one creature inside one named storage box. */
export interface CreatureStorageLocationComponent {
	kind: "storage";
	playerId: PlayerId;
	boxId: string;
	slot: number;
}

/** Marks one creature as an uncaptured encounter entity. */
export interface CreatureEncounterLocationComponent {
	kind: "encounter";
	encounterId: string;
}

/** Places one creature in one transient battle slot. */
export interface CreatureBattleLocationComponent {
	kind: "battle";
	battleId: BattleId;
	side: number;
	slot: number;
}

/** Serialized bootstrap record used before creature stores are split. */
export interface LegacyCreatureComponent extends Creature.Arguments {}

/** Bundles the persistent components required to rebuild one creature aggregate. */
export interface CreatureComponentSet {
	/** Identity fields for the creature. */
	identity: CreatureIdentityComponent;
	/** Growth and stat training fields. */
	progress: CreatureProgressComponent;
	/** Equipped moves and current PP. */
	moves: CreatureMovesComponent;
	/** Current damage state. */
	health: CreatureHealthComponent;
	/** Current major status condition. */
	status: CreatureStatusComponent;
	/** Ownership metadata when the creature is owned. */
	ownership?: OwnershipComponent;
	/** Current world placement when the creature is placed somewhere. */
	location?: CreatureLocationComponent;
}

/** Input used when splitting one legacy creature blob into components. */
export interface CreatureSplitInput {
	/** Stable entity identifier that owns the creature components. */
	creatureId: CreatureId;
	/** Legacy aggregate creature payload. */
	creature: LegacyCreatureComponent;
	/** Optional owner inferred from bootstrap containers. */
	ownerId?: PlayerId;
	/** Optional location inferred from bootstrap containers. */
	location?: CreatureLocationComponent;
}

/** Splits one legacy creature blob into explicit persistent ECS components. */
export function splitCreatureComponents(input: CreatureSplitInput): CreatureComponentSet {
	let { creature } = input;

	return {
		identity: {
			speciesId: creature.species,
			nickname: creature.nickname,
		},
		progress: {
			natureId: creature.nature,
			experience: creature.experience,
			iv: structuredClone(creature.iv),
			ev: structuredClone(creature.ev),
			size: creature.size ? structuredClone(creature.size) : undefined,
		},
		moves: {
			moveset: [...creature.moveset] as MoveSet,
			pp: [...creature.status.pp] as [number, number, number, number],
		},
		health: {
			damage: creature.status.damage,
		},
		status: {
			state: creature.status.state,
		},
		ownership: input.ownerId ? { ownerId: input.ownerId } : undefined,
		location: input.location ? structuredClone(input.location) : undefined,
	};
}

/** Rebuilds the legacy creature aggregate expected by existing battle systems. */
export function mergeCreatureComponents(components: CreatureComponentSet): Creature.Arguments {
	return {
		species: components.identity.speciesId,
		nickname: components.identity.nickname,
		nature: components.progress.natureId,
		experience: components.progress.experience,
		moveset: [...components.moves.moveset] as MoveSet,
		status: {
			state: components.status.state,
			damage: components.health.damage,
			pp: [...components.moves.pp] as [number, number, number, number],
		},
		iv: structuredClone(components.progress.iv),
		ev: structuredClone(components.progress.ev),
		size: components.progress.size ? structuredClone(components.progress.size) : undefined,
	};
}
