/**
 * Declares the engine-facing event contracts used to describe state changes after game commands are applied. This module centralizes the typed payloads that cross the engine boundary so other layers can react to runtime outcomes without depending on internal execution details.
 *
 * It defines the event namespace members and the union type that represent the complete set of high-level events emitted by this file. These contracts provide a stable, content-agnostic shape for communicating battle lifecycle updates, collection changes, and creature progression notifications.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BattleEvent } from "./battle/battle";
import type { ItemId } from "./data/item";
import type { SpeciesId } from "./data/species";
import type { BattleId, CreatureId, PlayerId } from "./world/ids";

/** Events emitted by the engine boundary. */
export namespace GameEvent {
	/** Reports that a transient battle entity was created and attached to the player. */
	export interface BattleStarted {
		type: "battle-started";
		battleId: BattleId;
	}

	/** Reports ordered battle runtime events emitted since the last dispatch. */
	export interface BattleEventsAppended {
		type: "battle-events-appended";
		battleId: BattleId;
		events: BattleEvent[];
	}

	/** Reports that the battle runtime is waiting for the next user decision. */
	export interface BattleInputRequested {
		type: "battle-input-requested";
		battleId: BattleId;
		request: "turn" | "replacement";
	}

	/** Reports that the active battle has reached a winner. */
	export interface BattleFinished {
		type: "battle-finished";
		battleId: BattleId;
		winnerSide: number | null;
	}

	/** Reports an inventory count change. */
	export interface InventoryUpdated {
		type: "inventory-updated";
		itemId: ItemId;
		count: number;
	}

	/** Reports a species progress update in the bestiary. */
	export interface BestiaryUpdated {
		type: "bestiary-updated";
		speciesId: SpeciesId;
		status: "seen" | "caught";
	}

	/** Reports that one creature moved between party and storage containers. */
	export interface CreaturePlacementChanged {
		type: "creature-placement-changed";
		creatureId: CreatureId;
		placement: "party" | "storage";
		boxId?: string;
	}

	/** Reports that one encounter creature became owned. */
	export interface CreatureCaptured {
		type: "creature-captured";
		creatureId: CreatureId;
		placement: "party" | "storage";
		boxId?: string;
	}

	/** Reports earned experience and any resulting level change. */
	export interface CreatureExperienceGranted {
		type: "creature-experience-granted";
		creatureId: CreatureId;
		levelBefore: number;
		levelAfter: number;
		totalExperience: number;
	}

	/** Reports that one creature changed species identity. */
	export interface CreatureEvolved {
		type: "creature-evolved";
		creatureId: CreatureId;
		speciesId: SpeciesId;
	}

	/** Reports that the player's whole party was fully restored. */
	export interface PartyHealed {
		type: "party-healed";
		playerId: PlayerId;
		count: number;
	}

	/** Reports that a wild creature was spawned for an encounter. */
	export interface EncounterSpawned {
		type: "encounter-spawned";
		encounterId: string;
		creatureId: CreatureId;
		speciesId: SpeciesId;
		level: number;
	}
}

/** High-level engine event emitted after a command is applied. */
export type GameEvent =
	| GameEvent.BattleStarted
	| GameEvent.BattleEventsAppended
	| GameEvent.BattleInputRequested
	| GameEvent.BattleFinished
	| GameEvent.InventoryUpdated
	| GameEvent.BestiaryUpdated
	| GameEvent.CreaturePlacementChanged
	| GameEvent.CreatureCaptured
	| GameEvent.CreatureExperienceGranted
	| GameEvent.CreatureEvolved
	| GameEvent.PartyHealed
	| GameEvent.EncounterSpawned;
